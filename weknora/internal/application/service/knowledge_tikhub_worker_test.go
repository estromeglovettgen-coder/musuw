package service

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/Tencent/WeKnora/internal/infrastructure/docparser"
	"github.com/Tencent/WeKnora/internal/infrastructure/tikhub"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/stretchr/testify/require"
)

type tikHubWorkerRepoStub struct {
	interfaces.KnowledgeRepository
	updates              int
	updatesWithStorage   int
	updateStorageQuota   int64
	updatedKnowledge     *types.Knowledge
	updateWithStorageErr error
	claimCalls           int
	claimStorageQuota    int64
	claimCurrent         *types.Knowledge
	claimResult          bool
	claimErr             error
}

func (r *tikHubWorkerRepoStub) UpdateKnowledge(_ context.Context, knowledge *types.Knowledge) error {
	r.updates++
	if knowledge != nil {
		copy := *knowledge
		r.updatedKnowledge = &copy
	}
	return nil
}

func (r *tikHubWorkerRepoStub) UpdateKnowledgeWithStorage(
	_ context.Context,
	knowledge *types.Knowledge,
	effectiveQuota int64,
) error {
	r.updatesWithStorage++
	r.updateStorageQuota = effectiveQuota
	if knowledge != nil {
		copy := *knowledge
		r.updatedKnowledge = &copy
	}
	return r.updateWithStorageErr
}

func (r *tikHubWorkerRepoStub) ClaimKnowledgeSourceWithStorage(
	_ context.Context,
	knowledge *types.Knowledge,
	effectiveQuota int64,
) (*types.Knowledge, bool, error) {
	r.claimCalls++
	r.claimStorageQuota = effectiveQuota
	if r.claimErr != nil {
		return nil, false, r.claimErr
	}
	if r.claimCurrent != nil {
		copy := *r.claimCurrent
		return &copy, r.claimResult, nil
	}
	if knowledge == nil {
		return nil, false, errors.New("knowledge is nil")
	}
	copy := *knowledge
	r.updatedKnowledge = &copy
	return &copy, true, nil
}

type tikHubWorkerFileServiceStub struct {
	savedData     []byte
	savedFileName string
	savedTemp     bool
	saveCalls     int
	deleteCalls   int
	deletedPath   string
	deletedPaths  []string
	deleteErr     error
}

func (s *tikHubWorkerFileServiceStub) CheckConnectivity(context.Context) error { return nil }
func (s *tikHubWorkerFileServiceStub) SaveFile(context.Context, *multipart.FileHeader, uint64, string) (string, error) {
	return "", errors.New("not implemented")
}
func (s *tikHubWorkerFileServiceStub) SaveBytes(_ context.Context, data []byte, _ uint64, fileName string, temp bool) (string, error) {
	s.saveCalls++
	s.savedData = append([]byte(nil), data...)
	s.savedFileName = fileName
	s.savedTemp = temp
	return "stored/" + fileName, nil
}
func (s *tikHubWorkerFileServiceStub) GetFile(context.Context, string) (io.ReadCloser, error) {
	return nil, errors.New("not implemented")
}
func (s *tikHubWorkerFileServiceStub) GetFileURL(context.Context, string) (string, error) {
	return "", errors.New("not implemented")
}
func (s *tikHubWorkerFileServiceStub) DeleteFile(_ context.Context, path string) error {
	s.deleteCalls++
	s.deletedPath = path
	s.deletedPaths = append(s.deletedPaths, path)
	return s.deleteErr
}
func (s *tikHubWorkerFileServiceStub) CopyFile(context.Context, string, uint64, string) (string, error) {
	return "", errors.New("not implemented")
}

func TestCleanupTikHubResolvedImagesDeletesServingURLs(t *testing.T) {
	files := &tikHubWorkerFileServiceStub{}
	cleanupTikHubResolvedImages(context.Background(), files, []docparser.StoredImage{
		{ServingURL: "stored/image-one.png"},
		{ServingURL: "  stored/image-two.png  "},
		{ServingURL: ""},
	})
	require.ElementsMatch(t, []string{"stored/image-one.png", "stored/image-two.png"}, files.deletedPaths)
}

type tikHubWorkerRoundTripFunc func(*http.Request) (*http.Response, error)

func (f tikHubWorkerRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestPrepareTikHubArtifactPersistsDocumentBeforeExistingParser(t *testing.T) {
	t.Parallel()

	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/v1/xiaohongshu/app_v2/get_image_note_detail", r.URL.Path)
		require.Equal(t, "64f123456789abcdef123456", r.URL.Query().Get("note_id"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":200,"data":{"type":"normal","title":"一篇图文","desc":"正文内容","image_list":[{"url":"https://images.example/one.jpg"}]}}`)
	}))
	defer api.Close()

	files := &tikHubWorkerFileServiceStub{}
	repo := &tikHubWorkerRepoStub{}
	svc := &knowledgeService{
		repo:           repo,
		fileSvc:        files,
		tikhubImporter: tikhub.NewTikHubImporterForTest(api.URL, "test-key", api.Client()),
	}
	payload := types.DocumentProcessPayload{
		TenantID: 7,
		URL:      "https://www.xiaohongshu.com/explore/64f123456789abcdef123456",
	}
	knowledge := &types.Knowledge{ID: "knowledge-1", TenantID: 7, FileType: "html"}

	handled, _, err := svc.prepareTikHubArtifact(
		context.Background(),
		&payload,
		&types.KnowledgeBase{ID: "kb-1"},
		knowledge,
		types.EffectiveProcessConfig{},
	)
	require.NoError(t, err)
	require.True(t, handled)
	require.Empty(t, payload.URL, "materialized documents must not enter the URL/WebParser branch")
	require.Equal(t, "md", payload.FileType)
	require.Equal(t, "stored/xiaohongshu-64f123456789abcdef123456.md", payload.FilePath)
	require.Equal(t, payload.FilePath, knowledge.FilePath)
	require.Equal(t, "md", knowledge.FileType)
	require.Equal(t, "一篇图文", knowledge.Title)
	require.Contains(t, string(files.savedData), "正文内容")
	require.Contains(t, string(files.savedData), "https://images.example/one.jpg")
	require.Equal(t, 1, files.saveCalls)
	require.False(t, files.savedTemp, "social artifacts must use durable storage")
	require.Equal(t, 0, repo.updates)
	require.Equal(t, 1, repo.claimCalls)
	require.Equal(t, int64(0), repo.claimStorageQuota)
	require.Equal(t, int64(len(files.savedData)), repo.updatedKnowledge.FileSize)
}

func TestPrepareTikHubArtifactAllowsDouyinPhotoOnFreePlanWithoutVLM(t *testing.T) {
	t.Parallel()

	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/v1/douyin/app/v3/fetch_one_video_by_share_url", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":200,"data":{"desc":"抖音图文","images":[{"url_list":["https://images.example/photo.jpg"]}]}}`)
	}))
	defer api.Close()

	files := &tikHubWorkerFileServiceStub{}
	svc := &knowledgeService{
		repo:           &tikHubWorkerRepoStub{},
		fileSvc:        files,
		tikhubImporter: tikhub.NewTikHubImporterForTest(api.URL, "test-key", api.Client()),
	}
	payload := types.DocumentProcessPayload{TenantID: 11, URL: "https://v.douyin.com/wqa8GaL6eyY"}
	knowledge := &types.Knowledge{ID: "knowledge-photo", TenantID: 11, FileType: "html"}

	handled, _, err := svc.prepareTikHubArtifact(
		contextWithConsumerPlan(11, types.ConsumerPlanFree),
		&payload,
		&types.KnowledgeBase{ID: "kb-photo"},
		knowledge,
		types.EffectiveProcessConfig{},
	)
	require.NoError(t, err)
	require.True(t, handled)
	require.Empty(t, payload.URL)
	require.Equal(t, "md", payload.FileType)
	require.Contains(t, string(files.savedData), "抖音图文")
	require.Contains(t, string(files.savedData), "photo.jpg")
}

func TestPrepareTikHubArtifactKeepsDocumentWhenProviderImageCannotBeStored(t *testing.T) {
	t.Parallel()

	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/v1/douyin/app/v3/fetch_one_video_by_share_url", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":200,"data":{"desc":"正文仍应入库","images":[{"url_list":["https://127.0.0.1/unreachable.jpg"]}]}}`)
	}))
	defer api.Close()

	files := &tikHubWorkerFileServiceStub{}
	svc := &knowledgeService{
		repo:           &tikHubWorkerRepoStub{},
		fileSvc:        files,
		imageResolver:  docparser.NewImageResolver(),
		tikhubImporter: tikhub.NewTikHubImporterForTest(api.URL, "test-key", api.Client()),
	}
	payload := types.DocumentProcessPayload{TenantID: 11, URL: "https://v.douyin.com/wqa8GaL6eyY"}
	knowledge := &types.Knowledge{ID: "knowledge-photo-fallback", TenantID: 11, FileType: "html"}

	handled, _, err := svc.prepareTikHubArtifact(
		context.Background(),
		&payload,
		&types.KnowledgeBase{ID: "kb-photo"},
		knowledge,
		types.EffectiveProcessConfig{},
	)
	require.NoError(t, err)
	require.True(t, handled)
	require.Contains(t, string(files.savedData), "正文仍应入库")
	require.NotContains(t, string(files.savedData), "127.0.0.1")
}

func TestPrepareTikHubArtifactDownloadsVideoWithoutProviderBearerAndSelectsVideoPath(t *testing.T) {
	t.Parallel()

	var tikHubCalls atomic.Int32
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tikHubCalls.Add(1)
		require.Equal(t, "/api/v1/youtube/web_v2/get_video_streams_v2", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":200,"data":{"title":"A video","formats":[{"mime_type":"video/mp4","url":"https://media.example/video.mp4"}]}}`)
	}))
	defer api.Close()

	mediaClient := &http.Client{Transport: tikHubWorkerRoundTripFunc(func(req *http.Request) (*http.Response, error) {
		require.Equal(t, "https://media.example/video.mp4", req.URL.String())
		require.Empty(t, req.Header.Get("Authorization"))
		require.Empty(t, req.Header.Get("Cookie"))
		return &http.Response{
			StatusCode:    http.StatusOK,
			Header:        http.Header{"Content-Type": []string{"video/mp4"}},
			Body:          io.NopCloser(bytes.NewReader([]byte("video-bytes"))),
			ContentLength: int64(len("video-bytes")),
			Request:       req,
		}, nil
	})}
	files := &tikHubWorkerFileServiceStub{}
	svc := &knowledgeService{
		repo:              &tikHubWorkerRepoStub{},
		fileSvc:           files,
		tikhubImporter:    tikhub.NewTikHubImporterForTest(api.URL, "provider-key", api.Client()),
		tikhubMediaClient: mediaClient,
	}
	const sourceURL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
	payload := types.DocumentProcessPayload{TenantID: 9, URL: sourceURL}
	knowledge := &types.Knowledge{ID: "knowledge-2", TenantID: 9, FileType: "html"}

	handled, _, err := svc.prepareTikHubArtifact(
		context.Background(),
		&payload,
		&types.KnowledgeBase{ID: "kb-2"},
		knowledge,
		types.EffectiveProcessConfig{VLMConfig: types.VLMConfig{Enabled: true, ModelID: "vlm-1"}},
	)
	require.NoError(t, err)
	require.True(t, handled)
	require.Empty(t, payload.URL)
	require.Equal(t, "mp4", payload.FileType)
	require.True(t, IsVideoType(payload.FileType), "the existing convert() function must delegate this artifact to convertVideo")
	require.Equal(t, "stored/youtube-dQw4w9WgXcQ.mp4", payload.FilePath)
	require.Equal(t, []byte("video-bytes"), files.savedData)
	require.False(t, files.savedTemp, "social videos must survive worker retries and reparses")
	require.False(t, strings.Contains(files.savedFileName, "/"))
	require.Equal(t, int32(1), tikHubCalls.Load(), "the provider should be called once to materialize the durable source")

	// A downstream VLM failure redelivers the original social URL. The stored
	// source checkpoint must turn that redelivery into an ordinary local-file
	// payload, without invoking TikHub again.
	retryPayload := types.DocumentProcessPayload{TenantID: 9, URL: sourceURL}
	require.True(t, resumeMaterializedTikHubArtifact(&retryPayload, knowledge))
	require.Empty(t, retryPayload.URL)
	require.Equal(t, knowledge.FilePath, retryPayload.FilePath)
	require.Equal(t, knowledge.FileName, retryPayload.FileName)
	require.Equal(t, knowledge.FileType, retryPayload.FileType)
	require.Equal(t, int32(1), tikHubCalls.Load(), "retries must reuse the persisted MP4 instead of paying TikHub again")
}

func TestPrepareTikHubArtifactCleansObjectWhenStorageMutationFails(t *testing.T) {
	t.Parallel()

	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/v1/xiaohongshu/app_v2/get_image_note_detail", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":200,"data":{"type":"normal","title":"内容","desc":"正文","image_list":[{"url":"https://images.example/one.jpg"}]}}`)
	}))
	defer api.Close()

	files := &tikHubWorkerFileServiceStub{}
	repo := &tikHubWorkerRepoStub{claimErr: errors.New("storage quota exceeded")}
	svc := &knowledgeService{
		repo:           repo,
		fileSvc:        files,
		tikhubImporter: tikhub.NewTikHubImporterForTest(api.URL, "test-key", api.Client()),
	}
	payload := types.DocumentProcessPayload{
		TenantID: 7,
		URL:      "https://www.xiaohongshu.com/explore/64f123456789abcdef123456",
	}
	knowledge := &types.Knowledge{ID: "knowledge-failure", TenantID: 7, FileType: "html"}

	handled, _, err := svc.prepareTikHubArtifact(
		context.Background(),
		&payload,
		&types.KnowledgeBase{ID: "kb-1"},
		knowledge,
		types.EffectiveProcessConfig{},
	)

	require.True(t, handled)
	require.EqualError(t, err, "failed to persist social artifact state: storage quota exceeded")
	require.Equal(t, 1, repo.claimCalls)
	require.Equal(t, 1, files.deleteCalls)
	require.Equal(t, "stored/xiaohongshu-64f123456789abcdef123456.md", files.deletedPath)
	require.Empty(t, knowledge.FilePath, "failed persistence must not publish the deleted object path")
	require.Equal(t, "https://www.xiaohongshu.com/explore/64f123456789abcdef123456", payload.URL)
	require.Empty(t, payload.FilePath)
}

func TestPrepareTikHubArtifactDeletesLosingObjectAndUsesWinnerCheckpoint(t *testing.T) {
	t.Parallel()

	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/api/v1/xiaohongshu/app_v2/get_image_note_detail", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"code":200,"data":{"type":"normal","title":"stale title","desc":"stale description","image_list":[{"url":"https://images.example/stale.jpg"}]}}`)
	}))
	defer api.Close()

	files := &tikHubWorkerFileServiceStub{}
	winner := &types.Knowledge{
		ID:             "knowledge-loser",
		TenantID:       7,
		FilePath:       "stored/winner.md",
		FileName:       "winner.md",
		FileType:       "md",
		FileSize:       99,
		ParseStatus:    types.ParseStatusCancelled,
		Description:    "persisted description",
		Metadata:       types.JSON(`{"persisted":true}`),
		CustomMetadata: types.JSON(`{"persisted":true}`),
	}
	repo := &tikHubWorkerRepoStub{claimCurrent: winner, claimResult: false}
	svc := &knowledgeService{
		repo:           repo,
		fileSvc:        files,
		tikhubImporter: tikhub.NewTikHubImporterForTest(api.URL, "test-key", api.Client()),
	}
	payload := types.DocumentProcessPayload{
		TenantID: 7,
		URL:      "https://www.xiaohongshu.com/explore/64f123456789abcdef123456",
	}
	knowledge := &types.Knowledge{ID: "knowledge-loser", TenantID: 7, FileType: "html"}

	handled, _, err := svc.prepareTikHubArtifact(
		context.Background(),
		&payload,
		&types.KnowledgeBase{ID: "kb-1"},
		knowledge,
		types.EffectiveProcessConfig{},
	)
	require.NoError(t, err)
	require.True(t, handled)
	require.Equal(t, 1, repo.claimCalls)
	require.Equal(t, 1, files.deleteCalls)
	require.Equal(t, "stored/"+files.savedFileName, files.deletedPath)
	require.Equal(t, winner.FilePath, knowledge.FilePath)
	require.Equal(t, winner.FileName, payload.FileName)
	require.Equal(t, winner.FileType, payload.FileType)
	require.Equal(t, winner.FilePath, payload.FilePath)
	require.Equal(t, winner.ParseStatus, knowledge.ParseStatus, "stale worker state must not replace persisted cancellation")
	require.Equal(t, winner.Description, knowledge.Description)
	require.JSONEq(t, string(winner.Metadata), string(knowledge.Metadata))
}

func TestPrepareTikHubArtifactLeavesOrdinaryURLsOnExistingWebPath(t *testing.T) {
	t.Parallel()

	payload := types.DocumentProcessPayload{URL: "https://example.com/article"}
	handled, _, err := (&knowledgeService{}).prepareTikHubArtifact(
		context.Background(),
		&payload,
		&types.KnowledgeBase{ID: "kb-3"},
		&types.Knowledge{ID: "knowledge-3"},
		types.EffectiveProcessConfig{},
	)
	require.NoError(t, err)
	require.False(t, handled)
	require.Equal(t, "https://example.com/article", payload.URL)
}

func TestResumeMaterializedTikHubArtifactSkipsAnotherProviderFetch(t *testing.T) {
	t.Parallel()

	payload := types.DocumentProcessPayload{URL: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
	knowledge := &types.Knowledge{
		FilePath: "stored/youtube-dQw4w9WgXcQ.mp4",
		FileName: "youtube-dQw4w9WgXcQ.mp4",
		FileType: "mp4",
	}
	require.True(t, resumeMaterializedTikHubArtifact(&payload, knowledge))
	require.Empty(t, payload.URL)
	require.Equal(t, knowledge.FilePath, payload.FilePath)
	require.Equal(t, knowledge.FileName, payload.FileName)
	require.Equal(t, knowledge.FileType, payload.FileType)
}

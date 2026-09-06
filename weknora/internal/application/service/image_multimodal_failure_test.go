package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/Tencent/WeKnora/internal/models/vlm"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/alicebob/miniredis/v2"
	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
)

type multimodalFailureVLM struct {
	ocrText     string
	ocrErr      error
	captionText string
	captionErr  error
}

func (m *multimodalFailureVLM) Predict(_ context.Context, _ [][]byte, prompt string) (string, error) {
	if strings.Contains(prompt, "OCR assistant") || strings.Contains(prompt, "OCR and document layout") {
		return m.ocrText, m.ocrErr
	}
	return m.captionText, m.captionErr
}

func (m *multimodalFailureVLM) GetModelName() string { return "multimodal-failure-test" }
func (m *multimodalFailureVLM) GetModelID() string   { return "multimodal-failure-test" }

type multimodalFailureModelService struct {
	interfaces.ModelService
	model vlm.VLM
}

func (s multimodalFailureModelService) GetVLMModel(context.Context, string) (vlm.VLM, error) {
	return s.model, nil
}

type multimodalFailureKBService struct {
	interfaces.KnowledgeBaseService
	kb *types.KnowledgeBase
}

func (s multimodalFailureKBService) GetKnowledgeBaseByIDOnly(context.Context, string) (*types.KnowledgeBase, error) {
	return s.kb, nil
}

type multimodalFailureTenantRepo struct {
	interfaces.TenantRepository
	tenant *types.Tenant
}

func (r multimodalFailureTenantRepo) GetTenantByID(context.Context, uint64) (*types.Tenant, error) {
	return r.tenant, nil
}

type multimodalFailureFileService struct {
	interfaces.FileService
	data []byte
}

func (s multimodalFailureFileService) GetFile(context.Context, string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(s.data)), nil
}

type multimodalFailureChunkService struct {
	interfaces.ChunkService
	chunks []*types.Chunk
}

func (s *multimodalFailureChunkService) CreateChunks(_ context.Context, chunks []*types.Chunk) error {
	s.chunks = append(s.chunks, chunks...)
	return nil
}

func (s *multimodalFailureChunkService) GetChunkByIDOnly(_ context.Context, id string) (*types.Chunk, error) {
	for _, chunk := range s.chunks {
		if chunk.ID == id {
			return chunk, nil
		}
	}
	return nil, fmt.Errorf("chunk %s not found", id)
}

func (s *multimodalFailureChunkService) UpdateChunk(_ context.Context, _ *types.Chunk) error {
	return nil
}

type multimodalFailureTaskEnqueuer struct {
	interfaces.TaskEnqueuer
	tasks []*asynq.Task
}

func (e *multimodalFailureTaskEnqueuer) Enqueue(task *asynq.Task, _ ...asynq.Option) (*asynq.TaskInfo, error) {
	e.tasks = append(e.tasks, task)
	return &asynq.TaskInfo{ID: "post-process"}, nil
}

func newMultimodalFailureService(model vlm.VLM, chunks *multimodalFailureChunkService) *ImageMultimodalService {
	kb := &types.KnowledgeBase{
		ID:        "kb-1",
		VLMConfig: types.VLMConfig{Enabled: true, ModelID: "vlm-1"},
	}
	return &ImageMultimodalService{
		chunkService: chunks,
		modelService: multimodalFailureModelService{model: model},
		kbService:    multimodalFailureKBService{kb: kb},
		tenantRepo:   multimodalFailureTenantRepo{tenant: &types.Tenant{ID: 1}},
		fileSvc:      multimodalFailureFileService{data: []byte("not-really-an-image")},
	}
}

func multimodalFailureTask(t *testing.T) *asynq.Task {
	t.Helper()
	payload, err := json.Marshal(types.ImageMultimodalPayload{
		TenantID:        1,
		KnowledgeID:     "knowledge-1",
		KnowledgeBaseID: "kb-1",
		ChunkID:         "chunk-1",
		ImageURL:        "local://image.png",
		EnableOCR:       true,
		EnableCaption:   true,
	})
	if err != nil {
		t.Fatal(err)
	}
	return asynq.NewTask(types.TypeImageMultimodal, payload)
}

func TestImageMultimodalHandleReturnsErrorWhenOCRAndCaptionFail(t *testing.T) {
	t.Parallel()
	modelErr := errors.New("OpenAI VLM response contained no choices")
	chunks := &multimodalFailureChunkService{}
	svc := newMultimodalFailureService(&multimodalFailureVLM{
		ocrErr:     modelErr,
		captionErr: modelErr,
	}, chunks)

	err := svc.Handle(context.Background(), multimodalFailureTask(t))
	if err == nil {
		t.Fatal("expected handler to return an error when both VLM calls fail")
	}
	if !strings.Contains(err.Error(), "image multimodal extraction failed") {
		t.Fatalf("error = %q, want extraction failure", err)
	}
	if len(chunks.chunks) != 0 {
		t.Fatalf("created %d chunks after two failed VLM calls, want 0", len(chunks.chunks))
	}
}

func TestImageMultimodalHandlePersistsSuccessfulCaptionWhenOCRFails(t *testing.T) {
	t.Parallel()
	modelErr := errors.New("OCR unavailable")
	chunks := &multimodalFailureChunkService{}
	svc := newMultimodalFailureService(&multimodalFailureVLM{
		ocrErr:      modelErr,
		captionText: "A useful caption",
	}, chunks)

	if err := svc.Handle(context.Background(), multimodalFailureTask(t)); err != nil {
		t.Fatalf("handler returned error with a successful caption: %v", err)
	}
	if len(chunks.chunks) != 1 {
		t.Fatalf("created %d chunks, want one caption chunk", len(chunks.chunks))
	}
	chunk := chunks.chunks[0]
	if chunk.ChunkType != types.ChunkTypeImageCaption || chunk.Content != "A useful caption" {
		t.Fatalf("created chunk = %+v, want caption content", chunk)
	}
	if chunk.ParentChunkID != "chunk-1" || !chunk.IsEnabled {
		t.Fatalf("created chunk parent/enabled = %q/%v, want chunk-1/true", chunk.ParentChunkID, chunk.IsEnabled)
	}
}

func TestImageMultimodalHandleAllowsEmptyImageWithoutVLMError(t *testing.T) {
	t.Parallel()
	chunks := &multimodalFailureChunkService{}
	svc := newMultimodalFailureService(&multimodalFailureVLM{
		ocrText:     "No text content.",
		captionText: "",
	}, chunks)

	if err := svc.Handle(context.Background(), multimodalFailureTask(t)); err != nil {
		t.Fatalf("empty image should be treated as a successful no-content result: %v", err)
	}
	if len(chunks.chunks) != 0 {
		t.Fatalf("created %d chunks for an empty image, want 0", len(chunks.chunks))
	}
}

func TestImageMultimodalHandleFinalFailedAttemptFinalizesPendingCounter(t *testing.T) {
	t.Parallel()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis: %v", err)
	}
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	modelErr := errors.New("OpenAI VLM response contained no choices")
	chunks := &multimodalFailureChunkService{}
	enqueuer := &multimodalFailureTaskEnqueuer{}
	svc := newMultimodalFailureService(&multimodalFailureVLM{
		ocrErr:     modelErr,
		captionErr: modelErr,
	}, chunks)
	svc.redisClient = rdb
	svc.taskEnqueuer = enqueuer

	const redisKey = "multimodal:pending:knowledge-1"
	if err := rdb.Set(context.Background(), redisKey, 1, 0).Err(); err != nil {
		t.Fatal(err)
	}
	ctx := types.WithTaskRetryMetadata(context.Background(), 3, 3)
	err = svc.Handle(ctx, multimodalFailureTask(t))
	if err == nil {
		t.Fatal("expected final failed attempt to return the VLM error")
	}
	if mr.Exists(redisKey) {
		t.Fatal("final failed attempt should consume the pending image counter")
	}
	if len(enqueuer.tasks) != 1 || enqueuer.tasks[0].Type() != types.TypeKnowledgePostProcess {
		t.Fatalf("post-process enqueue = %d tasks, want one", len(enqueuer.tasks))
	}
}

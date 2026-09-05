package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
)

type videoResourceCatalogStub struct {
	interfaces.ResourceCatalog
	physical string
	resource *types.StoredResource
	err      error
}

func (s *videoResourceCatalogStub) ResolvePath(
	_ context.Context,
	_ string,
) (string, *types.StoredResource, error) {
	return s.physical, s.resource, s.err
}

func TestVideoURLSourcePathUsesPhysicalObjectForResource(t *testing.T) {
	ref := types.BuildResourcePath(strings.Repeat("a", types.ResourceHandleLength))
	physical := "storage://backend-1/s3://bucket/videos/source.mp4"
	svc := &knowledgeService{resourceCatalog: &videoResourceCatalogStub{
		physical: physical,
		resource: &types.StoredResource{PhysicalPath: physical},
	}}

	got, err := svc.videoURLSourcePath(context.Background(), ref)
	if err != nil {
		t.Fatalf("videoURLSourcePath() error = %v", err)
	}
	if got != physical {
		t.Fatalf("videoURLSourcePath() = %q, want %q", got, physical)
	}
}

func TestVideoURLSourcePathLeavesDirectStoragePathUnchanged(t *testing.T) {
	direct := "storage://backend-1/s3://bucket/videos/source.mp4"
	svc := &knowledgeService{resourceCatalog: &videoResourceCatalogStub{
		err: errors.New("must not resolve a direct path"),
	}}

	got, err := svc.videoURLSourcePath(context.Background(), direct)
	if err != nil {
		t.Fatalf("videoURLSourcePath() error = %v", err)
	}
	if got != direct {
		t.Fatalf("videoURLSourcePath() = %q, want %q", got, direct)
	}
}

func TestVideoURLSourcePathRejectsProxyFallbackWhenResourceResolutionFails(t *testing.T) {
	ref := types.BuildResourcePath(strings.Repeat("b", types.ResourceHandleLength))
	svc := &knowledgeService{resourceCatalog: &videoResourceCatalogStub{
		err: errors.New("catalog unavailable"),
	}}

	if got, err := svc.videoURLSourcePath(context.Background(), ref); err == nil || got != "" {
		t.Fatalf("videoURLSourcePath() = (%q, %v), want empty path and error", got, err)
	}
}

func TestVideoURLSourcePathRejectsNestedResourceHandle(t *testing.T) {
	ref := types.BuildResourcePath(strings.Repeat("c", types.ResourceHandleLength))
	nested := types.BuildResourcePath(strings.Repeat("d", types.ResourceHandleLength))
	svc := &knowledgeService{resourceCatalog: &videoResourceCatalogStub{
		physical: nested,
		resource: &types.StoredResource{PhysicalPath: nested},
	}}

	if got, err := svc.videoURLSourcePath(context.Background(), ref); err == nil || got != "" {
		t.Fatalf("videoURLSourcePath() = (%q, %v), want empty path and error", got, err)
	}
}

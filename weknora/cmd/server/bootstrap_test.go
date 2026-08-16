package main

import (
	"context"
	"errors"
	"testing"

	apprepo "github.com/Tencent/WeKnora/internal/application/repository"
	"github.com/Tencent/WeKnora/internal/types"
)

type bootstrapUserStub struct {
	user       *types.User
	lookupErr  error
	listErr    error
	updateErr  error
	adminCount int64
}

func (s *bootstrapUserStub) GetUserByEmail(context.Context, string) (*types.User, error) {
	return s.user, s.lookupErr
}

func (s *bootstrapUserStub) ListSystemAdmins(context.Context, int, int) ([]*types.User, int64, error) {
	return nil, s.adminCount, s.listErr
}

func (s *bootstrapUserStub) UpdateUser(context.Context, *types.User) error { return s.updateErr }

func TestBootstrapSystemAdminStrictOnlyTreatsUnregisteredUserAsNonFatal(t *testing.T) {
	if err := bootstrapSystemAdminStrict(context.Background(), &bootstrapUserStub{lookupErr: apprepo.ErrUserNotFound}, "new@example.com"); err != nil {
		t.Fatalf("unregistered user should be explicitly non-fatal: %v", err)
	}

	want := errors.New("database unavailable")
	if err := bootstrapSystemAdminStrict(context.Background(), &bootstrapUserStub{lookupErr: want}, "ops@example.com"); !errors.Is(err, want) {
		t.Fatalf("lookup infrastructure error = %v, want wrapped %v", err, want)
	}
}

func TestBootstrapSystemAdminStrictPropagatesVerificationAndMutationErrors(t *testing.T) {
	user := &types.User{ID: "u1", Email: "ops@example.com"}
	wantList := errors.New("list admins failed")
	if err := bootstrapSystemAdminStrict(context.Background(), &bootstrapUserStub{user: user, listErr: wantList}, user.Email); !errors.Is(err, wantList) {
		t.Fatalf("admin verification error = %v, want wrapped %v", err, wantList)
	}

	wantUpdate := errors.New("promotion failed")
	if err := bootstrapSystemAdminStrict(context.Background(), &bootstrapUserStub{user: user, updateErr: wantUpdate}, user.Email); !errors.Is(err, wantUpdate) {
		t.Fatalf("promotion error = %v, want wrapped %v", err, wantUpdate)
	}
}

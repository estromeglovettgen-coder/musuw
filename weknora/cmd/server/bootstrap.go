// Bootstrap-time hooks that run after the DI container is built but
// before the HTTP server starts listening. These are deliberately
// best-effort: any failure here only warns and does NOT abort startup.
// The reasoning is that an operator running with a misconfigured env
// var should still be able to bring the server up (and fix the issue
// from the running instance) rather than have a typo brick the deploy.
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"go.uber.org/dig"
	"gorm.io/gorm"

	apprepo "github.com/Tencent/WeKnora/internal/application/repository"
	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
)

// bootstrapEnvVar is the env var that names the email of the user who
// may be promoted to system administrator when the deployment has no
// existing system administrators.
//
// Why an env var (vs a CLI subcommand)?
//   - Zero-friction in docker-compose / k8s deploys: set it once in the
//     manifest and the very first user account that signs up with that
//     email is auto-promoted, with no extra ops step.
//   - Idempotent: if the user is already a system admin, bootstrapping is
//     a no-op.
//   - Safe to leave set: once at least one system admin exists, the env
//     var stops granting privileges. That prevents a UI revoke from being
//     silently undone on the next restart.
const bootstrapEnvVar = "WEKNORA_BOOTSTRAP_SYSTEM_ADMIN_EMAIL"

// runStartupBootstrap consults the env and applies any one-shot
// bootstrap actions. Currently it only handles system-admin promotion;
// future bootstrap steps (default model seeding, etc.) can be added
// here as additional dig.Invoke calls.
func runStartupBootstrap(c *dig.Container) {
	if err := runStartupBootstrapStrict(c); err != nil {
		logger.Warnf(context.Background(), "[bootstrap] startup bootstrap failed: %v", err)
	}
}

// runStartupBootstrapStrict executes every independent bootstrap step and
// returns the aggregate error. Prepare uses this contract so a partial
// bootstrap can never be reported as a successful release preparation; the
// historical all role calls the best-effort wrapper above.
func runStartupBootstrapStrict(c *dig.Container) error {
	ctx := context.Background()
	var errs error

	// Legacy hash repair for migration 000065 placeholder rows. Invoked each
	// startup but short-circuits with a cheap EXISTS once every row is
	// backfilled (no api_key decryption on the steady-state path).
	if err := c.Invoke(func(apiKeySvc interfaces.TenantAPIKeyService) error {
		if n, err := apiKeySvc.BackfillMissingKeyHashes(ctx); err != nil {
			return fmt.Errorf("tenant api key hash backfill: %w", err)
		} else if n > 0 {
			logger.Infof(ctx, "[bootstrap] backfilled %d legacy tenant api key hash(es)", n)
		}
		return nil
	}); err != nil {
		errs = errors.Join(errs, fmt.Errorf("resolve/backfill TenantAPIKeyService: %w", err))
	}

	email := strings.TrimSpace(os.Getenv(bootstrapEnvVar))
	if email == "" {
		return errs
	}
	// dig.Invoke resolves UserService from the container; if user
	// service registration is broken we want to know loudly, but still
	// not abort startup — bootstrap is best-effort.
	if err := c.Invoke(func(userSvc interfaces.UserService) error {
		return bootstrapSystemAdminStrict(ctx, userSvc, email)
	}); err != nil {
		errs = errors.Join(errs, fmt.Errorf("resolve/bootstrap UserService: %w", err))
	}
	return errs
}

type bootstrapUserService interface {
	GetUserByEmail(ctx context.Context, email string) (*types.User, error)
	ListSystemAdmins(ctx context.Context, offset, limit int) ([]*types.User, int64, error)
	UpdateUser(ctx context.Context, user *types.User) error
}

// bootstrapSystemAdmin promotes the user identified by `email` to system
// administrator only when the deployment currently has no system admins.
// The function is idempotent and non-fatal — it warns and returns on
// every error path.
//
// The bootstrap intentionally does NOT create a user when the email is
// not yet registered: account creation is a workflow with side effects
// (password hashing, tenant assignment, audit) that we don't want to
// short-circuit. Operators should sign up normally first, then set the
// env var on the next restart.
func bootstrapSystemAdmin(ctx context.Context, userSvc interfaces.UserService, email string) {
	if err := bootstrapSystemAdminStrict(ctx, userSvc, email); err != nil {
		logger.Warnf(ctx, "[bootstrap] %s=%s failed: %v", bootstrapEnvVar, email, err)
	}
}

func bootstrapSystemAdminStrict(ctx context.Context, userSvc bootstrapUserService, email string) error {
	user, err := userSvc.GetUserByEmail(ctx, email)
	if err != nil {
		// The only explicit non-fatal strict-bootstrap error is a user that
		// has not registered yet. Every infrastructure/query error must fail
		// prepare rather than masquerade as this ordinary bootstrap state.
		if errors.Is(err, apprepo.ErrUserNotFound) || errors.Is(err, gorm.ErrRecordNotFound) {
			logger.Warnf(ctx, "[bootstrap] %s=%s: user is not registered; skipping promotion", bootstrapEnvVar, email)
			return nil
		}
		return fmt.Errorf("lookup bootstrap user %s: %w", email, err)
	}
	if user == nil {
		logger.Warnf(ctx,
			"[bootstrap] %s=%s: no matching user (will retry on next restart)",
			bootstrapEnvVar, email)
		return nil
	}
	if user.IsSystemAdmin {
		logger.Infof(ctx,
			"[bootstrap] %s=%s: user %s is already a system admin (no-op)",
			bootstrapEnvVar, email, user.ID)
		return nil
	}
	_, total, err := userSvc.ListSystemAdmins(ctx, 0, 1)
	if err != nil {
		logger.Warnf(ctx,
			"[bootstrap] %s=%s: cannot verify existing system admins, skipping promotion: %v",
			bootstrapEnvVar, email, err)
		return fmt.Errorf("verify existing system admins: %w", err)
	}
	if total > 0 {
		logger.Infof(ctx,
			"[bootstrap] %s=%s: %d system admin(s) already exist; not promoting user %s",
			bootstrapEnvVar, email, total, user.ID)
		return nil
	}
	user.IsSystemAdmin = true
	if err := userSvc.UpdateUser(ctx, user); err != nil {
		logger.Warnf(ctx,
			"[bootstrap] %s=%s: failed to promote user %s: %v",
			bootstrapEnvVar, email, user.ID, err)
		return fmt.Errorf("promote user %s: %w", user.ID, err)
	}
	logger.Infof(ctx,
		"[bootstrap] promoted user %s (%s) to system admin via %s",
		user.ID, email, bootstrapEnvVar)
	return nil
}

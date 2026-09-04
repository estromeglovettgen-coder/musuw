package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	apprepo "github.com/Tencent/WeKnora/internal/application/repository"
	"github.com/Tencent/WeKnora/internal/logger"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/hibiken/asynq"
)

var (
	ErrAccountErasureIneligible       = errors.New("account is not eligible for managed deletion")
	ErrAccountIdentityBindingRequired = errors.New("verified identity binding is required before account deletion")
	ErrAccountErasureCleanupPending   = errors.New("account cleanup is still pending")
	// ErrAccountErasureBillingPending means local access/content cleanup has
	// completed, but the provider has not confirmed cancellation or an
	// authoritative terminal/not-found state. The fenced tenant remains as the
	// durable billing coordinate until a later worker retry gets that evidence.
	ErrAccountErasureBillingPending = errors.New("account billing cancellation is still pending")
)

const (
	accountErasureTaskMaxRetry = 25
	accountErasureTaskTimeout  = 2 * time.Hour
	accountErasureRecoveryPage = 100
)

type accountErasureService struct {
	repo      interfaces.AccountErasureRepository
	knowledge interfaces.KnowledgeBaseService
	files     interfaces.FileService
	tenants   interfaces.TenantService
	tasks     interfaces.TaskEnqueuer
	inspector interfaces.TaskInspector
	billing   accountBillingGuard
	identity  accountIdentityAdmin
	now       func() time.Time
}

// accountErasureFileDeleter is implemented by the concrete knowledge service,
// which owns the tenant-aware catalog and storage-backend resolution seam.
// Keeping it private prevents alternate coordinators from bypassing that
// routing contract with the process-wide default FileService.
type accountErasureFileDeleter interface {
	deleteFileForAccountErasure(ctx context.Context, tenantID uint64, reference string) error
}

var _ accountErasureFileDeleter = (*knowledgeBaseService)(nil)

func NewAccountErasureService(
	repo interfaces.AccountErasureRepository,
	knowledge interfaces.KnowledgeBaseService,
	files interfaces.FileService,
	tenants interfaces.TenantService,
	tasks interfaces.TaskEnqueuer,
	inspector interfaces.TaskInspector,
	billing accountBillingGuard,
	identity accountIdentityAdmin,
) interfaces.AccountErasureService {
	return newAccountErasureService(repo, knowledge, files, tenants, tasks, inspector, billing, identity)
}

func newAccountErasureService(
	repo interfaces.AccountErasureRepository,
	knowledge interfaces.KnowledgeBaseService,
	files interfaces.FileService,
	tenants interfaces.TenantService,
	tasks interfaces.TaskEnqueuer,
	inspector interfaces.TaskInspector,
	billing accountBillingGuard,
	identity accountIdentityAdmin,
) *accountErasureService {
	return &accountErasureService{
		repo: repo, knowledge: knowledge, files: files, tenants: tenants, tasks: tasks, inspector: inspector,
		billing: billing, identity: identity, now: time.Now,
	}
}

func validateAccountErasureEligibility(target *types.AccountErasureTarget) error {
	return validateAccountErasureEligibilityForPhase(target, false)
}

func validateAccountErasureEligibilityForPhase(target *types.AccountErasureTarget, allowDeletedTenantRetry bool) error {
	if target == nil || strings.TrimSpace(target.UserID) == "" || target.TenantID == 0 {
		return fmt.Errorf("%w: personal workspace is unavailable", ErrAccountErasureIneligible)
	}
	if target.IsSystemAdmin {
		return fmt.Errorf("%w: system administrators must transfer their role first", ErrAccountErasureIneligible)
	}
	ownerCountValid := target.OwnerTenantCount == 1
	if allowDeletedTenantRetry && target.IsDeletionPending && target.IsTenantDeleted && target.OwnerTenantCount == 0 {
		ownerCountValid = true
	}
	if !ownerCountValid {
		return fmt.Errorf("%w: account must own exactly one personal workspace", ErrAccountErasureIneligible)
	}
	if target.SharedMemberCount > 0 {
		return fmt.Errorf("%w: another member depends on the personal workspace", ErrAccountErasureIneligible)
	}
	if target.OrganizationOwnerCount > 0 {
		return fmt.Errorf("%w: organization ownership must be transferred first", ErrAccountErasureIneligible)
	}
	provider := strings.ToLower(strings.TrimSpace(target.IdentityProvider))
	subject := strings.TrimSpace(target.IdentitySubject)
	if (provider == "") != (subject == "") {
		return ErrAccountIdentityBindingRequired
	}
	if provider != "" && provider != "supabase" {
		return fmt.Errorf("%w: external OIDC provider has no configured deletion adapter", ErrAccountIdentityDeletionUnavailable)
	}
	return nil
}

// Request accepts only the opaque ID selected by the authorized operations
// control plane. Provider and billing coordinates are loaded server-side and
// never accepted from the browser.
func (s *accountErasureService) Request(ctx context.Context, userID string) error {
	if s == nil || s.repo == nil {
		return errors.New("account erasure repository is unavailable")
	}
	target, err := s.repo.Preflight(ctx, strings.TrimSpace(userID))
	if err != nil {
		return fmt.Errorf("load account deletion preflight: %w", err)
	}
	if err := validateAccountErasureEligibility(target); err != nil {
		return err
	}
	if err := s.resolveAndBindIdentity(ctx, target); err != nil {
		return err
	}
	// Fence local access before touching Paddle. Billing cancellation is a
	// separate follow-up: a past_due or otherwise non-cancellable provider
	// subscription must never leave the Musuw account usable or make this
	// deletion request fail. The worker retries this best-effort preparation
	// while local content cleanup remains the authoritative lifecycle.
	requestedAt := s.now().UTC()
	if err := s.repo.Fence(ctx, target.UserID, requestedAt); err != nil {
		return fmt.Errorf("fence account deletion: %w", err)
	}
	s.prepareBillingCancellationBestEffort(ctx, target)
	if err := s.enqueue(ctx, target.UserID); err != nil {
		// The durable deletion_requested_at fence is the outbox. Housekeeping
		// will enqueue the same deterministic task; returning success here avoids
		// telling a user to keep using an account whose tokens are already revoked.
		logger.Errorf(ctx, "Account deletion task enqueue deferred: %v", err)
	}
	return nil
}

// prepareBillingCancellationBestEffort keeps provider cancellation independent
// from the local erasure fence. Paddle may require hosted billing recovery
// (past_due) or be temporarily unavailable; either condition is logged for
// operations/retry visibility but cannot block revoking access or deleting
// active Musuw content. If preparation fails, the worker keeps the provider
// coordinates durable until a later retry confirms cancellation or not-found.
// The provider guard remains idempotent, so invoking it from both Request and a
// retried worker is safe.
func (s *accountErasureService) prepareBillingCancellationBestEffort(
	ctx context.Context,
	target *types.AccountErasureTarget,
) {
	if s == nil || target == nil {
		return
	}
	customerID := strings.TrimSpace(target.PaddleCustomerID)
	subscriptionID := strings.TrimSpace(target.PaddleSubscriptionID)
	if customerID == "" && subscriptionID == "" {
		return
	}
	if err := s.prepareBillingCancellation(ctx, customerID, subscriptionID); err != nil {
		logger.Warnf(ctx,
			"Account billing cancellation deferred after local erasure fence customer=%t subscription=%t: %v",
			customerID != "", subscriptionID != "", err,
		)
	}
}

// prepareBillingCancellation returns the provider result for the worker while
// keeping Request's user-facing contract best-effort. Provider coordinates are
// loaded from the fenced tenant; they are never serialized into the task.
func (s *accountErasureService) prepareBillingCancellation(
	ctx context.Context,
	customerID,
	subscriptionID string,
) error {
	if strings.TrimSpace(customerID) == "" && strings.TrimSpace(subscriptionID) == "" {
		return nil
	}
	if s == nil || s.billing == nil {
		return ErrAccountBillingUnavailable
	}
	return s.billing.PrepareAccountDeletion(ctx, strings.TrimSpace(customerID), strings.TrimSpace(subscriptionID))
}

func (s *accountErasureService) ensureBillingTerminal(
	ctx context.Context,
	customerID,
	subscriptionID string,
) error {
	if strings.TrimSpace(customerID) == "" && strings.TrimSpace(subscriptionID) == "" {
		return nil
	}
	if s == nil || s.billing == nil {
		return ErrAccountBillingUnavailable
	}
	return s.billing.EnsureAccountTerminal(ctx, strings.TrimSpace(customerID), strings.TrimSpace(subscriptionID))
}

func accountErasureBillingPendingError(preparationErr, terminalErr error) error {
	errs := []error{ErrAccountErasureBillingPending}
	if preparationErr != nil {
		errs = append(errs, preparationErr)
	}
	if terminalErr != nil {
		errs = append(errs, terminalErr)
	}
	return errors.Join(errs...)
}

func (s *accountErasureService) resolveAndBindIdentity(ctx context.Context, target *types.AccountErasureTarget) error {
	if target == nil {
		return ErrAccountIdentityBindingRequired
	}
	hasIdentity := strings.TrimSpace(target.IdentityProvider) != "" || strings.TrimSpace(target.IdentitySubject) != ""
	if s.identity == nil {
		if hasIdentity {
			return ErrAccountIdentityDeletionUnavailable
		}
		return nil
	}
	provider, subject, err := s.identity.ResolveIdentityDeletion(
		ctx, target.IdentityProvider, target.IdentitySubject, target.Email,
	)
	if err != nil {
		return err
	}
	provider = strings.ToLower(strings.TrimSpace(provider))
	subject = strings.TrimSpace(subject)
	if provider == "" && subject == "" {
		return nil
	}
	if provider == "" || subject == "" {
		return ErrAccountIdentityBindingRequired
	}
	if provider == strings.ToLower(strings.TrimSpace(target.IdentityProvider)) &&
		subject == strings.TrimSpace(target.IdentitySubject) {
		return nil
	}
	if err := s.repo.BindIdentity(ctx, target.UserID, provider, subject); err != nil {
		if errors.Is(err, types.ErrAccountErasureIdentityConflict) {
			return fmt.Errorf("%w: resolved identity conflicts with the stored account", ErrAccountIdentityBindingRequired)
		}
		return fmt.Errorf("persist resolved external identity: %w", err)
	}
	target.IdentityProvider = provider
	target.IdentitySubject = subject
	return nil
}

func NewAccountErasureTask(userID string) (*asynq.Task, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, errors.New("account erasure user ID is required")
	}
	body, err := json.Marshal(types.AccountErasureTaskPayload{UserID: userID})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(types.TypeAccountErasure, body), nil
}

func accountErasureTaskID(userID string) string {
	return "account-erasure:" + strings.TrimSpace(userID)
}

func (s *accountErasureService) enqueue(ctx context.Context, userID string) error {
	if s == nil || s.tasks == nil {
		return errors.New("account erasure task backend is unavailable")
	}
	task, err := NewAccountErasureTask(userID)
	if err != nil {
		return err
	}
	_, err = s.tasks.Enqueue(task,
		asynq.Queue(types.QueueMaintenance),
		asynq.MaxRetry(accountErasureTaskMaxRetry),
		asynq.Timeout(accountErasureTaskTimeout),
		asynq.TaskID(accountErasureTaskID(userID)),
	)
	if errors.Is(err, asynq.ErrTaskIDConflict) {
		return replaceArchivedDeterministicTask(ctx, s.tasks, s.inspector, task,
			types.QueueMaintenance, accountErasureTaskID(userID),
			asynq.Queue(types.QueueMaintenance),
			asynq.MaxRetry(accountErasureTaskMaxRetry),
			asynq.Timeout(accountErasureTaskTimeout),
			asynq.TaskID(accountErasureTaskID(userID)),
		)
	}
	return err
}

// replaceArchivedDeterministicTask keeps one durable task identity without
// letting Asynq's archived-ID retention permanently block recovery. Live
// pending/retry/active tasks are left alone. An archived task is deleted and
// recreated with the same ID so its retry budget starts fresh; the caller's
// durable database fence remains the source of truth if re-enqueueing fails.
func replaceArchivedDeterministicTask(
	ctx context.Context,
	enqueuer interfaces.TaskEnqueuer,
	inspector interfaces.TaskInspector,
	task *asynq.Task,
	queue string,
	taskID string,
	opts ...asynq.Option,
) error {
	runtimeInspector, ok := inspector.(interfaces.RuntimeTaskInspector)
	if !ok {
		// Lite's synchronous executor only reports conflicts for an in-flight
		// goroutine and retains no archived task, so there is nothing to recover.
		return nil
	}
	info, supported, err := runtimeInspector.GetRuntimeTask(ctx, queue, taskID)
	if err != nil {
		return fmt.Errorf("inspect deterministic task conflict: %w", err)
	}
	if !supported || info == nil || info.State != types.RuntimeTaskArchived {
		return nil
	}
	deleted, err := runtimeInspector.DeleteRuntimeTask(ctx, queue, taskID)
	if err != nil {
		return fmt.Errorf("delete archived deterministic task: %w", err)
	}
	if !deleted {
		return errors.New("archived deterministic task backend is unavailable")
	}
	if enqueuer == nil {
		return errors.New("deterministic task backend is unavailable")
	}
	if _, err := enqueuer.Enqueue(task, opts...); err != nil {
		return fmt.Errorf("re-enqueue archived deterministic task: %w", err)
	}
	return nil
}

// RecoverPending is the small durable-outbox recovery seam used by the
// existing housekeeping sweep. It creates no second queue or job state table.
func (s *accountErasureService) RecoverPending(ctx context.Context) error {
	if s == nil || s.repo == nil {
		return errors.New("account erasure repository is unavailable")
	}
	pending, err := s.repo.ListPending(ctx, accountErasureRecoveryPage)
	if err != nil {
		return fmt.Errorf("list pending account deletions: %w", err)
	}
	var enqueueErr error
	for _, target := range pending {
		if target == nil || strings.TrimSpace(target.UserID) == "" {
			continue
		}
		if err := s.enqueue(ctx, target.UserID); err != nil {
			enqueueErr = errors.Join(enqueueErr, err)
		}
	}
	return enqueueErr
}

func accountErasureContext(ctx context.Context, target *types.AccountErasureTarget, tenant *types.Tenant) context.Context {
	ctx = context.WithValue(ctx, types.TenantIDContextKey, target.TenantID)
	ctx = context.WithValue(ctx, types.UserIDContextKey, target.UserID)
	ctx = context.WithValue(ctx, types.UserContextKey, &types.User{
		ID: target.UserID, Email: target.Email, TenantID: target.TenantID,
	})
	if tenant != nil {
		ctx = context.WithValue(ctx, types.TenantInfoContextKey, tenant)
	}
	return ctx
}

// Process coordinates existing deletion seams. It intentionally stops after
// requesting KB cleanup and retries later; the KB worker's active knowledge
// rows are the durable proof that vector/file/graph cleanup has not completed.
func (s *accountErasureService) Process(ctx context.Context, task *asynq.Task) error {
	if s == nil || s.repo == nil || task == nil {
		return errors.New("invalid account erasure task")
	}
	var payload types.AccountErasureTaskPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return fmt.Errorf("decode account erasure task: %w", err)
	}
	payload.UserID = strings.TrimSpace(payload.UserID)
	if payload.UserID == "" {
		return errors.New("account erasure task has no user ID")
	}
	target, err := s.repo.Preflight(ctx, payload.UserID)
	if err != nil {
		return fmt.Errorf("reload account deletion target: %w", err)
	}
	if err := validateAccountErasureEligibilityForPhase(target, true); err != nil {
		return err
	}
	if !target.IsDeletionPending {
		return errors.New("account erasure task target is not fenced")
	}
	// Provider cancellation is deliberately independent from the local fence.
	// Retry the idempotent cancellation request, but retain its result so the
	// final tenant purge can keep provider coordinates durable until Paddle has
	// confirmed cancellation (or an authoritative not-found).
	billingPreparationErr := s.prepareBillingCancellation(
		ctx,
		strings.TrimSpace(target.PaddleCustomerID),
		strings.TrimSpace(target.PaddleSubscriptionID),
	)
	if billingPreparationErr != nil {
		logger.Warnf(ctx, "Account billing cancellation preparation deferred: %v", billingPreparationErr)
	}
	if err := s.resolveAndBindIdentity(ctx, target); err != nil {
		return err
	}

	if s.knowledge == nil || s.tenants == nil {
		return errors.New("account erasure lifecycle services are unavailable")
	}
	tenant, err := s.tenants.GetTenantByID(ctx, target.TenantID)
	if err != nil {
		// A missing tenant is expected after a retry that already completed the
		// tenant lifecycle. Every other lookup failure is transient or
		// otherwise actionable and must stop the purge rather than silently
		// proceeding without the tenant context.
		if !errors.Is(err, apprepo.ErrTenantNotFound) {
			return fmt.Errorf("load personal workspace: %w", err)
		}
		tenant = nil
	}
	lifecycleCtx := accountErasureContext(ctx, target, tenant)
	kbs, err := s.knowledge.ListKnowledgeBasesByTenantID(lifecycleCtx, target.TenantID)
	if err != nil {
		return fmt.Errorf("list personal workspace knowledge bases: %w", err)
	}
	if len(kbs) > 0 {
		strictDeleter, ok := s.knowledge.(interfaces.StrictKnowledgeBaseDeleter)
		if !ok {
			return errors.New("strict knowledge-base deletion is unavailable")
		}
		for _, kb := range kbs {
			if kb == nil || strings.TrimSpace(kb.ID) == "" {
				continue
			}
			if err := strictDeleter.DeleteKnowledgeBaseForAccountErasure(lifecycleCtx, kb.ID); err != nil {
				return fmt.Errorf("request knowledge-base cleanup: %w", err)
			}
		}
		return ErrAccountErasureCleanupPending
	}
	remaining, err := s.repo.RemainingActiveKnowledgeCount(lifecycleCtx, target.TenantID)
	if err != nil {
		return fmt.Errorf("verify knowledge cleanup: %w", err)
	}
	if remaining > 0 {
		return ErrAccountErasureCleanupPending
	}
	resourceRefs, err := s.repo.ListActiveResourceReferences(lifecycleCtx, target.TenantID)
	if err != nil {
		return fmt.Errorf("list remaining account resources: %w", err)
	}
	fileDeleter, routed := s.knowledge.(accountErasureFileDeleter)
	if len(resourceRefs) > 0 && !routed {
		return errors.New("account erasure tenant-aware file deletion is unavailable")
	}
	for _, resourceRef := range resourceRefs {
		if err := fileDeleter.deleteFileForAccountErasure(lifecycleCtx, target.TenantID, resourceRef); err != nil {
			return fmt.Errorf("delete remaining account resource: %w", err)
		}
	}

	// Re-check ownership immediately before the existing tenant lifecycle
	// removes memberships and the provider child key. This catches changes
	// made after the original HTTP request without inventing another state
	// machine.
	latest, err := s.repo.Preflight(ctx, payload.UserID)
	if err != nil {
		return fmt.Errorf("revalidate account deletion target: %w", err)
	}
	if err := validateAccountErasureEligibilityForPhase(latest, true); err != nil {
		return err
	}
	target = latest
	lifecycleCtx = accountErasureContext(ctx, target, tenant)
	// A successful Prepare is the provider's confirmation that cancellation was
	// scheduled (or that no cancellation is required), so do not retain account
	// data until the subscription reaches period-end. When preparation failed,
	// perform the terminal/not-found read as a recovery shortcut; otherwise keep
	// the billing coordinates durable for the next task retry. The fenced user
	// cannot regain access while this follow-up is pending.
	if billingPreparationErr != nil {
		billingTerminalErr := s.ensureBillingTerminal(
			ctx,
			strings.TrimSpace(target.PaddleCustomerID),
			strings.TrimSpace(target.PaddleSubscriptionID),
		)
		if billingTerminalErr != nil {
			logger.Warnf(ctx, "Account billing cancellation remains pending: %v", billingTerminalErr)
			return accountErasureBillingPendingError(billingPreparationErr, billingTerminalErr)
		}
	}
	if !target.IsTenantDeleted {
		providerCleaner, ok := s.tenants.(interfaces.AccountErasureTenantProviderCleaner)
		if !ok {
			return errors.New("account tenant provider cleanup is unavailable")
		}
		if err := providerCleaner.DeleteTenantProviderCredentials(lifecycleCtx, target.TenantID); err != nil {
			return fmt.Errorf("delete personal workspace provider key: %w", err)
		}
	}
	if strings.TrimSpace(target.IdentityProvider) != "" || strings.TrimSpace(target.IdentitySubject) != "" {
		if s.identity == nil {
			return ErrAccountIdentityDeletionUnavailable
		}
		if err := s.identity.ValidateIdentityDeletion(target.IdentityProvider, target.IdentitySubject); err != nil {
			return err
		}
		if err := s.identity.DeleteIdentity(ctx, target.IdentityProvider, target.IdentitySubject); err != nil {
			return err
		}
	}
	if err := s.repo.Purge(ctx, target); err != nil {
		return fmt.Errorf("purge local account data: %w", err)
	}
	logger.Infof(ctx, "Account deletion completed")
	return nil
}

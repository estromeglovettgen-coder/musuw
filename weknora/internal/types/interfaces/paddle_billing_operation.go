package interfaces

import (
	"context"
	"errors"

	"github.com/Tencent/WeKnora/internal/types"
)

var ErrPaddleBillingOperationKeyConflict = errors.New("paddle billing operation key conflicts with an existing intent")

// PaddleBillingOperationRepository persists the minimum retry boundary around
// a Paddle subscription update. Paddle has no client-supplied idempotency key
// for this API call; standard self-service checkout does not use this store.
type PaddleBillingOperationRepository interface {
	// Claim creates one pending operation, or returns the existing same-key
	// operation/result. A different key receives ClaimActive while another
	// pending/in-flight/uncertain operation occupies the tenant slot.
	Claim(ctx context.Context, intent types.PaddleBillingOperationIntent) (*types.PaddleBillingOperation, types.PaddleBillingOperationClaimDisposition, error)
	// FindByKey lets an HTTP retry reuse the provider request already owned by
	// the same authenticated tenant instead of issuing another mutation.
	FindByKey(ctx context.Context, tenantID uint64, operationKey string) (*types.PaddleBillingOperation, bool, error)
	// MarkInFlight advances a newly claimed (or recoverable uncertain) intent
	// immediately before the provider request.
	MarkInFlight(ctx context.Context, id uint64) error
	// Finish stores a terminal or uncertain outcome. Succeeded/failed release
	// the tenant's active slot; uncertain deliberately keeps it occupied.
	Finish(ctx context.Context, id uint64, status types.PaddleBillingOperationStatus, resultJSON, lastError string) error
	// FinishMatchingActive terminalizes the one active upgrade only when the
	// signed provider event matches its tenant/key/price/subscription identity.
	// It returns false for a mismatched or already-terminal event.
	FinishMatchingActive(ctx context.Context, tenantID uint64, operationType types.PaddleBillingOperationType, operationKey, priceID, subscriptionID string, status types.PaddleBillingOperationStatus, resultJSON, lastError string) (bool, error)
}

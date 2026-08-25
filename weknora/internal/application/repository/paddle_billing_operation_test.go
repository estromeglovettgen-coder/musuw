package repository

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupPaddleBillingOperationDB(t *testing.T) (*gorm.DB, interfaces.PaddleBillingOperationRepository) {
	t.Helper()
	dsn := fmt.Sprintf("file:paddle_billing_operation_%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	// SQLite has one writer. Keeping one connection makes the concurrent
	// claim tests exercise the repository's transaction/unique-index contract
	// without turning SQLITE_BUSY into a test of the driver pool.
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&types.PaddleBillingOperation{}))
	require.NoError(t, db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS ux_paddle_billing_operations_active_tenant
		ON paddle_billing_operations (tenant_id)
		WHERE status IN ('pending', 'in_flight', 'uncertain')
	`).Error)
	return db, NewPaddleBillingOperationRepository(db)
}

func paddleBillingIntent(tenantID uint64, key string) types.PaddleBillingOperationIntent {
	return types.PaddleBillingOperationIntent{
		TenantID:           tenantID,
		OperationKey:       key,
		OperationType:      types.PaddleBillingOperationCheckout,
		RequestFingerprint: "fingerprint-" + key,
		Plan:               types.ConsumerPlanPlus,
		BillingPeriod:      "monthly",
		PriceID:            "pri_plus_monthly",
	}
}

func TestPaddleBillingOperationClaimAllowsOneActiveOperationPerTenant(t *testing.T) {
	db, repo := setupPaddleBillingOperationDB(t)
	ctx := context.Background()

	first, disposition, err := repo.Claim(ctx, paddleBillingIntent(7, "checkout-1"))
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationClaimCreated, disposition)
	require.NotNil(t, first)

	second, disposition, err := repo.Claim(ctx, paddleBillingIntent(7, "checkout-2"))
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationClaimActive, disposition)
	require.NotNil(t, second)
	assert.Equal(t, first.ID, second.ID)

	var count int64
	require.NoError(t, db.Model(&types.PaddleBillingOperation{}).Where("tenant_id = ?", 7).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestPaddleBillingOperationDuplicateKeyReusesProviderIntentAndResult(t *testing.T) {
	_, repo := setupPaddleBillingOperationDB(t)
	ctx := context.Background()
	intent := paddleBillingIntent(7, "upgrade-1")

	created, disposition, err := repo.Claim(ctx, intent)
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationClaimCreated, disposition)
	require.NoError(t, repo.MarkInFlight(ctx, created.ID))
	require.NoError(t, repo.RecordPaddleTransaction(ctx, created.ID, "txn_123"))
	providerAccepted, err := repo.GetByID(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationInFlight, providerAccepted.Status, "provider acceptance is not entitlement success")
	require.NoError(t, repo.Finish(ctx, created.ID, types.PaddleBillingOperationSucceeded, `{"redirect":"/pay"}`, ""))

	replayed, disposition, err := repo.Claim(ctx, intent)
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationClaimExisting, disposition)
	require.NotNil(t, replayed)
	assert.Equal(t, created.ID, replayed.ID)
	assert.Equal(t, types.PaddleBillingOperationSucceeded, replayed.Status)
	assert.Equal(t, "txn_123", replayed.PaddleTransactionID)
	assert.JSONEq(t, `{"redirect":"/pay"}`, replayed.Result)

	found, ok, err := repo.FindByKey(ctx, intent.TenantID, intent.OperationKey)
	require.NoError(t, err)
	require.True(t, ok)
	assert.Equal(t, created.ID, found.ID)
	_, ok, err = repo.FindByKey(ctx, intent.TenantID, "missing-operation")
	require.NoError(t, err)
	assert.False(t, ok)

	conflicting := intent
	conflicting.PriceID = "pri_other"
	_, _, err = repo.Claim(ctx, conflicting)
	assert.ErrorIs(t, err, ErrPaddleBillingOperationKeyConflict)
}

func TestPaddleBillingOperationTerminalStatesReleaseTenantSlot(t *testing.T) {
	_, repo := setupPaddleBillingOperationDB(t)
	ctx := context.Background()

	completed, _, err := repo.Claim(ctx, paddleBillingIntent(7, "checkout-complete"))
	require.NoError(t, err)
	require.NoError(t, repo.Finish(ctx, completed.ID, types.PaddleBillingOperationSucceeded, `{}`, ""))
	_, disposition, err := repo.Claim(ctx, paddleBillingIntent(7, "checkout-after-complete"))
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationClaimCreated, disposition)

	failed, _, err := repo.Claim(ctx, paddleBillingIntent(8, "checkout-failed"))
	require.NoError(t, err)
	require.NoError(t, repo.Finish(ctx, failed.ID, types.PaddleBillingOperationFailed, `{}`, "provider rejected"))
	_, disposition, err = repo.Claim(ctx, paddleBillingIntent(8, "checkout-after-failed"))
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationClaimCreated, disposition)

	uncertain, _, err := repo.Claim(ctx, paddleBillingIntent(9, "checkout-uncertain"))
	require.NoError(t, err)
	require.NoError(t, repo.Finish(ctx, uncertain.ID, types.PaddleBillingOperationUncertain, `{}`, "network timeout"))
	_, disposition, err = repo.Claim(ctx, paddleBillingIntent(9, "checkout-after-uncertain"))
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationClaimActive, disposition)
}

func TestPaddleBillingOperationConcurrentSameKeyConverges(t *testing.T) {
	_, repo := setupPaddleBillingOperationDB(t)
	ctx := context.Background()
	intent := paddleBillingIntent(7, "concurrent-checkout")

	const callers = 12
	results := make(chan struct {
		op          *types.PaddleBillingOperation
		disposition types.PaddleBillingOperationClaimDisposition
		err         error
	}, callers)
	var wg sync.WaitGroup
	for range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			op, disposition, err := repo.Claim(ctx, intent)
			results <- struct {
				op          *types.PaddleBillingOperation
				disposition types.PaddleBillingOperationClaimDisposition
				err         error
			}{op, disposition, err}
		}()
	}
	wg.Wait()
	close(results)

	var created, existing int
	var id uint64
	for result := range results {
		require.NoError(t, result.err)
		require.NotNil(t, result.op)
		if id == 0 {
			id = result.op.ID
		}
		assert.Equal(t, id, result.op.ID)
		switch result.disposition {
		case types.PaddleBillingOperationClaimCreated:
			created++
		case types.PaddleBillingOperationClaimExisting:
			existing++
		default:
			t.Fatalf("unexpected claim disposition %q", result.disposition)
		}
	}
	assert.Equal(t, 1, created)
	assert.Equal(t, callers-1, existing)
}

func TestPaddleBillingOperationFinishMatchingActiveRequiresProviderIdentity(t *testing.T) {
	_, repo := setupPaddleBillingOperationDB(t)
	ctx := context.Background()

	checkout, _, err := repo.Claim(ctx, paddleBillingIntent(7, "checkout-webhook"))
	require.NoError(t, err)

	matched, err := repo.FinishMatchingActive(ctx, 8, types.PaddleBillingOperationCheckout, "checkout-webhook", "pri_plus_monthly", "sub_wrong_tenant", types.PaddleBillingOperationSucceeded, `{"transaction":"txn_1"}`, "")
	require.NoError(t, err)
	assert.False(t, matched)
	matched, err = repo.FinishMatchingActive(ctx, 7, types.PaddleBillingOperationCheckout, "checkout-webhook", "pri_other", "sub_wrong_price", types.PaddleBillingOperationSucceeded, `{}`, "")
	require.NoError(t, err)
	assert.False(t, matched)
	matched, err = repo.FinishMatchingActive(ctx, 7, types.PaddleBillingOperationCheckout, "old-checkout", checkout.PriceID, "sub_from_activation", types.PaddleBillingOperationSucceeded, `{}`, "")
	require.NoError(t, err)
	assert.False(t, matched, "a delayed webhook for another operation must not close the active checkout")

	// Checkout activation carries the subscription ID, but the local checkout
	// intent is keyed by tenant+price until that webhook establishes it.
	matched, err = repo.FinishMatchingActive(ctx, 7, types.PaddleBillingOperationCheckout, "checkout-webhook", checkout.PriceID, "sub_from_activation", types.PaddleBillingOperationSucceeded, `{"transaction":"txn_1"}`, "")
	require.NoError(t, err)
	assert.True(t, matched)

	finished, err := repo.GetByID(ctx, checkout.ID)
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationSucceeded, finished.Status)
	assert.JSONEq(t, `{"transaction":"txn_1"}`, finished.Result)

	matched, err = repo.FinishMatchingActive(ctx, 7, types.PaddleBillingOperationCheckout, "checkout-webhook", checkout.PriceID, "sub_from_activation", types.PaddleBillingOperationSucceeded, `{}`, "")
	require.NoError(t, err)
	assert.False(t, matched, "a duplicate webhook must not terminalize a second row")
}

func TestPaddleBillingOperationFinishMatchingUpgradeRequiresSubscription(t *testing.T) {
	_, repo := setupPaddleBillingOperationDB(t)
	ctx := context.Background()
	intent := paddleBillingIntent(7, "upgrade-webhook")
	intent.OperationType = types.PaddleBillingOperationUpgrade
	intent.SubscriptionID = "sub_owned"
	intent.PriceID = "pri_pro_monthly"
	upgrade, _, err := repo.Claim(ctx, intent)
	require.NoError(t, err)

	matched, err := repo.FinishMatchingActive(ctx, 7, types.PaddleBillingOperationUpgrade, "upgrade-webhook", intent.PriceID, "", types.PaddleBillingOperationSucceeded, `{}`, "")
	require.NoError(t, err)
	assert.False(t, matched)
	matched, err = repo.FinishMatchingActive(ctx, 7, types.PaddleBillingOperationUpgrade, "upgrade-webhook", intent.PriceID, "sub_other", types.PaddleBillingOperationSucceeded, `{}`, "")
	require.NoError(t, err)
	assert.False(t, matched)
	matched, err = repo.FinishMatchingActive(ctx, 7, types.PaddleBillingOperationUpgrade, "upgrade-webhook", intent.PriceID, intent.SubscriptionID, types.PaddleBillingOperationSucceeded, `{}`, "")
	require.NoError(t, err)
	assert.True(t, matched)

	finished, err := repo.GetByID(ctx, upgrade.ID)
	require.NoError(t, err)
	assert.Equal(t, types.PaddleBillingOperationSucceeded, finished.Status)
}

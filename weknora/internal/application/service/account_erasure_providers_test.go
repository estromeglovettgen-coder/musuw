package service

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	paddle "github.com/PaddleHQ/paddle-go-sdk/v5"
	"github.com/stretchr/testify/require"
)

type paddleSubscriptionInventoryStub struct {
	sub            *paddle.Subscription
	subscriptions  []*paddle.Subscription
	err            error
	listedCustomer string
}

func (s *paddleSubscriptionInventoryStub) Get(context.Context, string) (*paddle.Subscription, error) {
	return s.sub, s.err
}

func (s *paddleSubscriptionInventoryStub) ListByCustomer(_ context.Context, customerID string) ([]*paddle.Subscription, error) {
	s.listedCustomer = customerID
	return s.subscriptions, s.err
}

func TestPaddleAccountErasureGuardRequiresHostedBillingResolution(t *testing.T) {
	for _, status := range []paddle.SubscriptionStatus{
		paddle.SubscriptionStatusActive,
		paddle.SubscriptionStatusTrialing,
		paddle.SubscriptionStatusPastDue,
		paddle.SubscriptionStatusPaused,
	} {
		t.Run(string(status), func(t *testing.T) {
			guard := newPaddleAccountErasureGuard(&paddleSubscriptionInventoryStub{
				sub: &paddle.Subscription{Status: status},
			})
			err := guard.EnsureAccountTerminal(context.Background(), "", "sub_123")
			require.ErrorIs(t, err, ErrAccountBillingActionRequired)
		})
	}
}

func TestPaddleAccountErasureGuardAllowsTerminalOrOfficialNotFound(t *testing.T) {
	guard := newPaddleAccountErasureGuard(&paddleSubscriptionInventoryStub{
		sub: &paddle.Subscription{Status: paddle.SubscriptionStatusCanceled},
	})
	require.NoError(t, guard.EnsureAccountTerminal(context.Background(), "", "sub_123"))

	guard = newPaddleAccountErasureGuard(&paddleSubscriptionInventoryStub{err: paddle.ErrNotFound})
	require.NoError(t, guard.EnsureAccountTerminal(context.Background(), "", "sub_stale"))
}

func TestPaddleAccountErasureGuardFailsClosedOnAmbiguousRead(t *testing.T) {
	guard := newPaddleAccountErasureGuard(&paddleSubscriptionInventoryStub{err: errors.New("network unavailable")})
	err := guard.EnsureAccountTerminal(context.Background(), "", "sub_123")
	require.ErrorIs(t, err, ErrAccountBillingUnavailable)

	guard = newPaddleAccountErasureGuard(&paddleSubscriptionInventoryStub{sub: &paddle.Subscription{Status: "future_state"}})
	err = guard.EnsureAccountTerminal(context.Background(), "", "sub_123")
	require.ErrorIs(t, err, ErrAccountBillingUnavailable)
}

func TestPaddleAccountErasureGuardUsesOfficialCustomerInventoryWhenLocalSubscriptionMissing(t *testing.T) {
	inventory := &paddleSubscriptionInventoryStub{subscriptions: []*paddle.Subscription{
		{Status: paddle.SubscriptionStatusCanceled},
	}}
	guard := newPaddleAccountErasureGuard(inventory)
	require.NoError(t, guard.EnsureAccountTerminal(context.Background(), "ctm_123", ""))
	require.Equal(t, "ctm_123", inventory.listedCustomer)

	inventory.subscriptions = append(inventory.subscriptions, &paddle.Subscription{Status: paddle.SubscriptionStatusActive})
	err := guard.EnsureAccountTerminal(context.Background(), "ctm_123", "")
	require.ErrorIs(t, err, ErrAccountBillingActionRequired)
}

func TestSupabaseIdentityAdminDeletesBoundSubjectWithoutLeakingSecret(t *testing.T) {
	const secret = "server-only-secret-value"
	var gotMethod, gotPath, gotAuthorization, gotAPIKey string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotAuthorization = r.Header.Get("Authorization")
		gotAPIKey = r.Header.Get("apikey")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	admin := newSupabaseIdentityAdmin(server.URL, secret, server.Client(), true)
	provider, subject, err := admin.ResolveIdentityDeletion(context.Background(), "supabase", "00000000-0000-0000-0000-000000000007", "")
	require.NoError(t, err)
	require.Equal(t, "supabase", provider)
	require.Equal(t, "00000000-0000-0000-0000-000000000007", subject)
	err = admin.DeleteIdentity(context.Background(), "supabase", "00000000-0000-0000-0000-000000000007")
	require.NoError(t, err)
	require.Equal(t, http.MethodDelete, gotMethod)
	require.Equal(t, "/auth/v1/admin/users/00000000-0000-0000-0000-000000000007", gotPath)
	require.Equal(t, "Bearer "+secret, gotAuthorization)
	require.Equal(t, secret, gotAPIKey)
}

func TestSupabaseIdentityAdminBoundIdentityResolutionDoesNotCallProvider(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	admin := newSupabaseIdentityAdmin(server.URL, "secret", server.Client(), true)

	provider, subject, err := admin.ResolveIdentityDeletion(context.Background(), "supabase", "00000000-0000-0000-0000-000000000007", "owner@example.com")
	require.NoError(t, err)
	require.Equal(t, "supabase", provider)
	require.Equal(t, "00000000-0000-0000-0000-000000000007", subject)
	require.Zero(t, calls)
}

func TestSupabaseIdentityAdminResolvesLegacyBindingByExactEmail(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/auth/v1/admin/users", r.URL.Path)
		require.Equal(t, "1", r.URL.Query().Get("page"))
		require.Equal(t, "1000", r.URL.Query().Get("per_page"))
		require.Equal(t, "Bearer secret", r.Header.Get("Authorization"))
		require.Equal(t, "secret", r.Header.Get("apikey"))
		_, _ = w.Write([]byte(`{"users":[{"id":"00000000-0000-0000-0000-000000000007","email":"Owner@Example.com"}]}`))
	}))
	defer server.Close()
	admin := newSupabaseIdentityAdmin(server.URL, "secret", server.Client(), true)

	provider, subject, err := admin.ResolveIdentityDeletion(context.Background(), "", "", "owner@example.com")
	require.NoError(t, err)
	require.Equal(t, "supabase", provider)
	require.Equal(t, "00000000-0000-0000-0000-000000000007", subject)
}

func TestSupabaseIdentityAdminTreatsMissingLegacyEmailAsNoUpstreamIdentity(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"users":[]}`))
	}))
	defer server.Close()
	admin := newSupabaseIdentityAdmin(server.URL, "secret", server.Client(), true)

	provider, subject, err := admin.ResolveIdentityDeletion(context.Background(), "", "", "owner@example.com")
	require.NoError(t, err)
	require.Empty(t, provider)
	require.Empty(t, subject)
}

func TestSupabaseIdentityAdminFailsClosedWhenLegacyEmailIsAmbiguous(t *testing.T) {
	for _, tc := range []struct {
		name  string
		users string
	}{
		{name: "ambiguous", users: `[{"id":"00000000-0000-0000-0000-000000000007","email":"owner@example.com"},{"id":"00000000-0000-0000-0000-000000000008","email":"OWNER@example.com"}]`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				_, _ = w.Write([]byte(`{"users":` + tc.users + `}`))
			}))
			defer server.Close()
			admin := newSupabaseIdentityAdmin(server.URL, "secret", server.Client(), true)

			_, _, err := admin.ResolveIdentityDeletion(context.Background(), "", "", "owner@example.com")
			require.ErrorIs(t, err, ErrAccountIdentityBindingRequired)
		})
	}
}

func TestSupabaseIdentityAdminIsIdempotentAndRejectsUnsupportedProviders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()
	admin := newSupabaseIdentityAdmin(server.URL, "secret", server.Client(), true)
	require.NoError(t, admin.DeleteIdentity(context.Background(), "supabase", "00000000-0000-0000-0000-000000000007"))

	err := admin.DeleteIdentity(context.Background(), "oidc", "external-subject")
	require.ErrorIs(t, err, ErrAccountIdentityDeletionUnavailable)
}

func TestSupabaseIdentityAdminNeverIncludesCredentialInProviderErrors(t *testing.T) {
	const secret = "do-not-leak-this-secret"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()
	admin := newSupabaseIdentityAdmin(server.URL, secret, server.Client(), true)

	err := admin.DeleteIdentity(context.Background(), "supabase", "00000000-0000-0000-0000-000000000007")
	require.Error(t, err)
	require.False(t, strings.Contains(err.Error(), secret))
}

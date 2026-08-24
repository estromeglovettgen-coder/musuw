package router

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPaddlePublicConfigRouteIsPreciselyAnonymousAndReadOnly(t *testing.T) {
	source, err := os.ReadFile("router.go")
	require.NoError(t, err)
	text := string(source)
	route := `r.GET("/api/v1/billing/paddle/public-config", params.EntitlementHandler.PaddlePublicConfig)`
	routeIndex := strings.Index(text, route)
	authIndex := strings.Index(text, "r.Use(middleware.Auth(")

	require.NotEqual(t, -1, routeIndex, "public Paddle.js config GET must be registered")
	require.NotEqual(t, -1, authIndex, "authentication middleware must remain registered")
	require.Less(t, routeIndex, authIndex, "the payment-link config must be reachable without login")
	require.Equal(t, 1, strings.Count(text, "/api/v1/billing/paddle/public-config"))
	require.NotContains(t, text, `r.POST("/api/v1/billing/paddle/public-config"`)
}

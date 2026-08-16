package router

import (
	"testing"

	"github.com/Tencent/WeKnora/internal/handler"
	"github.com/gin-gonic/gin"
)

func TestIMRequestRoutesRemainRegisteredForWebComposition(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	RegisterIMRoutes(engine, &handler.IMHandler{})
	routes := make(map[string]bool)
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = true
	}
	for _, want := range []string{
		"GET /api/v1/im/callback/:channel_id",
		"POST /api/v1/im/callback/:channel_id",
	} {
		if !routes[want] {
			t.Fatalf("missing web IM request route %s: %v", want, routes)
		}
	}
}

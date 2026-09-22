package router

import (
	"github.com/Tencent/WeKnora/internal/handler"
	"github.com/gin-gonic/gin"
)

// RegisterMarketplaceRoutes binds purchases to the authenticated workspace. API
// keys are intentionally undeclared and denied by the existing API-key gate.
func RegisterMarketplaceRoutes(r *gin.RouterGroup, h *handler.MarketplaceHandler, g *rbacGuards) {
	market := r.Group("/creator-marketplace")
	market.GET("/products", g.Viewer(), h.ListProducts)
	market.GET("/products/:id", g.Viewer(), h.GetProduct)
	market.GET("/orders", g.Admin(), h.Orders)
	market.POST("/products/:id/checkout", g.Admin(), h.Checkout)
	market.POST("/subscriptions/:id/portal", g.Admin(), h.Portal)

	creator := market.Group("/creator/products", g.Admin())
	creator.GET("", h.ListCreatorProducts)
	creator.POST("", h.CreateCreatorProduct)
	creator.PUT("/:id", h.UpdateCreatorProduct)
	creator.POST("/:id/submit", h.SubmitProduct)

	admin := r.Group("/system/creator-marketplace/products", g.SystemAdmin())
	admin.GET("", h.ListAdminProducts)
	admin.PUT("/:id", h.UpdateAdminProduct)
	admin.POST("/:id/review", h.ReviewProduct)
}

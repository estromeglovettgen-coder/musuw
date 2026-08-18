import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import TDesign from "tdesign-vue-next";
import "tdesign-vue-next/dist/tdesign.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/noto-sans-sc";
import "@/assets/theme/theme.css";
import "@/assets/dropdown-menu.less";
import "@/components/css/chat-hljs-dark.less";
// Stable vendor primitives only. Application Views own their own geometry and presentation.
import "@/assets/musuw-ui-primitives.css";
// Final presentation-only convergence for native business surfaces that have no
// direct reference component, plus exact reference Lucide glyph masks.
import "@/assets/musuw-visual-contract-final.css";
// vue-virtual-scroller ships its own tiny stylesheet — required for
// RecycleScroller/DynamicScroller to size their viewport correctly.
// Without it the scroller computes 0 height and renders no items.
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import i18n from "./i18n";
import { initTheme } from "@/composables/useTheme";
import { initFont } from "@/composables/useFont";
import { installTDesignIconOfflineGuard } from "@/utils/tdesign-icon-offline";
import { installAutofillGuard } from "@/utils/disable-autofill";

// 必须在 Vue 组件挂载之前执行，避免 tdesign-icons 运行时请求 tdesign.gtimg.com
installTDesignIconOfflineGuard();

initTheme();
initFont();

const app = createApp(App);

// 全局错误处理：捕获未处理的组件错误，防止白屏
app.config.errorHandler = (err, instance, info) => {
  console.error("[Musuw] Unhandled Vue error:", err, "\nComponent:", instance, "\nInfo:", info);
};

app.use(TDesign);
app.use(createPinia());
app.use(router);
app.use(i18n);

// 等首屏路由（含导航守卫、Lite 自动登录）完成后再挂载，避免先闪默认页再跳转
router.isReady().finally(() => {
  app.mount("#app");
  installAutofillGuard();
});

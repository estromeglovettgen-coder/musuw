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
// Reference-source precision fixes load after the broad convergence layer so
// explicit TSX geometry wins over vendor defaults without owning behavior.
import "@/assets/musuw-reference-precision-fixes.css";
// Exact Lucide 0.546.0 glyph geometry for controls that have explicit reference counterparts.
import "@/assets/musuw-reference-lucide-precision.css";
// Production-reachable native surfaces without direct reference counterparts
// reuse the same geometry/chrome while retaining their original behavior.
import "@/assets/musuw-reachable-surface-final.css";
// TDesign teleports many menus/dialogs outside scoped view roots; this bridge
// changes only their paint so they cannot reintroduce legacy brand chrome.
import "@/assets/musuw-tdesign-overlay-bridge.css";
// Tenantless onboarding and native image preview are also production-reachable
// native behavior surfaces, so close their visual system last.
import "@/assets/musuw-onboarding-native.css";
// Rich document preview remains business/rendering-owned; normalize only its
// toolbar, state cards, content containers and fullscreen chrome.
import "@/assets/musuw-document-preview-final.css";
// KB editor sub-surfaces are native Musuw business forms. Keep their data/events
// and normalize only card/table/slider/form paint inside the rebuilt modal shell.
import "@/assets/musuw-kb-editor-inner-final.css";
// ModelEditorDialog keeps its native SettingDrawer/API/validation behavior; this
// last inner bridge removes the remaining non-semantic brand-blue controls.
import "@/assets/musuw-model-editor-inner-final.css";
// User font/font-size/theme preferences are behavior contracts. Load the
// compatibility layer last so the reference default stays exact while persisted
// native preferences continue to have a visible effect on rebuilt surfaces.
import "@/assets/musuw-visual-preference-compat.css";
// AgentSelector is a native WeKnora behavior surface absent from the visual
// export; skin its existing DOM from QAPanel's compact popover language.
import "@/assets/musuw-agent-selector-reference.css";
// Restored native WeKnora directory surfaces (agents, organizations, spaces)
// borrow only the visual-file KnowledgeBase/Sidebar grammar.
import "@/assets/musuw-native-directory-reference.css";
// Full Settings + Agent/Organization editor inner forms keep native business
// components but inherit the visual-file SettingsModal grammar.
import "@/assets/musuw-settings-reference-inner.css";
// Resolve final collisions between exact reference masks and native-only
// controls.
import "@/assets/musuw-final-contract-closure.css";
// Direct QAPanel counterpart closure (AtSign, mention popup) loads last so exact
// source geometry wins over generic native-extension styling.
import "@/assets/musuw-qapanel-reference-final.css";
// Direct DocumentListView.tsx counterpart geometry: fixed responsive grid and
// exact table/list radii/column/icon metrics without owning document behavior.
import "@/assets/musuw-document-list-reference-final.css";
// vue-virtual-scroller ships its own tiny stylesheet — required for
// RecycleScroller/DynamicScroller to size their viewport correctly.
// Without it the scroller computes 0 height and renders no items.
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import i18n from "./i18n";
import { initTheme } from "@/composables/useTheme";
import { initFont } from "@/composables/useFont";
import { installTDesignIconOfflineGuard } from "@/utils/tdesign-icon-offline";
import { installAutofillGuard } from "@/utils/disable-autofill";
import { installReferenceTextareaAutosize } from "@/utils/referenceTextareaAutosize";

// 必须在 Vue 组件挂载之前执行，避免 tdesign-icons 运行时请求 tdesign.gtimg.com
installTDesignIconOfflineGuard();

initTheme();
initFont();
installReferenceTextareaAutosize();

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

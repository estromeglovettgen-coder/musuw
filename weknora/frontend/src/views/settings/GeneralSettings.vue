<template>
  <section class="visual-general-settings">
    <header class="visual-general-settings__header">
      <h2>{{ $t('general.title') }}</h2>
      <p>{{ $t('general.description') }}</p>
    </header>

    <div class="visual-setting-list">
      <div class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label for="visual-language-select">{{ $t('language.language') }}</label>
          <p>{{ $t('language.languageDescription') }}</p>
        </div>
        <div class="visual-setting-row__control">
          <t-select
            id="visual-language-select"
            v-model="localLanguage"
            :placeholder="$t('language.selectLanguage')"
            @change="handleLanguageChange"
          >
            <t-option value="zh-CN" :label="$t('language.zhCN')">{{ $t('language.zhCN') }}</t-option>
            <t-option value="en-US" :label="$t('language.enUS')">{{ $t('language.enUS') }}</t-option>
            <t-option value="ru-RU" :label="$t('language.ruRU')">{{ $t('language.ruRU') }}</t-option>
            <t-option value="ko-KR" :label="$t('language.koKR')">{{ $t('language.koKR') }}</t-option>
          </t-select>
        </div>
      </div>

      <div class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label for="visual-theme-select">{{ $t('theme.theme') }}</label>
          <p>{{ $t('theme.themeDescription') }}</p>
        </div>
        <div class="visual-setting-row__control">
          <t-select
            id="visual-theme-select"
            v-model="localTheme"
            :placeholder="$t('theme.selectTheme')"
            @change="handleThemeChange"
          >
            <t-option value="light" :label="$t('theme.light')">{{ $t('theme.light') }}</t-option>
            <t-option value="dark" :label="$t('theme.dark')">{{ $t('theme.dark') }}</t-option>
            <t-option value="system" :label="$t('theme.system')">{{ $t('theme.system') }}</t-option>
          </t-select>
        </div>
      </div>

      <div class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label for="visual-sans-font-select">{{ $t('font.uiFont') }}</label>
          <p>{{ $t('font.uiFontDescription') }}</p>
        </div>
        <div class="visual-setting-row__control is-stacked">
          <t-select
            id="visual-sans-font-select"
            v-model="localSansFont"
            :placeholder="$t('font.selectFont')"
            @change="handleSansFontChange"
          >
            <t-option
              v-for="opt in sansFontOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            >
              <span :style="{ fontFamily: opt.preview }">{{ opt.label }}</span>
            </t-option>
          </t-select>
          <span class="visual-font-preview" :style="{ fontFamily: currentSansStack }">{{ $t('font.sansPreview') }}</span>
        </div>
      </div>

      <div class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label for="visual-mono-font-select">{{ $t('font.monoFont') }}</label>
          <p>{{ $t('font.monoFontDescription') }}</p>
        </div>
        <div class="visual-setting-row__control is-stacked">
          <t-select
            id="visual-mono-font-select"
            v-model="localMonoFont"
            :placeholder="$t('font.selectFont')"
            @change="handleMonoFontChange"
          >
            <t-option
              v-for="opt in monoFontOptions"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            >
              <span :style="{ fontFamily: opt.preview }">{{ opt.label }}</span>
            </t-option>
          </t-select>
          <span class="visual-font-preview" :style="{ fontFamily: currentMonoStack }">{{ $t('font.monoPreview') }}</span>
        </div>
      </div>

      <div class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label>{{ $t('font.fontSize') }}</label>
          <p>{{ $t('font.fontSizeDescription') }}</p>
        </div>
        <div class="visual-setting-row__control">
          <t-radio-group v-model="localFontSize" @change="handleFontSizeChange">
            <t-radio-button value="small">{{ $t('font.size.small') }}</t-radio-button>
            <t-radio-button value="normal">{{ $t('font.size.normal') }}</t-radio-button>
            <t-radio-button value="large">{{ $t('font.size.large') }}</t-radio-button>
          </t-radio-group>
        </div>
      </div>

      <div v-if="authStore.isLiteMode" class="visual-setting-row">
        <div class="visual-setting-row__copy">
          <label>{{ $t('settings.autoCheckUpdate') }}</label>
          <p>{{ $t('settings.autoCheckUpdateDesc') }}</p>
        </div>
        <div class="visual-setting-row__control is-switch">
          <t-switch v-model="isAutoCheckUpdateEnabled" size="small" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { normalizeLocale, persistLocalePreference } from '@/i18n/locale'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import {
  useFont,
  SANS_STACKS,
  MONO_STACKS,
  visibleSansKeys,
  visibleMonoKeys,
  type FontKey,
  type MonoFontKey,
  type FontSizeKey,
} from '@/composables/useFont'

const { t, locale } = useI18n()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const { currentTheme, setTheme } = useTheme()
const {
  currentSans,
  currentMono,
  currentSize,
  setSansFont,
  setMonoFont,
  setFontSize,
} = useFont()

const localLanguage = ref(locale.value)
const localTheme = ref<ThemeMode>(currentTheme.value)
const localSansFont = ref<FontKey>(currentSans.value)
const localMonoFont = ref<MonoFontKey>(currentMono.value)
const localFontSize = ref<FontSizeKey>(currentSize.value)

watch(currentTheme, (value) => { localTheme.value = value })
watch(currentSans, (value) => { localSansFont.value = value })
watch(currentMono, (value) => { localMonoFont.value = value })
watch(currentSize, (value) => { localFontSize.value = value })

const sansFontOptions = computed<{ value: FontKey; label: string; preview: string }[]>(() =>
  visibleSansKeys().map((key) => ({
    value: key,
    label: t(`font.sans.${key}`),
    preview: SANS_STACKS[key],
  })),
)

const monoFontOptions = computed<{ value: MonoFontKey; label: string; preview: string }[]>(() =>
  visibleMonoKeys().map((key) => ({
    value: key,
    label: t(`font.mono.${key}`),
    preview: MONO_STACKS[key],
  })),
)

const currentSansStack = computed(() => SANS_STACKS[localSansFont.value] ?? SANS_STACKS.system)
const currentMonoStack = computed(() => MONO_STACKS[localMonoFont.value] ?? MONO_STACKS.system)

const isAutoCheckUpdateEnabled = computed({
  get: () => settingsStore.isAutoCheckUpdateEnabled,
  set: (value: boolean) => {
    settingsStore.toggleAutoCheckUpdate(value)
    if (!value) return
    const desktopApp = (window as Window & {
      go?: { main?: { App?: { AutoCheckForUpdates?: () => void } } }
    }).go?.main?.App
    desktopApp?.AutoCheckForUpdates?.()
  },
})

onMounted(() => {
  let savedLocale: string | null = null
  try {
    savedLocale = localStorage.getItem('locale')
  } catch {
    savedLocale = null
  }
  const normalized = normalizeLocale(savedLocale)
  localLanguage.value = normalized || locale.value
  if (normalized) locale.value = normalized
})

const handleLanguageChange = () => {
  const persisted = persistLocalePreference(localLanguage.value)
  if (!persisted) {
    localLanguage.value = locale.value
    return
  }
  locale.value = persisted
  MessagePlugin.success(t('language.languageSaved'))
}

const handleThemeChange = (value: ThemeMode) => {
  if (!setTheme(value)) {
    localTheme.value = currentTheme.value
    return
  }
  MessagePlugin.success(t('common.success'))
}

const handleSansFontChange = (value: FontKey) => {
  if (!setSansFont(value)) {
    localSansFont.value = currentSans.value
    return
  }
  MessagePlugin.success(t('common.success'))
}

const handleMonoFontChange = (value: MonoFontKey) => {
  if (!setMonoFont(value)) {
    localMonoFont.value = currentMono.value
    return
  }
  MessagePlugin.success(t('common.success'))
}

const handleFontSizeChange = (value: FontSizeKey) => {
  if (!setFontSize(value)) {
    localFontSize.value = currentSize.value
    return
  }
  MessagePlugin.success(t('common.success'))
}
</script>

<style scoped lang="less">
.visual-general-settings {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  color: #1f2937;
}

.visual-general-settings__header {
  margin: 0 0 32px;
  padding-right: 40px;
}
.visual-general-settings__header h2 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}
.visual-general-settings__header p {
  margin: 4px 0 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 18px;
}

.visual-setting-list {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.visual-setting-row {
  width: 100%;
  min-width: 0;
  margin: 0 0 24px;
  padding: 0 0 24px;
  box-sizing: border-box;
  border-bottom: 1px solid #f3f4f6;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 192px;
  align-items: center;
  gap: 24px;
}
.visual-setting-row:last-child { margin-bottom: 0; border-bottom: 0; }

.visual-setting-row__copy { min-width: 0; }
.visual-setting-row__copy label {
  display: block;
  margin: 0;
  color: #111827;
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
}
.visual-setting-row__copy p {
  margin: 2px 0 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 18px;
}

.visual-setting-row__control {
  width: 192px;
  min-width: 0;
  justify-self: end;
}
.visual-setting-row__control.is-stacked { display: flex; flex-direction: column; gap: 6px; }
.visual-setting-row__control.is-switch { display: flex; justify-content: flex-end; }
.visual-setting-row__control :deep(.t-select) { width: 100%; }
.visual-setting-row__control :deep(.t-input) {
  min-height: 34px;
  border-color: #e5e7eb;
  border-radius: 12px;
  background: #fff;
  color: #374151;
  font-size: 12px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 2%);
}
.visual-setting-row__control :deep(.t-input:hover) { border-color: #d1d5db; }
.visual-setting-row__control :deep(.t-radio-group) { width: 100%; display: flex; }
.visual-setting-row__control :deep(.t-radio-button) {
  min-width: 0;
  flex: 1 1 0;
  height: 32px;
  padding: 0 8px;
  border-color: #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 10px;
}
.visual-setting-row__control :deep(.t-radio-button.t-is-checked) {
  border-color: #111827;
  background: #111827;
  color: #fff;
}
.visual-setting-row__control :deep(.t-switch.t-is-checked) { background: #111827; }

.visual-font-preview {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: #9ca3af;
  font-size: 9px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .visual-setting-row { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .visual-setting-row__control { width: min(280px, 100%); justify-self: start; }
}
@media (max-width: 520px) {
  .visual-general-settings__header { padding-right: 28px; }
}
</style>
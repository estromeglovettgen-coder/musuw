import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
// Load the real store and pure TS dependencies; stub only the browser API boundary.
function loadModule(name) {
  if (name === '@/api/agent') return { BUILTIN_QUICK_ANSWER_ID: 'builtin-quick-answer', BUILTIN_SMART_REASONING_ID: 'builtin-smart-reasoning' };
  if (name === '@/utils/api-base') return { getApiBaseUrl: () => '/api/v1' };
  if (!name.startsWith('@/')) return require(name);
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(new URL(`../${name.slice(2)}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  cache.set(name, exports);
  runInThisContext(`(function(exports, require) {${outputText}\n})`)(exports, loadModule);
  return exports;
}
const { useSettingsStore } = loadModule('@/stores/settings');
const { createPinia } = require('pinia');
const { nextTick } = require('vue');

function setup() {
  const storage = new Map([['weknora_lite_mode', 'true']]);
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  };
  const store = useSettingsStore(createPinia());
  store.updateConsumerSceneModel('rag', 'grok');
  store.updateConversationModels({ selectedChatModelId: 'grok', reasoningEffort: 'high', reasoningModelId: 'grok', thinkingEnabled: true });
  return { store, storage };
}

test('restored model/depth and later metadata repair remain inside the conversation snapshot', async () => {
  const { store, storage } = setup();
  const saved = storage.get('WeKnora_settings');
  store.snapshotAsDefaultsIfNeeded();
  store.applyLastRequestState({ agent_id: 'builtin-smart-reasoning', model_id: 'gpt', reasoning_effort: 'medium' });
  assert.equal(store.conversationModels.selectedChatModelId, 'gpt');
  assert.equal(store.conversationModels.reasoningModelId, 'gpt');
  assert.equal(store.conversationModels.reasoningEffort, 'medium');
  await nextTick();
  // A catalog can arrive after the synchronous hydration guard has ended.
  store.updateConversationModels({ reasoningEffort: 'low', reasoningModelId: 'gpt', thinkingEnabled: true });
  assert.equal(storage.get('WeKnora_settings'), saved);
  store.restoreDefaultsIfSnapshotted();
  assert.equal(store.conversationModels.selectedChatModelId, 'grok');
  assert.equal(store.conversationModels.reasoningEffort, 'high');
  assert.equal(store.conversationModels.reasoningModelId, 'grok');
  assert.equal(store.getConsumerSceneModel('rag'), 'grok');
});

test('fresh conversations default to ten agent iterations', () => {
  const { store } = setup();
  assert.equal(store.agentConfig.maxIterations, 10);
});

test('legacy enabled session defers to its model minimum instead of inheriting another model depth', () => {
  const { store } = setup();
  store.snapshotAsDefaultsIfNeeded();
  store.applyLastRequestState({ model_id: 'qwen', thinking: true });
  assert.equal(store.conversationModels.selectedChatModelId, 'qwen');
  assert.equal(store.conversationModels.reasoningEffort, '');
  assert.equal(store.conversationModels.reasoningModelId, '');
  assert.equal(store.conversationModels.thinkingEnabled, true);
});

test('homepage model and manual depth choices still persist normally', () => {
  const { store, storage } = setup();
  store.updateConsumerSceneModel('rag', 'qwen');
  store.updateConversationModels({ selectedChatModelId: 'qwen', reasoningEffort: 'high', reasoningModelId: 'qwen' });
  const saved = JSON.parse(storage.get('WeKnora_settings')).conversationModels;
  assert.equal(saved.selectedChatModelId, 'qwen');
  assert.equal(saved.reasoningEffort, 'high');
  assert.equal(saved.reasoningModelId, 'qwen');
  assert.equal(saved.consumerSceneModelIds.rag, 'qwen');
});

test('composer gives restored session model precedence over browser scene defaults', () => {
  const source = readFileSync(new URL('../assets/business-baselines/Input-field.pre-view.vue', import.meta.url), 'utf8');
  const getter = source.slice(source.indexOf('const selectedModelId = computed'), source.indexOf('const thinkingEnabled = computed'));
  assert.match(getter, /if \(settingsStore\._defaultsSnapshot\) return settingsStore\.conversationModels\.selectedChatModelId/);
  assert.equal((source.match(/if \(sceneManagedByConsumerResolver\.value && !settingsStore\._defaultsSnapshot\)/g) || []).length, 2);
  assert.match(source, /effectiveConsumerScene\.value === "chat" && !settingsStore\._defaultsSnapshot\) writeLastChatModelID/);
  const init = source.slice(source.indexOf('const initChatModelSelection ='), source.indexOf('const loadChatModels ='));
  assert.match(init, /if \(settingsStore\._defaultsSnapshot\) \{\s*ensureModelSelection\(\);\s*return;/);
});

test('explicit scene settings still update browser defaults while viewing historical chat', () => {
  const { store, storage } = setup();
  store.snapshotAsDefaultsIfNeeded();
  store.applyLastRequestState({ model_id: 'gpt', reasoning_effort: 'medium' });
  store.updateConsumerSceneModel('rag', 'kimi');
  const saved = JSON.parse(storage.get('WeKnora_settings')).conversationModels;
  assert.equal(saved.consumerSceneModelIds.rag, 'kimi');
  assert.equal(saved.selectedChatModelId, 'grok');
  assert.equal(saved.reasoningEffort, 'high');
  assert.equal(store.conversationModels.selectedChatModelId, 'gpt');
  assert.equal(store.conversationModels.reasoningEffort, 'medium');
  store.restoreDefaultsIfSnapshotted();
  assert.equal(store.getConsumerSceneModel('rag'), 'kimi');
});

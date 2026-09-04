import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const gitBlobSha = (text) => {
  const body = Buffer.from(text, 'utf8')
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex')
}

// Authority order:
// 1) Tencent/WeKnora main at the fixed 81142df commit is the current kernel
//    behavior contract.
// 2) v0.7.2 records the imported base source and is useful historical evidence
//    only where it does not narrow/remove current main behavior.
// 3) 367a0c... is the pre-UI product snapshot used to detect accidental
//    visual-session mutations, not permission to preserve later product
//    simplifications that conflict with the upstream behavior contract.
const EXPECTED_UPSTREAM_COMMIT = '81142dfd17b2778087e95d3a317483a2fd909b91'
const EXPECTED_UPSTREAM_TREE = '37eaafdd6c276d2d1ddffffe1f39f8b38fd7cc03'
const INITIAL_MUSUW_BASELINE_COMMIT = '76bc44e15433e598c2c131e6873754e5ec5f4f5e'
const PRE_UI_BUSINESS_BASELINE_COMMIT = '367a0c76e48fcf8a3762c33b672cfa2e16b679f4'
const NATIVE_MULTI_MODEL_RESTORE_COMMIT = '72d34034c8296532798df9d73c23e878faa1b909'
const OPENROUTER_VIDEO_INGESTION_COMMIT = '22052ccf08c5ab2e370d94ea2508359aa367d0fe'
const NATIVE_AGENT_MCP_EXPOSURE_CHANGE = 'expose-native-agents-mcp-kb-settings'
const CONSUMER_SURFACE_CHANGE = 'curate-main-consumer-surface'
const ENTITLEMENT_USAGE_REVALIDATION_CHANGE = 'refresh-entitlement-after-metered-usage'

const LOCKED_BUSINESS_BLOBS = {
  './business-baselines/ChatIndex.pre-view.vue': 'a678a30cc2dc24f8f48797a0dfb390cbb75e8c88',
  './business-baselines/Input-field.pre-view.vue': '11bc2cb650979eb55e367d370980051fa6caa429',
  './business-baselines/KnowledgeBase.pre-view.vue': 'd08464ac13257d540aa2089298a1c472a7650e74',
  './business-baselines/KnowledgeBaseList.pre-view.vue': 'c49c30b1e68b3e99b8965b447eadac4bfc268249',
  './business-baselines/manual-knowledge-editor.pre-view.vue': '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e',
  './business-baselines/menu.pre-view.vue': '7686bad141078b5c7ad25f8bae21a3b4a8d158b1',
}

// These controllers remain byte-identical to Musuw's first source baseline.
// KnowledgeBaseList is deliberately absent: the first Musuw snapshot had
// narrowed WeKnora's All/Favorites/Recents/Organization scopes to `mine`; the
// current controller restores the upstream main behavior instead.
const INITIAL_MUSUW_BYTE_IDENTICAL = {
  './business-baselines/manual-knowledge-editor.pre-view.vue': '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e',
}

const INTENTIONAL_BEHAVIOR_EVOLUTION = {
  inputField: {
    commit: NATIVE_MULTI_MODEL_RESTORE_COMMIT,
    change: NATIVE_AGENT_MCP_EXPOSURE_CHANGE,
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/Input-field.pre-view.vue'],
    authority: 'WeKnora main 81142df native multi-model, tenant Agent selection, and MCP catalog flow constrained by server-authoritative consumer scene and Lite route policy',
  },
  chatParent: {
    change: ENTITLEMENT_USAGE_REVALIDATION_CHANGE,
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/ChatIndex.pre-view.vue'],
    authority: 'WeKnora main 81142df Agent chat flow routing the selected Agent and source tenant while forwarding the consumer-selected model and reasoning effort, plus immediate server-authoritative entitlement revalidation after metered temporary uploads',
  },
  knowledgeBase: {
    commit: OPENROUTER_VIDEO_INGESTION_COMMIT,
    change: `${CONSUMER_SURFACE_CHANGE}+${ENTITLEMENT_USAGE_REVALIDATION_CHANGE}`,
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/KnowledgeBase.pre-view.vue'],
    authority: 'WeKnora main 81142df native document import flow extended with managed video file types, success-scoped usage revalidation, and server-projected runtime/storage readiness that does not expose hidden infrastructure fields',
  },
  knowledgeBaseList: {
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/KnowledgeBaseList.pre-view.vue'],
    authority: 'WeKnora main 81142df native knowledge scopes with Musuw platform-default model provisioning',
  },
  sidebar: {
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/menu.pre-view.vue'],
    authority: 'WeKnora main 81142df session behavior without requests to product-hidden channel APIs in Musuw Lite',
  },
}

const AUDITED_UPSTREAM_VIEW_BLOBS = {
  'frontend/src/views/chat/index.vue': '0dbd60aae62aeac5a90bab59abefccff6562f61e',
  'frontend/src/components/Input-field.vue': 'c74fc5a22464b8582e070e32b294d698e1e2fcf5',
  'frontend/src/views/knowledge/KnowledgeBase.vue': 'dfa0e41198093599de6c984bfa954a2c42563a87',
  'frontend/src/views/knowledge/KnowledgeBaseList.vue': '0da588be9c707bac596b6cfe90491c40a2667d92',
  'frontend/src/components/manual-knowledge-editor.vue': '5eecf5a2cf1d723cbfa1f68649924acd99811f93',
  'frontend/src/components/menu.vue': 'c57ad8de9fa75c3e157f8c2449381b81ffb99cbf',
}

test('visual rebuild cannot mutate the locked business-controller snapshots', () => {
  for (const [path, expected] of Object.entries(LOCKED_BUSINESS_BLOBS)) {
    assert.equal(gitBlobSha(read(path)), expected, `${path} business behavior baseline changed`)
  }
})

test('first Musuw byte-identical controllers remain byte-identical where upstream behavior was not narrowed', () => {
  for (const [path, expected] of Object.entries(INITIAL_MUSUW_BYTE_IDENTICAL)) {
    assert.equal(gitBlobSha(read(path)), expected, `${path} drifted from initial Musuw source baseline`)
  }
  assert.match(INITIAL_MUSUW_BASELINE_COMMIT, /^[0-9a-f]{40}$/)
  assert.match(PRE_UI_BUSINESS_BASELINE_COMMIT, /^[0-9a-f]{40}$/)
})

test('upstream behavior restorations are explicit and locked, never inferred from visual code', () => {
  assert.equal(INTENTIONAL_BEHAVIOR_EVOLUTION.inputField.commit, NATIVE_MULTI_MODEL_RESTORE_COMMIT)
  assert.equal(INTENTIONAL_BEHAVIOR_EVOLUTION.inputField.change, NATIVE_AGENT_MCP_EXPOSURE_CHANGE)
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.inputField.resultingBlob,
    gitBlobSha(read('./business-baselines/Input-field.pre-view.vue')),
  )
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.chatParent.resultingBlob,
    gitBlobSha(read('./business-baselines/ChatIndex.pre-view.vue')),
  )
  assert.equal(INTENTIONAL_BEHAVIOR_EVOLUTION.chatParent.change, ENTITLEMENT_USAGE_REVALIDATION_CHANGE)
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.knowledgeBase.resultingBlob,
    gitBlobSha(read('./business-baselines/KnowledgeBase.pre-view.vue')),
  )
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.knowledgeBase.change,
    `${CONSUMER_SURFACE_CHANGE}+${ENTITLEMENT_USAGE_REVALIDATION_CHANGE}`,
  )
  assert.match(INTENTIONAL_BEHAVIOR_EVOLUTION.knowledgeBase.authority, /server-projected runtime\/storage readiness/)
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.knowledgeBaseList.resultingBlob,
    gitBlobSha(read('./business-baselines/KnowledgeBaseList.pre-view.vue')),
  )
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.sidebar.resultingBlob,
    gitBlobSha(read('./business-baselines/menu.pre-view.vue')),
  )
  assert.match(INTENTIONAL_BEHAVIOR_EVOLUTION.inputField.authority, /WeKnora main 81142df/)
  assert.match(INTENTIONAL_BEHAVIOR_EVOLUTION.chatParent.authority, /WeKnora main 81142df/)
  assert.match(INTENTIONAL_BEHAVIOR_EVOLUTION.knowledgeBaseList.authority, /WeKnora main 81142df/)
  assert.match(INTENTIONAL_BEHAVIOR_EVOLUTION.sidebar.authority, /WeKnora main 81142df/)
})

test('knowledge list controller retains upstream scope behavior rather than Musuw single-scope narrowing', () => {
  const source = read('./business-baselines/KnowledgeBaseList.pre-view.vue')
  assert.ok(source.includes("const defaultScope: 'all' | 'mine' = authStore.hasRole('contributor') ? 'mine' : 'all'"))
  assert.ok(source.includes("val === 'all' || val === 'mine' || val === 'favorites' || val === 'recents'"))
  assert.ok(source.includes('listOrganizationSharedKnowledgeBases(val)'))
  assert.ok(source.includes('orgStore.fetchSharedKnowledgeBases({ force })'))
  assert.ok(source.includes('orgStore.fetchOrganizations({ force })'))
  assert.equal(source.includes('spaceSelection.value !== "mine"'), false)
})

test('repository declares the audited WeKnora main 81142df upstream authority', () => {
  const provenance = JSON.parse(read('../../../../third_party/weknora/active-upstream-source.json'))
  assert.equal(provenance.tag, 'main')
  assert.equal(provenance.commit, EXPECTED_UPSTREAM_COMMIT)
  assert.equal(provenance.import.tree, EXPECTED_UPSTREAM_TREE)
  assert.equal(provenance.import.version, 'main-81142df')
})

test('audit record retains the official upstream blobs used for behavior review', () => {
  for (const [path, sha] of Object.entries(AUDITED_UPSTREAM_VIEW_BLOBS)) {
    assert.match(path, /^frontend\/src\//)
    assert.match(sha, /^[0-9a-f]{40}$/, `${path} upstream audit sha malformed`)
  }
})

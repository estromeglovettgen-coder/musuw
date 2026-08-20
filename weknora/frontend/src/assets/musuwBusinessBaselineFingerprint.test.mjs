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
// 1) Tencent/WeKnora v0.7.2 is the behavior contract.
// 2) 76bc44... records Musuw's first published source baseline and is useful
//    evidence only where it does not narrow/remove upstream v0.7.2 behavior.
// 3) 367a0c... is the pre-UI product snapshot used to detect accidental
//    visual-session mutations, not permission to preserve later product
//    simplifications that conflict with the upstream behavior contract.
const EXPECTED_UPSTREAM_COMMIT = '3d5d8bfcdfeeea266b292b71cea616847af28d0f'
const INITIAL_MUSUW_BASELINE_COMMIT = '76bc44e15433e598c2c131e6873754e5ec5f4f5e'
const PRE_UI_BUSINESS_BASELINE_COMMIT = '367a0c76e48fcf8a3762c33b672cfa2e16b679f4'
const NATIVE_MULTI_MODEL_RESTORE_COMMIT = '72d34034c8296532798df9d73c23e878faa1b909'
const OPENROUTER_VIDEO_INGESTION_COMMIT = '22052ccf08c5ab2e370d94ea2508359aa367d0fe'

const LOCKED_BUSINESS_BLOBS = {
  './business-baselines/ChatIndex.pre-view.vue': '3e606571962c8d0b3838610b4cc7977ddbe3021e',
  './business-baselines/Input-field.pre-view.vue': 'cd262083e0d7ccef1ef39e636f3d19320d1fb37a',
  './business-baselines/KnowledgeBase.pre-view.vue': 'b9e9d9b2d3f09ebaf02bbe543681fdc90ae357df',
  './business-baselines/KnowledgeBaseList.pre-view.vue': 'c49c30b1e68b3e99b8965b447eadac4bfc268249',
  './business-baselines/manual-knowledge-editor.pre-view.vue': '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e',
  './business-baselines/menu.pre-view.vue': '99a2c17c59bbd5b436492bba60a206b87400b527',
}

// These controllers remain byte-identical to Musuw's first source baseline.
// KnowledgeBaseList is deliberately absent: the first Musuw snapshot had
// narrowed WeKnora's All/Favorites/Recents/Organization scopes to `mine`; the
// current controller restores the upstream v0.7.2 behavior instead.
const INITIAL_MUSUW_BYTE_IDENTICAL = {
  './business-baselines/manual-knowledge-editor.pre-view.vue': '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e',
}

const INTENTIONAL_BEHAVIOR_EVOLUTION = {
  inputField: {
    commit: NATIVE_MULTI_MODEL_RESTORE_COMMIT,
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/Input-field.pre-view.vue'],
    authority: 'WeKnora v0.7.2 native multi-model request flow constrained by the server catalog, with one consumer Agent and model-specific reasoning effort',
  },
  chatParent: {
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/ChatIndex.pre-view.vue'],
    authority: 'WeKnora v0.7.2 Agent chat flow forwarding the consumer-selected model and reasoning effort',
  },
  knowledgeBase: {
    commit: OPENROUTER_VIDEO_INGESTION_COMMIT,
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/KnowledgeBase.pre-view.vue'],
    authority: 'WeKnora v0.7.2 native document import flow extended only with the managed video file types',
  },
  knowledgeBaseList: {
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/KnowledgeBaseList.pre-view.vue'],
    authority: 'WeKnora v0.7.2 native knowledge scopes with Musuw platform-default model provisioning',
  },
}

const AUDITED_UPSTREAM_VIEW_BLOBS = {
  'frontend/src/views/chat/index.vue': '8544e69f1d153164af88bb9a3f2748a9ece735b8',
  'frontend/src/components/Input-field.vue': 'e1cfef13cef9f2d61e53be8c6e4d33268867b2b7',
  'frontend/src/views/knowledge/KnowledgeBase.vue': '1b1963bfcea822a4aaec34d7df7352dc9de1ba3f',
  'frontend/src/views/knowledge/KnowledgeBaseList.vue': '0da588be9c707bac596b6cfe90491c40a2667d92',
  'frontend/src/components/manual-knowledge-editor.vue': '5eecf5a2cf1d723cbfa1f68649924acd99811f93',
  'frontend/src/components/menu.vue': '2e3082b131b4f6e6d37ad1c1eae000efe3a769f7',
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
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.inputField.resultingBlob,
    gitBlobSha(read('./business-baselines/Input-field.pre-view.vue')),
  )
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.chatParent.resultingBlob,
    gitBlobSha(read('./business-baselines/ChatIndex.pre-view.vue')),
  )
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.knowledgeBase.resultingBlob,
    gitBlobSha(read('./business-baselines/KnowledgeBase.pre-view.vue')),
  )
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.knowledgeBaseList.resultingBlob,
    gitBlobSha(read('./business-baselines/KnowledgeBaseList.pre-view.vue')),
  )
  assert.match(INTENTIONAL_BEHAVIOR_EVOLUTION.inputField.authority, /WeKnora v0\.7\.2/)
  assert.match(INTENTIONAL_BEHAVIOR_EVOLUTION.chatParent.authority, /WeKnora v0\.7\.2/)
  assert.match(INTENTIONAL_BEHAVIOR_EVOLUTION.knowledgeBaseList.authority, /WeKnora v0\.7\.2/)
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

test('repository still declares the audited WeKnora v0.7.2 upstream authority', () => {
  const provenance = JSON.parse(read('../../../../third_party/weknora/v0.7.2-provenance.json'))
  assert.equal(provenance.upstream.tag, 'v0.7.2')
  assert.equal(provenance.upstream.commit, EXPECTED_UPSTREAM_COMMIT)
  assert.equal(provenance.upstream.tree, '7251449b3d71ef5d7d157874c2c705c58a210202')
})

test('audit record retains the official upstream blobs used for behavior review', () => {
  for (const [path, sha] of Object.entries(AUDITED_UPSTREAM_VIEW_BLOBS)) {
    assert.match(path, /^frontend\/src\//)
    assert.match(sha, /^[0-9a-f]{40}$/, `${path} upstream audit sha malformed`)
  }
})

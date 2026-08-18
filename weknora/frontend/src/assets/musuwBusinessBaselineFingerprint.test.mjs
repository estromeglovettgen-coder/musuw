import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const gitBlobSha = (text) => {
  const body = Buffer.from(text, 'utf8')
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex')
}

// Three authorities are deliberately recorded:
// 1) Tencent/WeKnora v0.7.2 is the upstream behavior contract.
// 2) 76bc44... is Musuw's first explicit repository source baseline.
// 3) 367a0c... is the product's pre-UI business baseline used by the existing
//    Task-1 guard before the visual transplant began.
const EXPECTED_UPSTREAM_COMMIT = '3d5d8bfcdfeeea266b292b71cea616847af28d0f'
const INITIAL_MUSUW_BASELINE_COMMIT = '76bc44e15433e598c2c131e6873754e5ec5f4f5e'
const PRE_UI_BUSINESS_BASELINE_COMMIT = '367a0c76e48fcf8a3762c33b672cfa2e16b679f4'
const NATIVE_MULTI_MODEL_RESTORE_COMMIT = '72d34034c8296532798df9d73c23e878faa1b909'

// Exact presentation-pre-rebuild business-controller snapshots on
// ui/rebuild-from-visual-contract. Visual work must never edit them in place.
const LOCKED_BUSINESS_BLOBS = {
  './business-baselines/ChatIndex.pre-view.vue': 'f2f5ceb08d7e6f2ee36ea12f8a67eea15b9c9612',
  './business-baselines/Input-field.pre-view.vue': 'a34d09f5f9dbe44d4b3835213fdab662c4b7446a',
  './business-baselines/KnowledgeBase.pre-view.vue': 'c6c7c53a9f1eda91b645733256eb04221bf816da',
  './business-baselines/KnowledgeBaseList.pre-view.vue': '4379ee2fa0a16a366801765bdaf9597aa93bb9bf',
  './business-baselines/manual-knowledge-editor.pre-view.vue': '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e',
  './business-baselines/menu.pre-view.vue': '99a2c17c59bbd5b436492bba60a206b87400b527',
}

// These four current controller snapshots are byte-identical to the files at
// Musuw's first explicit source baseline (76bc44...). This protects the user's
// strongest "compare against the very first GitHub version" requirement.
const INITIAL_MUSUW_BYTE_IDENTICAL = {
  './business-baselines/ChatIndex.pre-view.vue': 'f2f5ceb08d7e6f2ee36ea12f8a67eea15b9c9612',
  './business-baselines/KnowledgeBase.pre-view.vue': 'c6c7c53a9f1eda91b645733256eb04221bf816da',
  './business-baselines/KnowledgeBaseList.pre-view.vue': '4379ee2fa0a16a366801765bdaf9597aa93bb9bf',
  './business-baselines/manual-knowledge-editor.pre-view.vue': '4b6090b0ee24ffbcc97ccdd3f70220cd44966a8e',
}

// Input-field intentionally differs from 76bc44... because the product later
// restored WeKnora's native multi-model selector in 72d340... . That commit is
// business evolution, not a visual-transplant exception; the resulting pre-UI
// controller blob is therefore locked above and must not be reverted by UI work.
const INTENTIONAL_BEHAVIOR_EVOLUTION = {
  inputField: {
    commit: NATIVE_MULTI_MODEL_RESTORE_COMMIT,
    resultingBlob: LOCKED_BUSINESS_BLOBS['./business-baselines/Input-field.pre-view.vue'],
    authority: 'WeKnora v0.7.2 native multi-model selection',
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

test('first Musuw baseline byte-identical controllers remain byte-identical', () => {
  for (const [path, expected] of Object.entries(INITIAL_MUSUW_BYTE_IDENTICAL)) {
    assert.equal(gitBlobSha(read(path)), expected, `${path} drifted from initial Musuw source baseline`)
  }
  assert.match(INITIAL_MUSUW_BASELINE_COMMIT, /^[0-9a-f]{40}$/)
  assert.match(PRE_UI_BUSINESS_BASELINE_COMMIT, /^[0-9a-f]{40}$/)
})

test('intentional post-initial business evolution is explicit and locked, never inferred from UI code', () => {
  assert.equal(INTENTIONAL_BEHAVIOR_EVOLUTION.inputField.commit, NATIVE_MULTI_MODEL_RESTORE_COMMIT)
  assert.equal(
    INTENTIONAL_BEHAVIOR_EVOLUTION.inputField.resultingBlob,
    gitBlobSha(read('./business-baselines/Input-field.pre-view.vue')),
  )
  assert.match(INTENTIONAL_BEHAVIOR_EVOLUTION.inputField.authority, /WeKnora v0\.7\.2/)
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

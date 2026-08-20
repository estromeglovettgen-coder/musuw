import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('session batch adapter preserves the native boolean select-all payload and collection scope', () => {
  const child = read('../components/SessionBatchManageModal.vue')
  const parent = read('../components/menu.vue')
  const baseline = read('./business-baselines/menu.pre-view.vue')

  assert.ok(child.includes("'toggle-all': [checked: boolean]"), 'batch modal must declare the native boolean payload')
  assert.ok(child.includes("emit('toggle-all', !allSelected)"), 'batch modal must emit the target checked state')
  assert.ok(parent.includes('@toggle-all="toggleBatchSelectAll"'), 'sidebar must keep the frozen business handler')
  assert.ok(baseline.includes('const toggleBatchSelectAll = (checked: boolean)'), 'frozen handler signature changed unexpectedly')
  assert.match(parent, /menuArr\.find\(\(item(?:: \{ path\?: string \})?\) => item\.path === 'creatChat'\)\?\.children \|\| \[\]/, 'batch modal must show the same all-session collection used by native allSelected/delete-all semantics')
})

test('adapter event wiring never substitutes reference-demo business actions', () => {
  const batch = read('../components/SessionBatchManageModal.vue')
  assert.equal(batch.includes("emit('pin')"), false, 'reference-only batch pin action must not be invented')
  assert.equal(batch.includes("emit('unpin')"), false, 'reference-only batch unpin action must not be invented')
})

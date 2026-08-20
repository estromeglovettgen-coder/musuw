import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const main = read('./musuw-visual.less')
const css = read('./musuw-tdesign-overlay-bridge.css')

test('teleported overlay bridge loads after all scoped visual layers', () => {
  const i = main.indexOf('musuw-tdesign-overlay-bridge.css')
  assert.ok(i > main.indexOf('musuw-reachable-surface-final.css'))
  assert.ok(i > main.indexOf('musuw-reference-lucide-precision.css'))
})

test('native teleported overlays use reference neutral chrome', () => {
  for (const token of [
    'body .t-dialog',
    'body .t-select__dropdown:not(.wiki-graph-search-dropdown)',
    'body .t-dropdown__menu',
    'border-radius: 16px !important',
    'background: #111827 !important',
    'background: #f3f4f6 !important',
  ]) assert.ok(css.includes(token), `teleported visual contract missing: ${token}`)
  assert.equal(css.includes('body .t-popconfirm'), false, 'Trace popconfirm must remain outside the global visual bridge')
})

test('overlay bridge does not own application behavior or excluded renderers', () => {
  for (const forbidden of [
    '@click', 'router.', 'store.', 'api/', 'fetch(', 'emit(',
    '.trace-', '.knowledge-processing-timeline', '.tree-container', '.agent-stream-display',
  ]) assert.equal(css.includes(forbidden), false, `forbidden token leaked into overlay bridge: ${forbidden}`)
  assert.equal(css.includes('body .t-select__dropdown,'), false, 'select bridge must explicitly exclude the graph popup')
  assert.equal(css.includes('body .t-popconfirm'), false, 'Trace popconfirm must remain outside the global visual bridge')
})

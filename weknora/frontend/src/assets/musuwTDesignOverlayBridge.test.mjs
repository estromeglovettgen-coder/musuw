import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const main = read('./musuw-visual.less')
const css = read('./musuw-tdesign-overlay-bridge.css')
const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:css|less|vue)$/.test(entry.name) ? [path] : []
  })
}

test('teleported overlay bridge loads after all scoped visual layers', () => {
  const i = main.indexOf('musuw-tdesign-overlay-bridge.css')
  assert.ok(i > main.indexOf('musuw-reachable-surface-final.css'))
  assert.ok(i > main.indexOf('musuw-reference-lucide-precision.css'))
})

test('all native TDesign select overlays use the scene-model chrome', () => {
  for (const token of [
    'body .t-dialog',
    'body .t-select__dropdown:not(.org-select-dropdown-popup):not(.share-org-select-popup):not(.sandbox-backend-popup):not(.sandbox-config-select-popup):not(.tenant-members-role-select-popup)',
    'border-radius: 16px !important',
    'min-height: 36px !important',
    'padding: 8px 12px !important',
    'font-size: 12px !important',
    'line-height: 16px !important',
    '.t-select-input .t-input',
    'padding: 8px 14px !important',
    'padding: 0 !important',
    'border: 1px solid #e5e7eb !important',
    'box-shadow: 0 1px 2px rgb(0 0 0 / 5%) !important',
    'background: #f9fafb !important',
    'background: #f3f4f6 !important',
  ]) assert.ok(css.includes(token), `teleported visual contract missing: ${token}`)
  assert.equal(css.includes('body .t-popconfirm'), false, 'Trace popconfirm must remain outside the global visual bridge')
  assert.equal(css.includes('body .t-dropdown__menu {'), false, 'action menus must not be globally restyled as selectors')
})

test('overlay bridge does not own application behavior or select behavior', () => {
  for (const forbidden of [
    '@click', 'router.', 'store.', 'api/', 'fetch(', 'emit(',
    '.trace-', '.knowledge-processing-timeline', '.tree-container', '.agent-stream-display',
  ]) assert.equal(css.includes(forbidden), false, `forbidden token leaked into overlay bridge: ${forbidden}`)
  assert.equal(css.includes('body .t-popconfirm'), false, 'Trace popconfirm must remain outside the global visual bridge')
  for (const excluded of [
    'visual-chat-composer', 'visual-model-selector__chat', 'visual-mention',
    'visual-kb-selector', 'visual-kb-switcher', 'source-switcher-card',
    'session-group-card', 'visual-session-filter', 'tenant-dropdown',
    'visual-user-tenant-submenu',
  ]) assert.equal(css.includes(excluded), false, `excluded surface leaked into bridge: ${excluded}`)
})

test('select trigger padding is owned by the inner input only', () => {
  const wrapperBlocks = [...css.matchAll(/\.t-select-input\s*\{([\s\S]*?)\n\}/g)].map((match) => match[1])
  assert.ok(wrapperBlocks.length > 0)
  for (const wrapper of wrapperBlocks) {
    assert.match(wrapper, /padding:\s*0\s*!important;/)
    assert.doesNotMatch(wrapper, /padding:\s*8px\s+14px/)
  }
  assert.match(css, /\.t-select-input \.t-input\s*\{[\s\S]*padding:\s*8px 14px\s*!important;/)
})

test('every t-select__dropdown definition delegates visual chrome to the bridge', () => {
  const definitions = sourceFiles(sourceRoot)
    .filter((path) => readFileSync(path, 'utf8').includes('t-select__dropdown'))
    .map((path) => path.replace(`${sourceRoot}/`, ''))
    .sort()
  assert.deepEqual(definitions, [
    'assets/musuw-reachable-surface-final.css',
    'assets/musuw-tdesign-overlay-bridge.css',
    'assets/musuw-visual-preference-compat.css',
    'components/ShareKnowledgeBaseDialog.vue',
    'views/knowledge/KnowledgeBase.vue',
  ])

  assert.match(css, /:not\(\.org-select-dropdown-popup\)/)
  assert.match(css, /:not\(\.share-org-select-popup\)/)
  assert.match(css, /:not\(\.sandbox-backend-popup\)/)
  assert.match(css, /:not\(\.sandbox-config-select-popup\)/)
})

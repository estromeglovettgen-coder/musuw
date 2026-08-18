import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const main = read('../main.ts')
const manifest = read('./musuw-reference-mechanical.css')
const importNames = [...manifest.matchAll(/@import\s+"\.\/(musuw-reference-[^"]+\.css)";/g)].map((match) => match[1])
const mechanical = importNames.map((name) => read(`./${name}`)).join('\n')
const withoutComments = mechanical.replace(/\/\*[\s\S]*?\*\//g, '')

const requiredShards = [
  'musuw-reference-mechanical-01.css','musuw-reference-mechanical-01b.css',
  'musuw-reference-mechanical-02.css','musuw-reference-mechanical-03.css','musuw-reference-mechanical-04.css',
  'musuw-reference-mechanical-05.css','musuw-reference-mechanical-06.css','musuw-reference-mechanical-06b.css',
  'musuw-reference-mechanical-07.css','musuw-reference-mechanical-07b.css','musuw-reference-mechanical-08.css',
  'musuw-reference-mechanical-09a.css','musuw-reference-mechanical-09b.css','musuw-reference-mechanical-09c.css',
  'musuw-reference-mechanical-09d.css','musuw-reference-mechanical-09e.css',
  'musuw-reference-mechanical-10a.css','musuw-reference-mechanical-10b.css','musuw-reference-mechanical-10c.css',
  'musuw-reference-mechanical-11a.css','musuw-reference-mechanical-11b.css','musuw-reference-mechanical-12.css',
  'musuw-reference-mechanical-13.css','musuw-reference-mechanical-13b.css','musuw-reference-mechanical-14.css',
]

test('uses only the active mechanical reference UI layer', () => {
  const reference = main.indexOf('import "@/assets/musuw-reference-mechanical.css"')
  assert.ok(reference > main.indexOf('import "@/assets/dropdown-menu.less"'))
  assert.ok(reference > main.indexOf('import "@/components/css/chat-hljs-dark.less"'))
  for (const legacy of [
    'musuw-visual.less','musuw-reference-core.less','musuw-reference-workbench.less','musuw-reference-header.less',
    'musuw-reference-knowledge-v2.less','musuw-reference-knowledge-v3.less','musuw-reference-knowledge-v4.less',
    'musuw-reference-dom-bridge.css',
  ]) assert.equal(main.includes(legacy) || manifest.includes(legacy), false, `${legacy} must not be active`)
})

test('loads every current reference shard', () => {
  assert.deepEqual(importNames, requiredShards)
})

test('keeps the reference geometry and glyph family on high-visibility surfaces', () => {
  assert.match(mechanical, /\.aside_box\{[\s\S]*?width:calc\(var\(--spacing\) \* 64\) !important/)
  assert.match(mechanical, /\[data-guide="nav-creatChat"\] \.menu_icon::before/)
  assert.match(mechanical, /\.dialogue-answers\{[\s\S]*?max-width:var\(--container-3xl\) !important/)
  assert.match(mechanical, /\.rich-input-container \.t-textarea__inner[\s\S]*?min-height:44px !important/)
  assert.match(mechanical, /\.kb-folder-tree:not\(\.is-collapsed\)\{[\s\S]*?width:calc\(var\(--spacing\) \* 56\) !important/)
  assert.match(mechanical, /\.doc-card-list\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\) !important/)
  assert.match(mechanical, /\.knowledge-card\{[\s\S]*?height:calc\(var\(--spacing\) \* 48\) !important/)
  assert.match(mechanical, /\.content-bar-icon-btn::after\{content:"添加文档"/)
  assert.match(mechanical, /\.knowledge-card \.more-wrap::before/)
  assert.match(mechanical, /body \.settings-overlay \.settings-modal\{[\s\S]*?height:520px !important/)
  assert.match(mechanical, /body \.settings-overlay \.settings-sidebar \.nav-item:nth-child\(2\)::before/)
  assert.match(mechanical, /body \.settings-overlay \.model-settings \.model-card\{[\s\S]*?border:1px solid var\(--color-gray-200\) !important/)
  assert.match(mechanical, /\.ai-markdown-template\.markdown-content h1\{[\s\S]*?font-size:var\(--text-lg\) !important/)
  assert.match(mechanical, /\.bot_msg:hover > div > \.answer-toolbar\{opacity:100% !important/)
  assert.match(mechanical, /--font-sans:var\(--app-font-family/)
})

test('never takes ownership of product logic or excluded graph/trace renderers', () => {
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.agent-stream-display(?=[\s.{:#>+~]|$)/m)
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.streaming-steps-container(?=[\s.{:#>+~]|$)/m)
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.tree-container(?=[\s.{:#>+~]|$)/m)
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.wiki-graph(?:-canvas|-legend|-search-container)?(?=[\s.{:#>+~]|$)/m)
  assert.equal(mechanical.includes('showFolderTree'), false)
  assert.equal(mechanical.includes('localStorage'), false)
})

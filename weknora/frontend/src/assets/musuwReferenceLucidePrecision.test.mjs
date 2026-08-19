import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const main = read('../main.ts')
const glyphs = read('./musuw-reference-lucide-precision.css')

test('exact reference glyph layer is the final visual CSS import', () => {
  const glyphIndex = main.indexOf('musuw-reference-lucide-precision.css')
  assert.ok(glyphIndex > main.indexOf('musuw-reference-precision-fixes.css'))
  assert.ok(glyphIndex > main.indexOf('musuw-visual-contract-final.css'))
})

test('OnlineKnowledgeEditorDrawer toolbar keeps source literal and Lucide glyphs', () => {
  for (const token of [
    '--mvp-pen-line:', '--mvp-eye:', '--mvp-list:', '--mvp-list-ordered:',
    '--mvp-check-square:', '--mvp-quote:', '--mvp-code:', '--mvp-link:',
    '--mvp-image:', '--mvp-table:',
    'content: "B"', 'content: "I"', 'content: "S"', 'content: "</>"',
    'content: "1"', 'content: "2"', 'content: "3"',
    'nth-of-type(3)', 'nth-of-type(4)',
  ]) assert.ok(glyphs.includes(token), `missing reference editor glyph contract: ${token}`)
})

test('QAPanel and Sidebar bottom menu use exact reference glyph geometry where defined', () => {
  for (const token of [
    '--mvp-paperclip:', '--mvp-settings:', '--mvp-logout:',
    '.visual-chat-composer__tool:has(.t-icon-image)::before',
    '.visual-chat-composer__tool:has(.t-icon-attach)::before',
    '.visual-user-menu__item:has(.t-icon-setting)::before',
    '.visual-user-menu__item:has(.t-icon-logout)::before',
  ]) assert.ok(glyphs.includes(token), `missing reference shell glyph contract: ${token}`)
})

test('glyph translation does not add or call business handlers', () => {
  for (const forbidden of ['@click', 'router.', 'store.', 'api/', 'fetch(', 'emit(']) {
    assert.equal(glyphs.includes(forbidden), false, `business behavior leaked into glyph CSS: ${forbidden}`)
  }
})

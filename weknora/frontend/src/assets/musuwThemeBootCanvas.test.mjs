import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

test('pre-paint theme resolves the active user namespace before the legacy fallback', () => {
  assert.match(index, /localStorage\.getItem\('weknora_user'\)/)
  assert.match(index, /legacyThemeKey\.replace\('_theme',\s*'_'\s*\+\s*userId\s*\+\s*'_theme'\)/)
  assert.match(index, /localStorage\.getItem\(userThemeKey\)\s*\|\|\s*localStorage\.getItem\(anonThemeKey\)\s*\|\|\s*localStorage\.getItem\(legacyThemeKey\)/)
})

test('the app boot canvas stays transparent and inherits the resolved root theme', () => {
  const afterAppMount = index.split('<div id="app"></div>')[1]
  assert.ok(afterAppMount)
  assert.doesNotMatch(afterAppMount, /style\.background|localStorage\.getItem/)
})

test('pre-paint browser and Wails canvases match the final theme authority', () => {
  assert.match(index, /var bg=t==='dark'\?'#151619':'#fff'/)
  assert.match(index, /WindowSetBackgroundColour\(21,22,25,255\)/)
  assert.match(index, /WindowSetBackgroundColour\(251,252,254,255\)/)
})

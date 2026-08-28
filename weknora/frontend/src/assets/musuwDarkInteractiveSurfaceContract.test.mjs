import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const finalTheme = readFileSync(new URL('./musuw-final-theme-closure.css', import.meta.url), 'utf8')

test('dark body exports semantic TDesign colors to teleported overlays', () => {
  assert.match(finalTheme, /:root\[theme-mode="dark"\] body\s*\{[\s\S]*?--td-bg-color-container:\s*var\(--mvc-surface\);/)
  assert.match(finalTheme, /:root\[theme-mode="dark"\] body\s*\{[\s\S]*?--td-text-color-primary:\s*var\(--mvc-text\);/)
})

test('dark session menus and document drawers own their portal surfaces', () => {
  assert.match(finalTheme, /:root\[theme-mode="dark"\] body \.visual-session-menu-popup \.t-popup__content[\s\S]*?background:\s*var\(--mvc-surface\)\s*!important;/)
  assert.match(finalTheme, /:root\[theme-mode="dark"\] body \.doc-main-drawer\.t-drawer > \.t-drawer__content-wrapper[\s\S]*?background:\s*var\(--mvc-surface\)\s*!important;/)
  assert.match(finalTheme, /\.doc-main-drawer \.t-drawer__body[\s\S]*?background:\s*var\(--mvc-surface\)\s*!important;/)
  assert.match(finalTheme, /\.visual-shared-detail > footer button[\s\S]*?background:\s*var\(--mvc-surface-raised\)\s*!important;/)
})

test('dark selects use readable arrows, checks and custom selector surfaces', () => {
  assert.match(finalTheme, /:root\[theme-mode="dark"\] body \.t-select \.t-fake-arrow[\s\S]*?color:\s*var\(--mvc-muted-strong\)\s*!important;/)
  assert.match(finalTheme, /\.visual-knowledge-select-popup \.t-select-option\.t-is-selected::after[\s\S]*?background:\s*var\(--mvc-text-strong\)\s*!important;/)
  assert.match(finalTheme, /\.visual-kb-selector,[\s\S]*?\.visual-session-filter__panel[\s\S]*?background:\s*var\(--mvc-surface\)\s*!important;/)
  assert.match(finalTheme, /\.visual-kb-switcher__row:hover,[\s\S]*?\.visual-session-filter__option:hover[\s\S]*?background:\s*var\(--mvc-hover\)\s*!important;/)
})

test('dark navigation, directory and batch actions never flash a light surface', () => {
  assert.match(finalTheme, /\.visual-sidebar__mark img,[\s\S]*?\.visual-sidebar__collapsed-logo img[\s\S]*?filter:\s*invert\(1\)/)
  assert.match(finalTheme, /\.visual-folder-tree__collapsed-trigger:hover,[\s\S]*?\.visual-folder-tree__collapse:hover[\s\S]*?background:\s*transparent\s*!important;/)
  assert.match(finalTheme, /\.visual-document-batch\s*\{[\s\S]*?background:\s*var\(--mvc-surface\)\s*!important;/)
  assert.match(finalTheme, /\.visual-document-batch__button:hover:not\(:disabled\)[\s\S]*?background:\s*var\(--mvc-hover\)\s*!important;/)
})

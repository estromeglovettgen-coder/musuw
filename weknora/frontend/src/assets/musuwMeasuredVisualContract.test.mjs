import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('sidebar width remains the measured 256px reference column', () => {
  const source = read('../components/menu.vue')
  assert.ok(source.includes('--sidebar-w: 256px'))
})

test('knowledge header and document toolbar keep measured reference geometry', () => {
  const source = read('../views/knowledge/KnowledgeBase.vue')
  for (const token of [
    'padding: 28px 24px 0',
    'padding-bottom: 18px',
    'border-bottom: 1px solid #f3f4f6',
    '.visual-knowledge-tabs { min-height: 40px; margin-left: auto; padding: 4px; border-radius: 14px',
    '.visual-knowledge-toolbar { flex: 0 0 auto; width: 100%; min-width: 0; min-height: 56px; padding: 8px 10px',
    'border-radius: 16px',
    '.visual-knowledge-toolbar__search { flex: 0 0 224px; width: 224px',
    '.visual-knowledge-toolbar__select { flex: 0 0 112px; width: 112px',
    '.visual-knowledge-view-toggle button { width: 32px; height: 32px',
    'trigger-icon="add"',
  ]) assert.ok(source.includes(token), `KnowledgeBase measured geometry drifted: ${token}`)
})

test('collapsed directory rail stays at the measured 48px reference width', () => {
  const source = read('../views/knowledge/components/KbFolderTree.vue')
  assert.ok(source.includes('width: 48px'))
  assert.ok(source.includes('class="visual-folder-tree__collapsed"'))
  const parent = read('../views/knowledge/KnowledgeBase.vue')
  assert.ok(parent.includes(':collapsed="folderTreeCollapsed"'))
})

test('document grid keeps measured reference card density', () => {
  const source = read('../views/knowledge/components/DocumentCardView.vue')
  for (const token of [
    'grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))',
    'gap: 16px',
    'height: 192px',
    'border-radius: 16px',
  ]) assert.ok(source.includes(token), `DocumentCardView measured geometry drifted: ${token}`)
})

test('knowledge skeleton follows the same measured card geometry', () => {
  const source = read('../views/knowledge/KnowledgeBase.vue')
  for (const token of [
    'grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))',
    'gap: 16px',
    'min-height: 192px',
    'border-radius: 16px',
  ]) assert.ok(source.includes(token), `knowledge skeleton geometry drifted: ${token}`)
})

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

test('document grid uses the reference responsive 1/2/3/4-column contract', () => {
  const card = read('../views/knowledge/components/DocumentCardView.vue')
  const closure = read('./musuw-document-list-reference-final.css')
  for (const token of ['height: 192px', 'border-radius: 16px']) {
    assert.ok(card.includes(token), `DocumentCardView measured geometry drifted: ${token}`)
  }
  for (const token of [
    '.visual-document-grid,',
    'grid-template-columns: minmax(0, 1fr) !important',
    '@media (min-width: 640px)',
    'repeat(2, minmax(0, 1fr)) !important',
    '@media (min-width: 768px)',
    'repeat(3, minmax(0, 1fr)) !important',
    '@media (min-width: 1024px)',
    'repeat(4, minmax(0, 1fr)) !important',
  ]) assert.ok(closure.includes(token), `Document grid reference breakpoint drifted: ${token}`)
  assert.equal(closure.includes('repeat(auto-fill'), false)
})

test('knowledge skeleton shares the exact document grid breakpoints', () => {
  const closure = read('./musuw-document-list-reference-final.css')
  assert.ok(closure.includes('.visual-knowledge-skeleton-grid'))
  const source = read('../views/knowledge/KnowledgeBase.vue')
  for (const token of ['min-height: 192px', 'border-radius: 16px']) {
    assert.ok(source.includes(token), `knowledge skeleton geometry drifted: ${token}`)
  }
})

test('document list table uses the visual-source radius, column widths and file-icon size', () => {
  const closure = read('./musuw-document-list-reference-final.css')
  for (const token of [
    'border-radius: 16px !important',
    '128px',
    '96px',
    '64px !important',
    'min-height: 56px !important',
    'flex: 0 0 32px !important',
    'width: 32px !important',
    'height: 32px !important',
  ]) assert.ok(closure.includes(token), `Document list geometry drifted: ${token}`)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('document list view no longer exposes the legacy WeKnora list shell', () => {
  const source = read('../views/knowledge/components/DocumentListView.vue')
  for (const token of [
    'class="doc-list-view"',
    'class="doc-list-header"',
    'class="doc-list-row"',
    'class="doc-list-cell"',
    'class="doc-list-more-btn"',
  ]) {
    assert.equal(source.includes(token), false, `DocumentListView still contains ${token}`)
  }
  assert.match(source, /class="visual-document-list"/)
})

test('migrated knowledge document views use visual-prefixed roots instead of legacy presentation roots', () => {
  const card = read('../views/knowledge/components/DocumentCardView.vue')
  const tree = read('../views/knowledge/components/KbFolderTree.vue')
  const upload = read('../views/knowledge/components/KbUploadSourceDropdown.vue')
  const actions = read('../views/knowledge/components/DocumentActionMenu.vue')

  assert.match(card, /class="visual-document-grid"/)
  assert.match(tree, /class="visual-folder-tree"/)
  assert.match(upload, /class="visual-upload-source"/)
  assert.match(actions, /class="visual-document-actions"/)
})

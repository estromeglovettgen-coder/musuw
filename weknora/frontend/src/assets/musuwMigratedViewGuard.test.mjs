import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const migratedKnowledgeViews = [
  ['../views/knowledge/components/DocumentCardView.vue', 'class="visual-document-grid"', ['class="doc-card-view"', 'class="knowledge-card"', 'class="folder-card"']],
  ['../views/knowledge/components/DocumentListView.vue', 'class="visual-document-list"', ['class="doc-list-view"', 'class="doc-list-header"', 'class="doc-list-row"']],
  ['../views/knowledge/components/DocumentActionMenu.vue', 'class="visual-document-actions"', ['class="doc-action-menu-item"']],
  ['../views/knowledge/components/DocumentBatchBar.vue', 'class="visual-document-batch"', ['class="doc-batch-bar"', 'class="batch-bar-inner"', 'class="batch-bar-actions"']],
  ['../views/knowledge/components/KbFolderTree.vue', 'class="visual-folder-tree"', ['class="kb-folder-tree"', 'class="kb-folder-row"']],
  ['../views/knowledge/components/FolderPickerMenu.vue', 'class="visual-folder-picker"', ['class="folder-picker"', 'class="folder-picker__item"', 'class="folder-picker__list"']],
  ['../views/knowledge/components/KbUploadSourceDropdown.vue', 'class="visual-upload-source"', ['class="kb-upload-source-dropdown"', 'class="kb-upload-source-trigger"', 'class="url-import-form"']],
  ['../views/knowledge/components/TagEditDialog.vue', 'class="visual-tag-edit"', ['dialog-class-name="tag-edit-dialog"', 'class="tag-edit-body"', 'class="tag-edit-chip"', 'class="setting-drawer__section"']],
]

test('migrated knowledge document views expose only their new visual roots', () => {
  for (const [path, visualRoot, legacyTokens] of migratedKnowledgeViews) {
    const source = read(path)
    assert.ok(source.includes(visualRoot), `${path} lost ${visualRoot}`)
    for (const token of legacyTokens) {
      assert.equal(source.includes(token), false, `${path} still contains ${token}`)
    }
  }
})

test('migrated upload control cannot reattach a parent-provided legacy trigger class', () => {
  const upload = read('../views/knowledge/components/KbUploadSourceDropdown.vue')
  assert.equal(upload.includes(`:class="['visual-upload-source__trigger', triggerClass]"`), false)
})

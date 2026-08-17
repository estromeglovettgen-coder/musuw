import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const tree = readFileSync(new URL('./KbFolderTree.vue', import.meta.url), 'utf8')
const batchBar = readFileSync(new URL('./DocumentBatchBar.vue', import.meta.url), 'utf8')
const cardView = readFileSync(new URL('./DocumentCardView.vue', import.meta.url), 'utf8')
const listView = readFileSync(new URL('./DocumentListView.vue', import.meta.url), 'utf8')
const folderPicker = readFileSync(new URL('./FolderPickerMenu.vue', import.meta.url), 'utf8')

test('the rename sentinel cannot collide with the root folder path', () => {
  assert.match(tree, /const renamingPath = ref<string \| null>\(null\)/)
  assert.doesNotMatch(tree, /const renamingPath = ref\(''\)/)
  assert.match(tree, /row\.kind === 'folder' && renamingPath\.value === row\.path/)
})

test('only real folders expose the reference rename affordance', () => {
  assert.match(tree, /v-if="canEdit && row\.kind === 'folder'"/)
  assert.match(tree, /ReferenceIcon name="more-horizontal"/)
  assert.match(tree, /ReferenceIcon name="edit-2"/)
  assert.match(tree, /startRename\(row\)/)
})

test('the directory shell uses the Lucide family from the visual authority', () => {
  assert.match(tree, /ReferenceIcon name="folder"/)
  assert.match(tree, /ReferenceIcon name="panel-left-close"/)
  assert.match(tree, /'folder-open' : 'folder'/)
  assert.doesNotMatch(tree, /<t-icon/)
  assert.doesNotMatch(tree, /<t-popup/)
})

test('folder picking remains an inline reversible flow without legacy modal or popup UI', () => {
  assert.match(cardView, /folderPickerItemId === item\.id/)
  assert.match(listView, /folderPickerItemId === item\.id/)
  assert.match(batchBar, /folderPickerVisible/)
  assert.match(batchBar, /class="reference-batch-folder__menu"/)
  assert.match(folderPicker, /class="reference-folder-picker"/)
  assert.match(folderPicker, /ReferenceIcon/)
  assert.doesNotMatch(batchBar, /<t-popup/)
  assert.doesNotMatch(folderPicker, /<t-icon/)
  for (const source of [cardView, listView, batchBar]) {
    assert.doesNotMatch(source, /MoveToFolderDialog/)
  }
})

test('the folder picker is rendered before move-target and normal action menus', () => {
  for (const source of [cardView, listView]) {
    const pickerIdx = source.indexOf('v-if="folderPickerItemId === item.id"')
    const targetIdx = source.indexOf("moveMenuMode === 'targets'")
    const normalIdx = source.indexOf('v-else class="reference-')
    assert.ok(pickerIdx >= 0)
    assert.ok(targetIdx >= 0)
    assert.ok(normalIdx >= 0)
    assert.ok(pickerIdx < targetIdx)
    assert.ok(targetIdx < normalIdx)
  }
})

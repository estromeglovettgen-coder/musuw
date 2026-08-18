import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const main = read('../main.ts')
const manifest = read('./musuw-reference-mechanical.css')
const importNames = [...manifest.matchAll(/@import\s+"\.\/(musuw-reference-[^"]+\.css)";/g)].map((match) => match[1])
const mechanical = importNames.map((name) => read(`./${name}`)).join('\n')
const withoutComments = mechanical.replace(/\/\*[\s\S]*?\*\//g, '')

const migratedViewFiles = [
  '../views/creatChat/creatChat.vue',
  '../components/UserMenu.vue',
  '../components/SessionSidebarRow.vue',
  '../components/SessionSourceFilter.vue',
  '../components/ModelSelector.vue',
  '../components/AttachmentUpload.vue',
  '../components/KnowledgeBaseSelector.vue',
  '../components/KBSwitcherDropdown.vue',
  '../components/MentionSelector.vue',
  '../components/ChatAttachmentPreviewDrawer.vue',
  '../components/ChatHeader.vue',
  '../components/ChatRequestInfoButton.vue',
  '../components/ChatCitationFloat.vue',
  '../components/ChatReferencesDrawer.vue',
  '../views/chat/components/usermsg.vue',
  '../views/chat/components/botmsg.vue',
  '../views/chat/components/docInfo.vue',
  '../views/knowledge/components/DocumentCardView.vue',
  '../views/knowledge/components/DocumentListView.vue',
  '../views/knowledge/components/DocumentActionMenu.vue',
  '../views/knowledge/components/DocumentBatchBar.vue',
  '../views/knowledge/components/KbFolderTree.vue',
  '../views/knowledge/components/FolderPickerMenu.vue',
  '../views/knowledge/components/KbUploadSourceDropdown.vue',
  '../views/knowledge/components/TagEditDialog.vue',
  '../views/knowledge/components/BatchTagDialog.vue',
  '../views/knowledge/components/KbTagManageDrawer.vue',
  '../views/settings/Settings.vue',
  '../views/settings/GeneralSettings.vue',
  '../views/settings/ModelSettings.vue',
]

test('transitional mechanical layer remains last only while mother views are still unmigrated', () => {
  const reference = main.indexOf('import "@/assets/musuw-reference-mechanical.css"')
  assert.ok(reference > main.indexOf('import "@/assets/dropdown-menu.less"'))
  assert.ok(reference > main.indexOf('import "@/components/css/chat-hljs-dark.less"'))
  for (const legacy of ['musuw-visual.less','musuw-reference-core.less','musuw-reference-workbench.less','musuw-reference-header.less','musuw-reference-knowledge-v2.less','musuw-reference-knowledge-v3.less','musuw-reference-knowledge-v4.less','musuw-reference-dom-bridge.css']) {
    assert.equal(main.includes(legacy) || manifest.includes(legacy), false, `${legacy} must not be active`)
  }
})

test('migrated views own their own visual-prefixed geometry', () => {
  for (const path of migratedViewFiles) {
    const source = read(path)
    assert.match(source, /class="(?:[^"\n]*\s)?visual-[^"\n]+"/, `${path} has no direct visual root`)
    assert.match(source, /<style/, `${path} has no direct view stylesheet`)
  }
})

test('global mechanical CSS never targets rebuilt visual roots', () => {
  assert.doesNotMatch(withoutComments, /\.visual-[a-z0-9_-]+/i)
})

test('remaining mechanical ownership is limited to legacy mother-root vocabulary', () => {
  for (const token of ['.aside_box', '.rich-input-container', '.knowledge-layout']) {
    assert.ok(mechanical.includes(token), `remaining mother root lost transitional styling: ${token}`)
  }
})

test('mechanical layer never owns product logic or excluded graph and trace renderers', () => {
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.agent-stream-display(?=[\s.{:#>+~]|$)/m)
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.streaming-steps-container(?=[\s.{:#>+~]|$)/m)
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.tree-container(?=[\s.{:#>+~]|$)/m)
  assert.doesNotMatch(withoutComments, /(^|[,\s>+~])\.wiki-graph(?:-canvas|-legend|-search-container)?(?=[\s.{:#>+~]|$)/m)
  assert.equal(mechanical.includes('showFolderTree'), false)
  assert.equal(mechanical.includes('localStorage'), false)
})

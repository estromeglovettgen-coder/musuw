import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex')

test('frozen KnowledgeBase business controller remains the original implementation', () => {
  const controller = read('./business-baselines/KnowledgeBase.pre-view.vue')
  assert.equal(blobSha(controller), 'c6c7c53a9f1eda91b645733256eb04221bf816da')
})

test('rebuilt KnowledgeBase reuses frozen component options and keeps Graph host binding intact', () => {
  const source = read('../views/knowledge/KnowledgeBase.vue')
  assert.match(source, /import LegacyKnowledgeBaseBusiness from .*KnowledgeBase\.pre-view\.vue/)
  assert.match(source, /\.\.\.legacy,/)
  assert.match(source, /class="visual-knowledge-page"/)
  assert.ok(source.includes(`:view="activeKbTab === 'graph' ? 'graph' : 'browser'"`))
  assert.ok(source.includes('@open-source-doc="openSourceDoc"'))
  assert.ok(source.includes('@status-change="onWikiStatusChange"'))
  assert.ok(source.includes('@view-graph="onViewWikiInGraph"'))
})

test('rebuilt documents View retains every native filtering and document-operation surface', () => {
  const source = read('../views/knowledge/KnowledgeBase.vue')
  for (const token of [
    'docSearchKeyword',
    'tagFilterPanelVisible',
    'selectedFileType',
    'selectedParseStatus',
    'selectedSource',
    'updatedTimeRange',
    "viewMode === 'grid'",
    "viewMode === 'list'",
    'KbUploadSourceDropdown',
    'DocumentCardView',
    'DocumentListView',
    'DocumentBatchBar',
    'TagEditDialog',
    'BatchTagDialog',
    'KbTagManageDrawer',
    'DocContent',
  ]) assert.ok(source.includes(token), `KnowledgeBase active View lost ${token}`)
})

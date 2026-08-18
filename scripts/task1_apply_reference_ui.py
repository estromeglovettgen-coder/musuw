from __future__ import annotations

from pathlib import Path
import re
import subprocess

ROOT = Path("weknora/frontend/src")
MAIN = "origin/main"


def git_text(ref: str, path: str) -> str:
    return subprocess.check_output(["git", "show", f"{ref}:{path}"], text=True)


def write_from_main(path: str) -> None:
    (ROOT / path).write_text(git_text(MAIN, f"weknora/frontend/src/{path}"))


for rel in [
    "components/ReferenceIcon.vue",
    "views/knowledge/components/DocumentCardView.vue",
    "views/knowledge/components/DocumentListView.vue",
    "views/knowledge/components/DocumentActionMenu.vue",
    "views/knowledge/components/KbFolderTree.vue",
    "views/knowledge/components/KbUploadSourceDropdown.vue",
    "views/knowledge/components/DocumentBatchBar.vue",
    "views/knowledge/components/TagEditDialog.vue",
    "views/knowledge/components/BatchTagDialog.vue",
    "views/knowledge/components/KbTagManageDrawer.vue",
    "components/KBSwitcherDropdown.vue",
]:
    write_from_main(rel)

current = git_text(MAIN, "weknora/frontend/src/views/knowledge/KnowledgeBase.vue")
if "<template>" not in current:
    raise RuntimeError("current KnowledgeBase template boundary missing")
native_script = current[: current.index("<template>")]
script = native_script

donor_path = ROOT / "views/knowledge/KnowledgeBaseMechanical.vue"
if not donor_path.exists():
    raise RuntimeError("reference donor missing")
donor = donor_path.read_text()
if "<template>" not in donor:
    raise RuntimeError("reference donor template boundary missing")
presentation = donor[donor.index("<template>") :]

icon_import = "import ReferenceIcon from '@/components/ReferenceIcon.vue';\n"
import_anchor = "import KBSwitcherDropdown from '@/components/KBSwitcherDropdown.vue';\n"
if icon_import not in script:
    if import_anchor not in script:
        raise RuntimeError("ReferenceIcon import anchor changed")
    script = script.replace(import_anchor, import_anchor + icon_import, 1)

count_state = "const wikiPageCount = ref(0);\nconst wikiLinkCount = ref(0);\n"
wiki_state_anchor = "const wikiStatus = ref<{ pendingTasks: number; isActive: boolean; pendingIssues: number }>({\n"
if count_state not in script:
    if wiki_state_anchor not in script:
        raise RuntimeError("wiki status anchor changed")
    script = script.replace(wiki_state_anchor, count_state + wiki_state_anchor, 1)
    response_anchor = "    const data = res?.data || res\n    if (!data) return\n"
    if response_anchor not in script:
        raise RuntimeError("wiki stats response anchor changed")
    script = script.replace(
        response_anchor,
        response_anchor
        + "    wikiPageCount.value = Number(data.total_pages || 0)\n"
        + "    wikiLinkCount.value = Number(data.total_links || 0)\n",
        1,
    )
    reset_anchor = "  wikiStatus.value = { pendingTasks: 0, isActive: false, pendingIssues: 0 }\n"
    if reset_anchor in script:
        script = script.replace(
            reset_anchor,
            reset_anchor + "  wikiPageCount.value = 0\n  wikiLinkCount.value = 0\n",
            1,
        )

wiring = {
    '@select="handleKnowledgeDropdownSelect"': '@select="(id) => handleKnowledgeDropdownSelect({ value: id })"',
    '@open-source-doc="(id) => openKnowledgeItem({ id })"': '@open-source-doc="openSourceDoc"',
    '@status-change="refreshWikiStats"': '@status-change="onWikiStatusChange"',
    '<span>Wiki ({{ wikiCount }})</span>': '<span>Wiki ({{ wikiPageCount }})</span>',
    "<span>{{ $t('knowledgeEditor.wikiBrowser.tabGraph') }} ({{ graphCount }})</span>": "<span>{{ $t('knowledgeEditor.wikiBrowser.tabGraph') }} ({{ wikiLinkCount }})</span>",
    '@files="uploadFiles"': '@files="handleUploadSourceFiles"',
    '@url="importUrl"': '@url="handleUploadSourceUrl"',
    '@manual="createManual"': '@manual="handleManualCreate"',
    '@toggle-checkbox="(id, checked) => toggleRow(id, checked)"': '@toggle-checkbox="onCardGridCheckboxChange"',
    '@menu-visible-change="(visible, item) => visible && probeTraceAvailable(item)"': '@menu-visible-change="onCardMoreVisibleChange"',
    '@toggle-row="toggleRow"': '@toggle-row="toggleSelectRow"',
    '@toggle-all="toggleAll"': '@toggle-all="toggleSelectAll"',
    '@cancel="cancelBatch"': '@cancel="handleBatchCancel"',
    '@delete="deleteBatch"': '@delete="confirmBatchDelete"',
    '@reparse="reparseBatch"': '@reparse="confirmBatchReparse"',
    '@batch-tag="batchTag"': '@batch-tag="handleBatchTag"',
    '@tag-created="loadTags"': '@tag-created="() => loadTags(kbId, true)"',
    '@open-manage="tagManageDrawerVisible = true"': '@open-manage="openTagManageFromEditDialog"',
    '@changed="() => { loadTags(); loadKnowledgeFiles() }"': '@changed="onTagManageChanged"',
    'font-family: "Inter Variable", "Inter", "Noto Sans SC Variable", "Noto Sans SC", ui-sans-serif, system-ui, sans-serif;': 'font-family: var(--app-font-family);',
}
for before, after in wiring.items():
    presentation = presentation.replace(before, after)

probe = '@probe-trace="probeTraceAvailable"'
probe_index = presentation.find(probe)
if probe_index >= 0:
    action_index = presentation.rfind('@action="handleCardAction"', 0, probe_index)
    if action_index >= 0:
        presentation = (
            presentation[:action_index]
            + '@action="handleListAction"'
            + presentation[action_index + len('@action="handleCardAction"') :]
        )

if "<BatchTagDialog" in presentation:
    before, rest = presentation.split("<BatchTagDialog", 1)
    rest = rest.replace(
        '@open-manage="openTagManageFromEditDialog"',
        '@open-manage="openTagManageFromBatchDialog"',
        1,
    )
    presentation = before + "<BatchTagDialog" + rest

presentation = re.sub(
    r'@click="selectedTagIds\s*=\s*selectedTagIds\.includes\(tag\.id\)[\s\S]*?\[\.\.\.selectedTagIds,\s*tag\.id\]"',
    '@click="handleTagRowClick(tag.id)"',
    presentation,
)

scroll = '<div class="reference-doc-scroll">'
if scroll not in presentation:
    raise RuntimeError("reference document scroll host missing")
presentation = presentation.replace(
    scroll,
    '''<div class="reference-doc-scroll" ref="knowledgeScroll" @scroll="handleScroll" @mousedown="onDocMarqueeMouseDown">
          <div v-if="docMarqueeVisible" class="doc-marquee-box" :class="{ 'is-add': docMarqueeMode === 'add', 'is-subtract': docMarqueeMode === 'subtract' }" :style="docMarqueeBoxStyle" aria-hidden="true" />''',
    1,
)

header = "        <p>{{ $t('knowledgeEditor.document.subtitle') }}</p>\n      </div>"
if header not in presentation:
    raise RuntimeError("reference header insertion point missing")
presentation = presentation.replace(
    header,
    """        <p>{{ $t('knowledgeEditor.document.subtitle') }}</p>
        <button v-if="unsupportedFileTypes.length" type="button" class="reference-kb-warning" @click="goToParserSettings"><span>{{ $t('knowledgeBase.unsupportedTypesHint', { types: unsupportedFileTypes.map((type) => '.' + type).join('、') }) }}</span><strong>{{ $t('knowledgeBase.goToParserSettings') }} →</strong></button>
        <button v-if="missingStorageEngine" type="button" class="reference-kb-warning" @click="handleOpenKBSettings"><span>{{ $t('knowledgeBase.missingStorageEngine') }}</span><strong>{{ $t('knowledgeBase.goToStorageSettings') }} →</strong></button>
      </div>""",
    1,
)

empty_old = """          <div v-else-if="!docListLoading" class="reference-empty-state">
            <ReferenceIcon name="file-text" :size="38" :stroke-width="1.5" />
            <strong>暂无文档</strong>
          </div>"""
empty_new = """          <div v-else-if="!docListLoading" class="reference-empty-state">
            <template v-if="selectedFolderPath || isFiltering"><ReferenceIcon name="file-text" :size="38" :stroke-width="1.5" /><strong>{{ isFiltering ? $t('knowledgeBase.folderTree.emptySearch') : $t('knowledgeBase.folderTree.emptyFolder') }}</strong></template>
            <EmptyKnowledge v-else />
          </div>"""
if empty_old not in presentation:
    raise RuntimeError("reference empty state changed")
presentation = presentation.replace(empty_old, empty_new, 1)

presentation = presentation.replace(
    '@getDoc="getDoc"\n    />',
    '@getDoc="getDoc"\n      @summaryStateChange="syncDocumentSummaryState"\n    />',
    1,
)

if "<KnowledgeBaseEditorModal" not in presentation:
    root_close = "\n  </div>\n</template>\n\n<style scoped>"
    pos = presentation.rfind(root_close)
    if pos < 0:
        raise RuntimeError("reference root close missing")
    modal = """
    <KnowledgeBaseEditorModal
      :visible="uiStore.showKBEditorModal"
      :mode="uiStore.kbEditorMode"
      :kb-id="uiStore.currentKBId || undefined"
      :initial-type="uiStore.kbEditorType"
      @update:visible="(value) => value ? null : uiStore.closeKBEditor()"
      @success="handleKBEditorSuccess"
    />
"""
    presentation = presentation[:pos] + modal + presentation[pos:]

css = """
.reference-kb-warning{max-width:760px;margin:4px 0 0;padding:0;border:0;background:transparent;color:#9ca3af;display:flex;align-items:center;gap:5px;font:inherit;font-size:10px;line-height:14px;text-align:left;cursor:pointer}.reference-kb-warning strong{color:#6b7280;font-weight:700;white-space:nowrap}.doc-marquee-box{position:absolute;z-index:30;pointer-events:none;border:1px solid rgb(17 24 39 / .45);background:rgb(17 24 39 / .06)}.doc-marquee-box.is-subtract{border-color:rgb(220 38 38 / .45);background:rgb(220 38 38 / .06)}
"""
style_pos = presentation.rfind("</style>")
if style_pos < 0:
    raise RuntimeError("reference style close missing")
presentation = presentation[:style_pos] + css + presentation[style_pos:]

final = script + "\n\n" + presentation
(ROOT / "views/knowledge/KnowledgeBase.vue").write_text(final)

required = [
    "reference-kb-header",
    "reference-kb-tabs",
    "reference-doc-stage",
    "reference-toolbar",
    "reference-document-workspace",
    '@files="handleUploadSourceFiles"',
    '@url="handleUploadSourceUrl"',
    '@manual="handleManualCreate"',
    '@toggle-checkbox="onCardGridCheckboxChange"',
    '@action="handleListAction"',
    "confirmBatchDelete",
    "confirmBatchReparse",
    "handleBatchTag",
    "<WikiBrowser",
    "<DocContent",
]
missing = [x for x in required if x not in final]
if missing:
    raise RuntimeError(f"missing native/reference contracts: {missing}")
for forbidden in [
    'class="knowledge-layout"',
    'class="document-header"',
    'class="doc-filter-bar"',
    "const uploadFiles = async",
    "const importUrl = async",
    "const createManual =",
]:
    if forbidden in final:
        raise RuntimeError(f"legacy/staging controller survived: {forbidden}")

normalized = script
normalized = normalized.replace(icon_import, "", 1)
normalized = normalized.replace(count_state, "", 1)
normalized = normalized.replace("    wikiPageCount.value = Number(data.total_pages || 0)\n", "", 1)
normalized = normalized.replace("    wikiLinkCount.value = Number(data.total_links || 0)\n", "", 1)
normalized = normalized.replace("  wikiPageCount.value = 0\n", "", 1)
normalized = normalized.replace("  wikiLinkCount.value = 0\n", "", 1)
if normalized != native_script:
    raise RuntimeError("native business script changed beyond permitted visual counters/import")

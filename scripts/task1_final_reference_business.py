from __future__ import annotations

from pathlib import Path
from urllib.request import urlopen
import re
import subprocess

ROOT = Path("weknora/frontend/src")
UPSTREAM_SHA = "3d5d8bfcdfeeea266b292b71cea616847af28d0f"


def git_show(commit: str, path: str, target: Path) -> None:
    target.write_text(subprocess.check_output(["git", "show", f"{commit}:{path}"], text=True))


# Restore the source-level visual implementations that existed before the
# business-only rollback. These files already preserve their emits/contracts;
# the parent KnowledgeBase is rebuilt below from the exact upstream script.
git_show(
    "f3fd6f2470f0c31d04a783dff5c112352cbc5c6e",
    "weknora/frontend/src/views/knowledge/components/DocumentCardView.vue",
    ROOT / "views/knowledge/components/DocumentCardView.vue",
)
git_show(
    "811c927e1e0829fb0a87f8c55c93dd54bcac07b5",
    "weknora/frontend/src/views/knowledge/components/DocumentListView.vue",
    ROOT / "views/knowledge/components/DocumentListView.vue",
)
git_show(
    "04ef5c2eb333b93ac745b76540b7af4a3321b16d",
    "weknora/frontend/src/views/knowledge/components/DocumentActionMenu.vue",
    ROOT / "views/knowledge/components/DocumentActionMenu.vue",
)
git_show(
    "8a34824909daa1783fc989b27b1150d0bc56681a",
    "weknora/frontend/src/views/knowledge/components/KbFolderTree.vue",
    ROOT / "views/knowledge/components/KbFolderTree.vue",
)
git_show(
    "f83f34e12f3a2ee7bc39f873f3a0dcc72672611e",
    "weknora/frontend/src/views/knowledge/components/KbUploadSourceDropdown.vue",
    ROOT / "views/knowledge/components/KbUploadSourceDropdown.vue",
)
git_show(
    "f1fd4afaeba6edf6ac6ab5f2dc4f94f7234b049b",
    "weknora/frontend/src/views/knowledge/components/DocumentBatchBar.vue",
    ROOT / "views/knowledge/components/DocumentBatchBar.vue",
)
git_show(
    "51268abf3b9867aa4fb21c70a1cd4c359e2ff1d9",
    "weknora/frontend/src/views/knowledge/components/TagEditDialog.vue",
    ROOT / "views/knowledge/components/TagEditDialog.vue",
)
git_show(
    "06701cc139a8f07fdcc20ab79e6f7150d41d61c1",
    "weknora/frontend/src/components/KBSwitcherDropdown.vue",
    ROOT / "components/KBSwitcherDropdown.vue",
)

kb_path = ROOT / "views/knowledge/KnowledgeBase.vue"
upstream = urlopen(
    f"https://raw.githubusercontent.com/Tencent/WeKnora/{UPSTREAM_SHA}/frontend/src/views/knowledge/KnowledgeBase.vue",
    timeout=60,
).read().decode("utf-8")
script = upstream[: upstream.index("</script>") + len("</script>")]

donor = subprocess.check_output(
    [
        "git",
        "show",
        "e21dfccea851d6eafb7d5892f5dc990f66b11f48:weknora/frontend/src/views/knowledge/KnowledgeBaseMechanical.vue",
    ],
    text=True,
)
presentation = donor[donor.index("<template>") :]

# ReferenceIcon is only a presentation adapter.
anchor = "import KBSwitcherDropdown from '@/components/KBSwitcherDropdown.vue';\n"
if anchor not in script:
    raise RuntimeError("exact upstream KBSwitcher import anchor changed")
script = script.replace(anchor, anchor + "import ReferenceIcon from '@/components/ReferenceIcon.vue';\n", 1)

# The visual authority shows Wiki/graph counts. They come from the existing
# upstream wiki stats call, never mock data.
counter_anchor = "const wikiIsIndexing = computed(() => wikiStatus.value.isActive || wikiStatus.value.pendingTasks > 0)\n"
if counter_anchor not in script:
    raise RuntimeError("exact upstream wiki status anchor changed")
script = script.replace(counter_anchor, "const wikiCount = ref(0)\nconst graphCount = ref(0)\n" + counter_anchor, 1)
data_anchor = "    const data = res?.data || res\n    if (!data) return\n"
if data_anchor not in script:
    raise RuntimeError("exact upstream wiki response anchor changed")
script = script.replace(
    data_anchor,
    data_anchor
    + "    wikiCount.value = Number(data.total_pages || 0)\n"
    + "    graphCount.value = Number(data.total_links || 0)\n",
    1,
)

# Visual DOM -> exact upstream handler wiring.
wiring = {
    '@select="handleKnowledgeDropdownSelect"': '@select="(id) => handleKnowledgeDropdownSelect({ value: id })"',
    '@open-source-doc="(id) => openKnowledgeItem({ id })"': '@open-source-doc="openSourceDoc"',
    '@status-change="refreshWikiStats"': '@status-change="onWikiStatusChange"',
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
}
for before, after in wiring.items():
    presentation = presentation.replace(before, after)

# The list component has its own upstream bridge.
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

# Tag filtering must execute upstream state reset/pagination behavior.
presentation = re.sub(
    r'@click="selectedTagIds\s*=\s*selectedTagIds\.includes\(tag\.id\)[\s\S]*?\[\.\.\.selectedTagIds,\s*tag\.id\]"',
    '@click="handleTagRowClick(tag.id)"',
    presentation,
)
presentation = presentation.replace(
    ':class="{ active: selectedTagIds.includes(tag.id) }"',
    ':class="{ active: isTagFilterActive(tag.id) }"',
)

# Preserve summary-state synchronization from exact upstream DocContent wiring.
if "syncDocumentSummaryState" not in presentation:
    presentation = presentation.replace(
        '@getDoc="getDoc"\n    />',
        '@getDoc="getDoc"\n      @summaryStateChange="syncDocumentSummaryState"\n    />',
        1,
    )

# Project business actions not shown in the visual mockup remain available, but
# are rendered with the same minimal reference visual language.
header_marker = "        <p>{{ $t('knowledgeEditor.document.subtitle') }}</p>\n      </div>"
if header_marker in presentation and "reference-kb-extra-actions" not in presentation:
    presentation = presentation.replace(
        header_marker,
        """        <p>{{ $t('knowledgeEditor.document.subtitle') }}</p>
        <div class="reference-kb-extra-actions">
          <KBInfoPopover v-if="kbInfo && !authStore.isLiteMode" :kb-info="kbInfo" :supported-file-types="[...supportedFileTypes]" />
          <button v-if="canManage" type="button" class="reference-kb-extra-button" :title="$t('knowledgeBase.settings')" @click="handleOpenKBSettings"><ReferenceIcon name="settings" :size="14" /></button>
        </div>
        <button v-if="unsupportedFileTypes.length" type="button" class="reference-kb-warning" @click="goToParserSettings"><span>{{ $t('knowledgeBase.unsupportedTypesHint', { types: unsupportedFileTypes.map(t => '.' + t).join('、') }) }}</span><strong>{{ $t('knowledgeBase.goToParserSettings') }} →</strong></button>
        <button v-if="missingStorageEngine" type="button" class="reference-kb-warning" @click="handleOpenKBSettings"><span>{{ $t('knowledgeBase.missingStorageEngine') }}</span><strong>{{ $t('knowledgeBase.goToStorageSettings') }} →</strong></button>
      </div>""",
        1,
    )

# Preserve the real settings editor modal.
if "<KnowledgeBaseEditorModal" not in presentation:
    root_close = "\n  </div>\n</template>"
    pos = presentation.rfind(root_close)
    if pos < 0:
        raise RuntimeError("reference KnowledgeBase root close not found")
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

# Extra real controls use reference primitives; no alternate UI system.
css = """
.reference-kb-header__copy{position:relative}.reference-kb-extra-actions{position:absolute;left:calc(100% + 10px);top:0;display:flex;align-items:center;gap:4px}.reference-kb-extra-button{width:28px;height:28px;padding:0;border:1px solid #e5e7eb;border-radius:9px;background:#fff;color:#6b7280;display:grid;place-items:center;cursor:pointer}.reference-kb-extra-button:hover{background:#f3f4f6;color:#111827}.reference-kb-warning{max-width:760px;margin:4px 0 0;padding:0;border:0;background:transparent;color:#9ca3af;display:flex;align-items:center;gap:5px;font:inherit;font-size:10px;line-height:14px;text-align:left;cursor:pointer}.reference-kb-warning strong{color:#6b7280;font-weight:700;white-space:nowrap}
"""
style_pos = presentation.rfind("</style>")
if style_pos < 0:
    raise RuntimeError("reference style close missing")
presentation = presentation[:style_pos] + css + presentation[style_pos:]
kb_path.write_text(script + "\n\n" + presentation)

# Restore upstream global upload-confirm host while keeping Musuw's auth shell.
app_path = ROOT / "App.vue"
app = app_path.read_text()
manual_import = 'import ManualKnowledgeEditor from "@/components/manual-knowledge-editor.vue";\n'
host_import = 'import UploadConfirmHost from "@/components/UploadConfirmHost.vue";\n'
if host_import not in app:
    if manual_import not in app:
        raise RuntimeError("App upload host import anchor missing")
    app = app.replace(manual_import, manual_import + host_import, 1)
if "<UploadConfirmHost />" not in app:
    app = app.replace("      <ManualKnowledgeEditor />", "      <ManualKnowledgeEditor />\n      <UploadConfirmHost />", 1)
app_path.write_text(app)

# Reuse the real file input for any reference empty-state upload CTA.
upload_path = ROOT / "views/knowledge/components/KbUploadSourceDropdown.vue"
upload = upload_path.read_text()
if "const openFilePicker = () =>" not in upload:
    upload = upload.replace(
        "const openUrlDialog = () => {",
        "const openFilePicker = () => fileInputRef.value?.click()\n\nconst openUrlDialog = () => {",
        1,
    )
upload = upload.replace("defineExpose({ openUrlDialog })", "defineExpose({ openUrlDialog, openFilePicker })")
upload_path.write_text(upload)

# Hard assertions: visual source is active; staging business is not.
final = kb_path.read_text()
required = [
    "useUploadConfirmStore",
    "openUploadConfirmDialog",
    "handleUploadConfirmResult",
    "process_config",
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
]
missing = [token for token in required if token not in final]
if missing:
    raise RuntimeError(f"missing contracts: {missing}")
for forbidden in ["const uploadFiles = async", "const importUrl = async", "const createManual ="]:
    if forbidden in final:
        raise RuntimeError(f"staging business controller is active: {forbidden}")

for file_name, tokens in {
    "views/knowledge/components/DocumentCardView.vue": ["ReferenceIcon", "reference-card-grid", "reference-document-card"],
    "views/knowledge/components/DocumentListView.vue": ["ReferenceIcon"],
    "views/knowledge/components/KbFolderTree.vue": ["ReferenceIcon"],
    "views/knowledge/components/KbUploadSourceDropdown.vue": ["ReferenceIcon"],
}.items():
    text = (ROOT / file_name).read_text()
    for token in tokens:
        if token not in text:
            raise RuntimeError(f"{file_name} missing {token}")

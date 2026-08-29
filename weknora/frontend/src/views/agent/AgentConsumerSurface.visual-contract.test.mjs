import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const list = readFileSync(new URL('./AgentList.vue', import.meta.url), 'utf8')
const editor = readFileSync(new URL('./AgentEditorModal.vue', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../settings/Settings.vue', import.meta.url), 'utf8')
const settingsShell = readFileSync(new URL('../settings/components/VisualSettingsShell.vue', import.meta.url), 'utf8')
const nativeDirectoryStyles = readFileSync(new URL('../../assets/musuw-native-directory-reference.css', import.meta.url), 'utf8')

test('consumer Agent list preserves native CRUD while matching the compact reference surface', () => {
  for (const token of [
    'handleCreateAgent',
    'handleEdit(agent)',
    'handleCopy(agent)',
    'handleDelete(agent)',
    'handleCardClick(agent)',
    'class="agents-panel__search"',
    'class="agents-panel__title-icon"',
    '<t-icon class="more-icon" name="ellipsis"',
    'agent-card-skeleton',
    'border-radius: 12px',
    'padding: 18px',
    ':root[theme-mode="dark"] .agent-list-container',
    ':root[theme-mode="dark"] .agent-list-content > .header',
    'background: var(--mvc-page, #151619) !important',
    'box-shadow: 0 1px 2px rgb(0 0 0 / 28%) !important',
  ]) assert.ok(list.includes(token), `Agent list contract lost ${token}`)
  assert.doesNotMatch(list, /handleToggle(?:Shared)?Disabled/)
  assert.doesNotMatch(list, /setSharedAgentDisabledByMe/)
  assert.match(list, /\.agent-card-meta\s*\{[\s\S]*?span\s*\{[\s\S]*?line-height:\s*16px;/)
  assert.match(nativeDirectoryStyles, /\.agent-card \.card-bottom,[\s\S]*?min-height:\s*20px !important;/)
  assert.match(nativeDirectoryStyles, /\.agent-card \.more-wrap,[\s\S]*?width:\s*24px !important;[\s\S]*?height:\s*24px !important;[\s\S]*?padding:\s*4px !important;[\s\S]*?box-sizing:\s*border-box !important;/)
  assert.match(nativeDirectoryStyles, /\.agent-card \.card-header,[\s\S]*?min-height:\s*24px !important;/)
  assert.match(nativeDirectoryStyles, /\.agent-card \.builtin-avatar,[\s\S]*?width:\s*24px !important;[\s\S]*?height:\s*24px !important;/)
  assert.match(nativeDirectoryStyles, /\.agent-card \.card-content,[\s\S]*?margin:\s*6px 0 0 !important;/)
  assert.match(list, /const fetchList = \(force = false\) => \{[\s\S]*?return Promise\.all\(\[[\s\S]*?\]\)\.finally\(\(\) => \{ loading\.value = false \}\)\.then\(\(\) => \{/)
  assert.doesNotMatch(list, /loadError|retryFetchList|agent-list-error/)
  assert.doesNotMatch(list, /@\/assets\/img\/more\.png/)
  assert.match(list, /\.agent-section-header\s*\{[\s\S]*?position:\s*static;/)
  assert.doesNotMatch(list, /\.agent-card\s*\{[\s\S]{0,900}linear-gradient/, 'consumer cards must not keep the decorative gradient')
  assert.match(
    nativeDirectoryStyles,
    /:root\[theme-mode="dark"\] \.agent-card:hover,[\s\S]*?box-shadow:\s*var\(--mvc-shadow\) !important;/,
    'Agent hover must use the same dark shadow token as the Knowledge Base card',
  )
  assert.match(
    list,
    /:root\[theme-mode="dark"\] \.agent-card:hover\s*\{[^}]*background:\s*var\(--mvc-hover, #25272c\) !important;[^}]*border-color:\s*var\(--mvc-line-strong, #484c54\) !important;[^}]*box-shadow:\s*var\(--mvc-shadow\) !important;/,
    'the component-level dark rule must not override the shared Knowledge Base hover animation',
  )
})

test('Settings and Agent editor render the same shared visual shell while Agent keeps native save fields', () => {
  for (const token of [
    'handleSave',
    'createAgent',
    'updateAgent',
    '<VisualSettingsShell',
    'class="visual-settings-nav__item"',
    'role="tablist"',
    'role="tab"',
    '@keydown.enter.prevent',
    '@keydown.space.prevent',
    'data-agent-hidden-field="agent-id"',
    'data-agent-hidden-field="integrations"',
    ':root[theme-mode="dark"] .agent-editor-modal',
    'background: var(--mvc-surface, #1a1b1f) !important',
  ]) assert.ok(editor.includes(token), `Agent editor contract lost ${token}`)
  assert.match(settings, /import VisualSettingsShell from '.\/components\/VisualSettingsShell\.vue'/)
  assert.match(settings, /<VisualSettingsShell[\s\S]*?<template #nav>/)
  assert.match(editor, /import VisualSettingsShell from '@\/views\/settings\/components\/VisualSettingsShell\.vue'/)
  assert.doesNotMatch(editor, /class="settings-overlay"|class="settings-modal agent-editor-modal"|class="nav-icon"/)

  for (const token of [
    'class="visual-settings-overlay"',
    'class="visual-settings-modal"',
    'class="visual-settings-sidebar"',
    'class="visual-settings-close-wrap"',
    'class="visual-settings-close"',
    'class="visual-settings-nav"',
    'class="visual-settings-content"',
    'class="visual-settings-content__inner"',
    'class="visual-settings-footer"',
    'width: min(896px, 100%)',
    'height: 620px',
    'flex: 0 0 192px',
    'padding: 32px',
    ':root[theme-mode="dark"] .visual-settings-sidebar',
    'background: var(--mvc-page, #151619) !important',
  ]) assert.ok(settingsShell.includes(token), `shared Settings shell contract lost ${token}`)
})

test('Agent mode and knowledge scope use the authoritative single-line segmented controls', () => {
  assert.match(editor, /<t-radio-group[^>]*class="agent-segmented-control"[^>]*v-model="agentMode"/)
  assert.match(editor, /<t-radio-group[^>]*class="agent-segmented-control agent-segmented-control--scope"[^>]*v-model="kbSelectionMode"/)
  assert.match(editor, /\.agent-segmented-control\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?padding:\s*4px;[\s\S]*?border-radius:\s*12px;/)
  assert.match(editor, /\.agent-segmented-control :deep\(\.t-radio-button\)\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?padding:\s*6px 14px;[\s\S]*?border-radius:\s*8px;[\s\S]*?font-size:\s*12px;/)
  assert.match(editor, /\.agent-segmented-control--scope\s*\{[\s\S]*?overflow-x:\s*auto;/)
  assert.match(editor, /\.setting-row\s*\{[\s\S]*?display:\s*grid !important;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(280px, 52%\) !important;/)
  assert.match(editor, /label\s*\{[\s\S]*?font-size:\s*14px !important;[\s\S]*?line-height:\s*20px !important;[\s\S]*?font-weight:\s*600 !important;/)
  assert.match(editor, /\.setting-control\s*\{[\s\S]*?width:\s*100% !important;[\s\S]*?max-width:\s*none !important;/)
  assert.match(editor, /&\.setting-row-vertical\s*\{[\s\S]*?grid-template-columns:\s*1fr !important;/)
})

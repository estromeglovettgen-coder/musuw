import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { filterSettingsNavigation } from './settingsNavigation'

const settingsSource = readFileSync(new URL('./Settings.vue', import.meta.url), 'utf8')

const authorizedItems = [
  { key: 'general', label: '常规设置' },
  { key: 'usage', label: '使用情况与计费' },
  { key: 'userprofile', label: '用户信息' },
  { key: 'models', label: '模型选择' },
]

test('settings search filters only the already-authorized navigation surface', () => {
  assert.deepEqual(filterSettingsNavigation(authorizedItems, '  计费  '), [authorizedItems[1]])
  assert.deepEqual(filterSettingsNavigation(authorizedItems, 'USER'), [authorizedItems[2]])
  assert.deepEqual(filterSettingsNavigation(authorizedItems, ''), authorizedItems)
})

test('settings search never synthesizes a hidden section', () => {
  assert.deepEqual(filterSettingsNavigation(authorizedItems, 'system-global'), [])
})

test('Lite settings expose consumer models without exposing system administration', () => {
  assert.match(
    settingsSource,
    /if \(authStore\.isLiteMode && section !== 'usage' && section !== 'userprofile' && section !== 'models'\) return 'general'/,
  )
  assert.match(
    settingsSource,
    /if \(authStore\.isLiteMode\) return key === 'general' \|\| key === 'usage' \|\| key === 'userprofile' \|\| key === 'models'/,
  )
  assert.match(settingsSource, /\{ key: 'models', icon: 'cpu', label: t\('settings\.modelManagement'\) \}/)
  assert.match(settingsSource, /const SYSTEM_ADMIN_SECTIONS = SYSTEM_ADMIN_SETTINGS_SECTIONS/)
})

test('settings traps focus only when it is a modal and restores the launcher', () => {
  for (const token of [
    ':aria-modal="isSettingsRoute ? undefined : \'true\'"',
    'ref="settingsDialogRef"',
    'ref="settingsSearchInputRef"',
    '@keydown.tab="handleDialogTab"',
    'lastFocusedElement',
    'settingsSearchInputRef.value?.focus()',
    'lastFocusedElement?.focus()',
  ]) assert.ok(settingsSource.includes(token), `settings focus contract lost ${token}`)
})

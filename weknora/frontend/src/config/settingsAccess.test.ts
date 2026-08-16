import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MANAGED_RUNTIME_SETTINGS_SECTIONS,
  SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE,
  SETTINGS_SECTION_MIN_ROLE,
  SYSTEM_ADMIN_SETTINGS_SECTIONS,
} from './settingsAccess'

test('managed runtime configuration is not exposed to ordinary workspace users', () => {
  assert.equal(SETTINGS_SECTION_MIN_ROLE.members, 'viewer')
  assert.equal(SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE.members, 'owner')
  assert.equal(SETTINGS_SECTION_MIN_ROLE.models, 'admin')
  assert.equal(SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE.models, 'admin')
  assert.deepEqual(
    [...MANAGED_RUNTIME_SETTINGS_SECTIONS],
    ['ollama', 'weknoracloud', 'models', 'websearch', 'chathistory', 'vectorstore', 'parser', 'storage', 'mcp'],
  )
})

test('system administration settings stay explicitly system-admin-only', () => {
  assert.deepEqual(
    [...SYSTEM_ADMIN_SETTINGS_SECTIONS],
    ['system-global', 'runtime-queues', 'platform-api-keys', 'system-audit-log'],
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE,
  SETTINGS_SECTION_MIN_ROLE,
  SYSTEM_ADMIN_SETTINGS_SECTIONS,
} from './settingsAccess'

test('workspace settings visibility matches the WeKnora v0.7.2 role matrix', () => {
  assert.deepEqual(SETTINGS_SECTION_MIN_ROLE, {
    general: 'viewer',
    ollama: 'admin',
    weknoracloud: 'admin',
    models: 'viewer',
    websearch: 'admin',
    chathistory: 'admin',
    vectorstore: 'admin',
    parser: 'admin',
    storage: 'admin',
    mcp: 'admin',
    system: 'viewer',
    userprofile: 'viewer',
    tenant: 'viewer',
    members: 'viewer',
  })
})

test('management shortcuts remain stricter than read-only settings pages where required', () => {
  assert.deepEqual(SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE, {
    members: 'owner',
    models: 'admin',
  })
})

test('system administration settings stay explicitly system-admin-only', () => {
  assert.deepEqual(
    [...SYSTEM_ADMIN_SETTINGS_SECTIONS],
    ['system-global', 'runtime-queues', 'platform-api-keys', 'system-audit-log'],
  )
})

test('consumer model settings are viewer-visible but not a system-admin section', () => {
  assert.equal(SETTINGS_SECTION_MIN_ROLE.models, 'viewer')
  assert.equal(SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE.models, 'admin')
  assert.equal(SYSTEM_ADMIN_SETTINGS_SECTIONS.has('models'), false)
  assert.equal(SYSTEM_ADMIN_SETTINGS_SECTIONS.has('system-global'), true)
})

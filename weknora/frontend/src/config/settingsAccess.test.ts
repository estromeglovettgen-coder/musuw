import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE,
  SETTINGS_SECTION_MIN_ROLE,
  SYSTEM_ADMIN_SETTINGS_SECTIONS,
} from './settingsAccess'

test('workspace settings visibility matches the WeKnora main 81142df role matrix', () => {
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
    sandbox: 'admin',
    skills: 'admin',
    mcp: 'admin',
    system: 'viewer',
    userprofile: 'viewer',
    tenant: 'viewer',
    members: 'viewer',
    mymemory: 'viewer',
    memory: 'viewer',
    envvars: 'viewer',
  })
})

test('management shortcuts remain stricter than read-only settings pages where required', () => {
  assert.deepEqual(SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE, {
    members: 'owner',
    models: 'admin',
  })
})

test('the skill catalog is admin-only like the sandbox it installs into', () => {
  assert.equal(SETTINGS_SECTION_MIN_ROLE.skills, 'admin')
  assert.equal(SETTINGS_SECTION_MIN_ROLE.skills, SETTINGS_SECTION_MIN_ROLE.sandbox)
})

test('personal skill environment variables are visible to every member', () => {
  assert.equal(SETTINGS_SECTION_MIN_ROLE.envvars, 'viewer')
  // Workspace-wide skill env values live on the Admin+ skills page; a
  // management shortcut on the avatar menu would only duplicate that entrance.
  assert.equal(
    Object.prototype.hasOwnProperty.call(SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE, 'envvars'),
    false,
  )
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

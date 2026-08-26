import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const app = fs.readFileSync(path.join(root, 'src/operations/OperationsApp.vue'), 'utf8')
const api = fs.readFileSync(path.join(root, 'src/operations/api.ts'), 'utf8')
const types = fs.readFileSync(path.join(root, 'src/operations/types.ts'), 'utf8')

test('environment menu submits one-click TEST/PRODUCTION switch requests', () => {
  assert.match(app, /switchEnvironment/)
  assert.match(app, /TEST/)
  assert.match(app, /PRODUCTION/)
  assert.match(api, /switchEnvironment/)
  assert.match(api, /['"]\/admin-api\/environment['"]/)
  assert.match(api, /method:\s*['"]POST['"]/)
  assert.match(api, /I_UNDERSTAND_THIS_IS_LIVE/)
  assert.match(api, /target === ['"]production['"]/)
  assert.match(api, /confirmation:\s*PRODUCTION_ENVIRONMENT_CONFIRMATION/)
})

test('switch UI reports progress, polls health, preserves hash on reload, and recovers after timeout', () => {
  assert.match(app, /switching/)
  assert.match(app, /health|healthz/)
  assert.match(app, /30_000|30 seconds|30 秒/)
  assert.match(app, /location\.reload/)
  assert.match(app, /恢复当前环境|恢复|重试/)
  assert.match(app, /role=["']status["']/)
  assert.match(app, /role=["']alert["']/)
})

test('environment switch result is typed as a target and switching status', () => {
  assert.match(types, /EnvironmentTarget/)
  assert.match(types, /EnvironmentSwitchResult/)
  assert.match(types, /status:\s*['"]switching['"]/)
})

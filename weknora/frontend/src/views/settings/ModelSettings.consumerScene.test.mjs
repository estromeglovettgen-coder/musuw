import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.join(process.cwd(), 'src/views/settings/ModelSettings.vue'), 'utf8')

test('consumer model settings show all fixed scenes through the shared selector', () => {
  assert.match(source, /ModelSelector/)
  assert.match(source, /consumerSceneOptionsFor\(scene\)/)
  assert.match(source, /show-add-model="false"/)
  assert.match(source, /consumerScenes.*chat.*rag.*wiki/s)
  assert.match(source, /getConsumerSceneModel/)
  assert.match(source, /updateConsumerSceneModel/)
})

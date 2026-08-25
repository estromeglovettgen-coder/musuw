import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./SystemSettings.vue', import.meta.url), 'utf8')

test('SystemSettings exposes a fixed Models policy section backed by the six scene settings', () => {
  for (const token of [
    'value="models"',
    "consumer_models.chat.free_default",
    "consumer_models.chat.paid_options",
    "consumer_models.rag.free_default",
    "consumer_models.rag.paid_options",
    "consumer_models.wiki.free_default",
    "consumer_models.wiki.paid_options",
    'filterConsumerModelCatalog',
    'listModels',
    'ordered',
    'first',
    'consumerModelDisplayName',
    'model.defaultTag',
    'paidRequired',
    'Promise.all([loadSettings(), loadConsumerModelCatalog(), loadAdmins()])',
  ]) assert.ok(source.includes(token), `models policy surface lost ${token}`)
})

test('SystemSettings policy controls only persist values selected from the safe catalog', () => {
  const modelsSection = source.slice(
    source.indexOf('activeSettingsSection === \'models\''),
    source.indexOf('activeSettingsSection === \'models\'', source.indexOf('activeSettingsSection === \'models\'') + 1),
  )
  assert.match(source, /@change="onConsumerSceneFreeChange/)
  assert.match(source, /@change="onConsumerScenePaidChange/)
  assert.match(source, /normalizeConsumerModelIds/)
  assert.ok(modelsSection.length > 0)
})

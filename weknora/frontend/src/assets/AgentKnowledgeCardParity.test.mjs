import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const kbCard = readFileSync(new URL('../views/knowledge/components/KnowledgeBaseListReferenceCard.vue', import.meta.url), 'utf8')
const directoryTheme = readFileSync(new URL('./musuw-native-directory-reference.css', import.meta.url), 'utf8')

test('Agent cards follow the knowledge-card geometry for shared controls', () => {
  assert.match(kbCard, /border-radius:\s*12px;/)
  assert.match(kbCard, /top:\s*14px;\s*right:\s*42px;/)
  assert.match(kbCard, /gap:\s*6px;\s*flex-wrap:\s*wrap;/)

  assert.match(directoryTheme, /\.agent-card,[\s\S]*?border-radius:\s*12px\s*!important;/)
  assert.match(directoryTheme, /\.agent-card \.agent-favorite-star\s*\{[^}]*top:\s*14px\s*!important;[^}]*right:\s*42px\s*!important;/)
  assert.match(directoryTheme, /\.agent-card \.card-bottom\s*\{[^}]*gap:\s*6px\s*!important;[^}]*flex-wrap:\s*wrap\s*!important;/)
  assert.match(directoryTheme, /\.agent-card \.more-wrap\s*\{[^}]*border-radius:\s*6px\s*!important;/)
  assert.match(directoryTheme, /\.agent-card \.more-icon\s*\{[^}]*width:\s*16px\s*!important;[^}]*height:\s*16px\s*!important;/)
})

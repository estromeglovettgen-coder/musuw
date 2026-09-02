import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const agentList = read('../agent/AgentList.vue')
const knowledgeBase = read('./KnowledgeBase.vue')
const knowledgeBaseList = read('./KnowledgeBaseList.vue')
const tagDrawer = read('./components/KbTagManageDrawer.vue')
const directoryReference = read('../../assets/musuw-native-directory-reference.css')

test('Agent and knowledge-base directories share the same shell geometry', () => {
  assert.match(directoryReference, /\.agent-list-content\s*\{\s*gap:\s*18px\s*!important;/)
  assert.match(directoryReference, /\.agent-list-content > \.header,[\s\S]*?padding:\s*0 0 20px\s*!important;[\s\S]*?border-bottom:\s*1px solid/)
  assert.match(directoryReference, /\.agent-list-content,[\s\S]*?padding:\s*24px\s*!important;/)
  assert.match(directoryReference, /@media\s*\(min-width:\s*768px\)[\s\S]*?\.agent-list-content\s*\{\s*padding:\s*32px\s*!important;/)
  assert.match(directoryReference, /\.agent-list-main,[\s\S]*?padding:\s*24px 4px 12px 2px\s*!important;/)
  assert.match(directoryReference, /\.agent-card-wrap\s*\{\s*animation:\s*none\s*!important;/)
  assert.match(directoryReference, /@media\s*\(min-width:\s*1024px\)[\s\S]*?\.agent-card-wrap,[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/)

  assert.match(knowledgeBaseList, /\.visual-kb-list\s*\{[\s\S]*?gap:\s*18px;/)
  assert.match(knowledgeBaseList, /\.visual-kb-list__header\s*\{[\s\S]*?padding-bottom:\s*20px;[\s\S]*?border-bottom:\s*1px solid/)
  assert.match(knowledgeBaseList, /\.visual-kb-list__content\s*\{[\s\S]*?padding:\s*24px 4px 12px 2px;/)
  assert.match(knowledgeBaseList, /@media\s*\(min-width:\s*768px\)[\s\S]*?\.visual-kb-list\s*\{\s*padding:\s*32px;/)
  assert.match(knowledgeBaseList, /@media\s*\(min-width:\s*1024px\)[\s\S]*?\.visual-kb-grid[\s\S]*?repeat\(3,minmax\(0,1fr\)\)/)

  assert.match(agentList, /\.agent-create-header-btn\s*\{[\s\S]*?height:\s*34px\s*!important;[\s\S]*?padding:\s*0 14px\s*!important;[\s\S]*?border-radius:\s*12px\s*!important;/)
  assert.match(knowledgeBaseList, /\.visual-kb-list__create\s*\{[\s\S]*?height:\s*34px\s*!important;[\s\S]*?padding:\s*0 14px\s*!important;[\s\S]*?border-radius:\s*12px\s*!important;/)
})

test('Agent creation plus follows the button foreground in both themes', () => {
  assert.match(
    directoryReference,
    /\.agent-list-content \.agent-create-header-btn \.t-icon,[\s\S]*?\.agent-list-content \.agent-create-header-btn \.btn-icon-wrapper\s*\{[\s\S]*?color:\s*currentColor\s*!important;/,
  )
  assert.match(
    directoryReference,
    /\.agent-list-content \.agent-create-header-btn \.t-button__icon,[\s\S]*?\.agent-list-content \.agent-create-header-btn \.t-icon,[\s\S]*?\.agent-list-content \.agent-create-header-btn \.btn-icon-wrapper\s*\{[\s\S]*?color:\s*#fff\s*!important;/,
  )
  assert.match(
    directoryReference,
    /:root\[theme-mode="dark"\] \.agent-list-content \.agent-create-header-btn \.t-button__icon,[\s\S]*?color:\s*#18181b\s*!important;/,
  )
})

test('Agent and knowledge-base directory shells keep the same geometry at every breakpoint', () => {
  assert.match(directoryReference, /\.visual-kb-list\s*\{[\s\S]*?gap:\s*18px\s*!important;[\s\S]*?padding:\s*24px\s*!important;/)
  assert.match(directoryReference, /\.visual-kb-list__header\s*\{[\s\S]*?padding:\s*0 0 20px\s*!important;[\s\S]*?border-bottom:\s*1px solid/)
  assert.match(directoryReference, /\.visual-kb-list__content\s*\{[\s\S]*?padding:\s*24px 4px 12px 2px\s*!important;/)
  assert.match(directoryReference, /@media\s*\(min-width:\s*768px\)[\s\S]*?\.visual-kb-list\s*\{\s*padding:\s*32px\s*!important;/)
  assert.match(directoryReference, /@media\s*\(min-width:\s*1024px\)[\s\S]*?\.visual-kb-grid\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)\s*!important;/)
})

test('Knowledge-base tag, type and status filters share one popup trigger contract', () => {
  assert.match(
    knowledgeBase,
    /\.visual-knowledge-filter-button\s*\{[\s\S]*?width:\s*112px;[\s\S]*?height:\s*36px;[\s\S]*?padding:\s*8px 10px;[\s\S]*?gap:\s*6px;[\s\S]*?line-height:\s*16px;/,
  )
  assert.equal((knowledgeBase.match(/class="visual-knowledge-filter-button"/g) || []).length, 3)
  assert.doesNotMatch(knowledgeBase, /<t-select\b/)
  assert.match(knowledgeBase, /\.visual-knowledge-filter-options\s*\{[\s\S]*?width:\s*176px;/)
  assert.match(knowledgeBase, /\.visual-knowledge-filter-button\s*\{[\s\S]*?background:\s*#fff;/)
  assert.match(knowledgeBase, /\.visual-knowledge-filter-button\.is-active\s*\{[\s\S]*?border-color:\s*#d1d5db;[\s\S]*?background:\s*#fff;/)
  assert.match(knowledgeBase, /\.visual-knowledge-filter-button > span:not\(\.visual-knowledge-filter-button__clear\)\s*\{[\s\S]*?overflow:\s*visible;[\s\S]*?text-overflow:\s*clip;[\s\S]*?white-space:\s*nowrap;/)
  assert.doesNotMatch(knowledgeBase, /\.visual-knowledge-filter-button > span:not\(\.visual-knowledge-filter-button__clear\)\s*\{[^}]*text-overflow:\s*ellipsis;/)
  assert.match(knowledgeBase, /\.visual-tag-filter-popup \.t-popup__content\s*\{[\s\S]*?border-radius:\s*16px\s*!important;[\s\S]*?box-shadow:\s*0 20px 25px -5px/)
})

test('Tag management drawer has semantic dark-theme ownership for every visible surface', () => {
  assert.match(tagDrawer, /<\/style>\s*<style lang="less">/)
  const dark = tagDrawer.slice(tagDrawer.indexOf('<style lang="less">'))
  for (const selector of [
    'visual-tag-manage__overlay',
    'visual-tag-manage',
    'visual-tag-manage__header',
    'visual-tag-manage__heading h3',
    'visual-tag-manage__heading p',
    'visual-tag-manage__search',
    'visual-tag-manage__create-trigger',
    'visual-tag-tile',
    'visual-tag-tile__badge',
    'visual-tag-tile__copy strong',
    'visual-tag-tile__copy small',
    'visual-tag-tile__input',
    'visual-tag-tile__action',
    'visual-tag-manage__load-more button',
  ]) assert.match(dark, new RegExp(`\\.${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`))
  for (const token of ['--mvc-page', '--mvc-surface', '--mvc-surface-raised', '--mvc-hover', '--mvc-line', '--mvc-text', '--mvc-text-strong', '--mvc-muted', '--mvc-muted-strong']) {
    assert.match(dark, new RegExp(`var\\(${token}`), `dark tag drawer must consume ${token}`)
  }
})

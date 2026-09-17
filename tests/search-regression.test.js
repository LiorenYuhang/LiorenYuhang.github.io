'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const crypto = require('crypto');
const { search } = require('../scripts/search');

function chunk(overrides) {
  return Object.assign({ id: 'fixture-000', document_id: 'fixture', title: '实验记录',
    url: '/fixture/', section: '', content: '测量系统响应并记录结果。',
    content_type: 'paragraph', tags: [], categories: [], links: [] }, overrides);
}

test('short embedded heading substrings cannot qualify unrelated chunks', () => {
  for (const [query, section] of [['的电', '运行中的电缆'], ['与传', '结构与传感器']]) {
    assert.deepEqual(search(query, [chunk({ section })]), []);
  }
});

test('short exact heading tokens and metadata matches remain searchable', () => {
  assert.equal(search('速度', [chunk({ section: '速度' })]).length, 1);
  assert.equal(search('速度', [chunk({ section: '1. 速度' })]).length, 1);
  assert.equal(search('速度', [chunk({ tags: ['速度控制'] })]).length, 1);
});

test('longer heading phrases and contextual weak evidence remain searchable', () => {
  assert.equal(search('传感器', [chunk({ section: '系统传感器设计' })]).length, 1);
  const current = chunk({ section: '运行中的电缆', content: '运行中的电缆需要检查。' });
  assert.equal(search('的电', [current], { currentUrl: current.url }).length, 1);
});

test('page title retrieval follows source title without a special page rule', () => {
  const page = chunk({ title: '实验室使用指南', url: '/guide/' });
  const result = search(page.title, [page]);
  assert.equal(result[0].url, page.url);
  assert.ok(result[0].score >= 25);
});

test('builder excludes publication flags and draft directory, not words in published prose', () => {
  // Run the unchanged builder against an isolated source tree, never real articles.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'search-publication-fixture-'));
  for (const dir of ['scripts', 'source/_posts', 'source/_drafts']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  fs.writeFileSync(path.join(root, '_config.yml'), 'permalink: :title/\n');
  const body = '这是已经发布的技术说明，介绍草稿处理流程与 __draft__ 标记，并提供足够的正文供语义切块。\n';
  function post(dir, file, flags, text) {
    fs.writeFileSync(path.join(root, dir, file), '\uFEFF---\r\ntitle: 示例\r\ndate: 2026-01-01\r\n' + flags + '---\r\n' + text.replace(/\n/g, '\r\n'));
  }
  post('source/_posts', 'published.md', '', body);
  post('source/_posts', 'draft.md', 'draft: true\r\n', 'PRIVATE_DRAFT_SENTINEL '.repeat(10));
  post('source/_posts', 'hidden.md', 'published: false\r\n', 'PRIVATE_HIDDEN_SENTINEL '.repeat(10));
  post('source/_drafts', 'unreleased.md', '', 'PRIVATE_DIRECTORY_SENTINEL '.repeat(10));
  const source = path.resolve(__dirname, '../scripts/build-knowledge-base.js');
  const fixtureModule = new Module(path.join(root, 'scripts/build-knowledge-base.js'), module);
  fixtureModule.filename = path.join(root, 'scripts/build-knowledge-base.js');
  fixtureModule.paths = module.paths;
  fixtureModule._compile(fs.readFileSync(source, 'utf8'), fixtureModule.filename);
  const built = fixtureModule.exports.build().documents;
  assert.ok(built.length > 0);
  assert.deepEqual([...new Set(built.map(d => d.url))], ['/published/']);
  assert.ok(built.some(d => d.content.includes('草稿') && d.content.includes('draft')));
  assert.ok(built.every(d => !d.content.includes('PRIVATE_')));
  const expectedHash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 16);
  assert.ok(built.every(d => d.content_hash === expectedHash));
  assert.deepEqual(fixtureModule.exports.build().documents, built);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTimer, layerStorageKey, mistakeStorageKey, normalizeLayers, normalizePageNotes } from '../src/study.js';

test('normalizes notes to pages in the current document', () => {
  assert.deepEqual(normalizePageNotes({ 0: '重点', 2: '越界', bad: '忽略' }, 2), { 0: '重点' });
});

test('formats exam timer values', () => {
  assert.equal(formatTimer(2700), '45:00');
  assert.equal(formatTimer(3661), '01:01:01');
});

test('provides one user-managed layer by default', () => {
  assert.deepEqual(normalizeLayers(null), [{ id: 'layer-1', name: '图层 1', visible: true }]);
});

test('keeps valid user layer names and visibility', () => {
  assert.deepEqual(normalizeLayers([
    { id: 'draft', name: '答案草稿', visible: false },
    { id: 'draft', name: '重复项' },
    { id: 'notes', name: '笔记' }
  ]), [
    { id: 'draft', name: '答案草稿', visible: false },
    { id: 'notes', name: '笔记', visible: true }
  ]);
});

test('uses document-scoped keys for layers and mistake screenshots', () => {
  assert.match(layerStorageKey('试卷 A'), /试卷 A$/);
  assert.match(mistakeStorageKey('试卷 A'), /试卷 A$/);
});

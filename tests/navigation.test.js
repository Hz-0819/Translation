import test from 'node:test';
import assert from 'node:assert/strict';
import { bookmarkStorageKey, headingLevel, normalizeBookmarkIndexes } from '../src/navigation.js';

test('normalizes page bookmarks for the active document', () => {
  assert.deepEqual(normalizeBookmarkIndexes([3, 1, 3, -1, 9, '2'], 5), [1, 2, 3]);
  assert.deepEqual(normalizeBookmarkIndexes('bad data', 5), []);
});

test('uses a document-scoped bookmark key', () => {
  assert.equal(bookmarkStorageKey('练习一.docx'), 'paperlingo:bookmarks:练习一.docx');
});

test('reads outline depth from native and Word heading styles', () => {
  assert.equal(headingLevel({ tagName: 'H3', className: '' }), 3);
  assert.equal(headingLevel({ tagName: 'P', className: 'docx_heading2' }), 2);
  assert.equal(headingLevel({ tagName: 'P', className: '' }), 2);
});

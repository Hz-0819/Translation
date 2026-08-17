import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { wordPageCuts, wordPageSliceCount } from '../src/documents.js';

test('uses Word last-rendered page breaks when available', async () => {
  const source = await readFile(new URL('../src/documents.js', import.meta.url), 'utf8');
  assert.match(source, /ignoreLastRenderedPageBreak:\s*false/);
});

test('keeps fixed paper height but snaps nearby cuts to a safe block boundary', () => {
  assert.deepEqual(wordPageCuts(2400, 1000, [930, 1840], 30, 80), [0, 930, 1840]);
  assert.deepEqual(wordPageCuts(1800, 1000, [], 30, 80), [0, 940]);
});

test('splits an overflowing Word section by its paper height', () => {
  assert.equal(wordPageSliceCount(1056, 1056), 1);
  assert.equal(wordPageSliceCount(2112, 1056), 2);
  assert.equal(wordPageSliceCount(2700, 1056), 3);
  assert.equal(wordPageSliceCount(0, 0), 1);
});

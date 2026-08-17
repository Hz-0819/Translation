import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupWord, normalizeWord } from '../src/dictionary.js';

test('normalizes punctuation and case', () => {
  assert.equal(normalizeWord('“Evidence.”'), 'evidence');
});

test('looks up a known inflected word through its base entry', () => {
  assert.equal(lookupWord('encountered').meanings[0], '遇到；遭遇');
});

test('returns null for a word outside the demo dictionary', () => {
  assert.equal(lookupWord('unlisted'), null);
});

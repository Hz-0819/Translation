import test from 'node:test';
import assert from 'node:assert/strict';
import { wordFromTarget, isSentenceSelection } from '../src/selection.js';

test('reads a directly tapped marked word', () => {
  const mark = { textContent: 'evidence' };
  const target = { closest: selector => selector === 'mark' ? mark : null, matches: () => false };
  assert.equal(wordFromTarget(target), 'evidence');
});

test('does not mistake an entire PDF text line for one word', () => {
  const target = { textContent: 'A complete line of text', closest: () => null, matches: () => true };
  assert.equal(wordFromTarget(target), '');
});

test('distinguishes a selected sentence from a single selected word', () => {
  assert.equal(isSentenceSelection('evidence'), false);
  assert.equal(isSentenceSelection('Evidence changes the conclusion.'), true);
});

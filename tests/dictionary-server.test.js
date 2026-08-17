import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  createDictionaryStore,
  normalizeDictionaryQuery
} from '../server/dictionary.js';

const databasePath = fileURLToPath(new URL('../data/ecdict.sqlite', import.meta.url));

test('complete dictionary contains more than 700,000 entries', () => {
  const store = createDictionaryStore(databasePath);
  assert.ok(store.count() > 700_000);
  store.close();
});

test('returns a rich entry outside the former demo vocabulary', () => {
  const store = createDictionaryStore(databasePath);
  const entry = store.find('compelling');
  assert.equal(entry.word.toLowerCase(), 'compelling');
  assert.ok(entry.meanings.length > 0);
  assert.ok(entry.definitions.length > 0);
  store.close();
});

test('contains a long-tail dictionary word', () => {
  const store = createDictionaryStore(databasePath);
  assert.ok(store.find('zyzzyva'));
  store.close();
});

test('rejects SQL-injection-shaped and oversized queries', () => {
  assert.equal(normalizeDictionaryQuery("word' OR 1=1 --"), '');
  assert.equal(normalizeDictionaryQuery('a'.repeat(81)), '');
});

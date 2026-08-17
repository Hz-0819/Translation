import test from 'node:test';
import assert from 'node:assert/strict';
import { addMistakeEntry, createMistakeBook, defaultWorkspaceState, normalizeWorkspaceState, tracePageIndexes } from '../src/workspace-state.js';

test('creates a resource-first workspace with an independent mistake book area', () => {
  const state = defaultWorkspaceState();
  assert.equal(state.documents[0].id, 'sample');
  assert.equal(state.mistakeBooks[0].name, '默认错题本');
  assert.deepEqual(state.mistakeEntries, []);
});

test('creates user mistake books and cross-file entries', () => {
  let state = defaultWorkspaceState();
  const result = createMistakeBook(state, '阅读错题');
  state = result.state;
  state = addMistakeEntry(state, {
    bookId: result.book.id, documentId: 'paper-a', documentTitle: '英语一模.pdf', pageIndex: 4, image: 'data:image/jpeg;base64,test'
  });
  assert.equal(state.mistakeEntries[0].bookId, result.book.id);
  assert.equal(state.mistakeEntries[0].documentId, 'paper-a');
});

test('normalizes invalid persisted workspace values', () => {
  const state = normalizeWorkspaceState({ documents: 'bad', mistakeBooks: [], excerptsByDocument: null });
  assert.equal(state.documents.length, 1);
  assert.equal(state.mistakeBooks.length, 1);
  assert.deepEqual(state.excerptsByDocument, {});
});

test('trace pages combine ink and excerpt activity without manual notes', () => {
  assert.deepEqual(tracePageIndexes({ inkPages: [3, 1], excerpts: [{ pageIndex: 2 }, { pageIndex: 1 }] }), [1, 2, 3]);
});

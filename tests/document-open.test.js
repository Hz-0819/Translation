import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { indexedDB } from 'fake-indexeddb';

import { DocumentLibrary, mergeDocumentCatalog } from '../src/document-library.js';
import { DocumentRepository } from '../src/storage/document-repository.js';

test('imports before rendering and reopens the stored Blob without a file picker', async () => {
  const events = [];
  const databaseName = `paperlingo-open-${randomUUID()}`;
  const repository = new DocumentRepository({ indexedDB, databaseName });
  const originalSave = repository.saveImportedFile.bind(repository);
  repository.saveImportedFile = async (...args) => {
    events.push('saved');
    return originalSave(...args);
  };
  const library = new DocumentLibrary({
    repository,
    renderFile: async file => {
      events.push('rendered');
      assert.equal(await file.text(), 'persistent PDF');
      return { type: 'pdf', pages: 2, title: file.name };
    }
  });
  const file = new File(['persistent PDF'], 'exam.pdf', { type: 'application/pdf' });

  const imported = await library.importFile(file, { id: randomUUID(), tags: [] });
  assert.deepEqual(events, ['saved', 'rendered']);
  assert.equal(imported.pageCount, 2);
  repository.close();

  const reopenedRepository = new DocumentRepository({ indexedDB, databaseName });
  let reopenedName = '';
  const reopenedLibrary = new DocumentLibrary({
    repository: reopenedRepository,
    renderFile: async storedFile => {
      reopenedName = storedFile.name;
      return { type: 'pdf', pages: 2, title: storedFile.name };
    }
  });
  const result = await reopenedLibrary.openResource(imported.id);
  assert.equal(result.status, 'opened');
  assert.equal(reopenedName, 'exam.pdf');
  assert.equal(await (await reopenedRepository.getFile(imported.id)).text(), 'persistent PDF');
  reopenedRepository.close();
});

test('reports a recoverable missing-local-file state and marks legacy metadata', async () => {
  const updates = [];
  const document = { id: 'legacy-file', title: '旧试卷.pdf', type: 'pdf' };
  const repository = {
    getDocument: async () => document,
    getFile: async () => null,
    updateDocument: async (id, patch) => { updates.push({ id, patch }); return { ...document, ...patch }; }
  };
  const library = new DocumentLibrary({
    repository,
    renderFile: async () => { throw new Error('must not render'); }
  });

  const result = await library.openResource(document.id);
  assert.equal(result.status, 'missing-local-file');
  assert.equal(updates[0].patch.localAvailability, 'missing-local-file');

  const catalog = mergeDocumentCatalog(
    [{ id: 'sample', title: '示例', type: 'sample' }, document, { id: 'blank-1', title: '笔记', type: 'blank' }],
    []
  );
  assert.equal(catalog.find(item => item.id === 'legacy-file').localAvailability, 'missing-local-file');
  assert.equal(catalog.find(item => item.id === 'blank-1').localAvailability, undefined);
});

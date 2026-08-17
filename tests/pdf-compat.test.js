import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('uses the legacy PDF.js build required by older iPad Safari', async () => {
  const source = await readFile(new URL('../src/documents.js', import.meta.url), 'utf8');
  assert.match(source, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(source, /pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs\?url/);
  assert.doesNotMatch(source, /import\(['"]pdfjs-dist['"]\)/);
});

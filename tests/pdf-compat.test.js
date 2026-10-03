import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('uses the legacy PDF.js build required by older iPad Safari', async () => {
  const source = await readFile(new URL('../src/documents.js', import.meta.url), 'utf8');
  assert.match(source, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(source, /pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs\?url/);
  assert.doesNotMatch(source, /import\(['"]pdfjs-dist['"]\)/);
});

test('renders large PDFs near the viewport instead of allocating every page canvas', async () => {
  const source = await readFile(new URL('../src/documents.js', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /rootMargin: '140% 0px'/);
  assert.match(source, /releasePdfPage/);
  assert.match(source, /canvas\.width = 1/);
  assert.match(styles, /\.workspace\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
});

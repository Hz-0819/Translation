import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import { createDictionaryMiddleware, createDictionaryStore } from './server/dictionary.js';

const dictionaryPath = fileURLToPath(new URL('./data/ecdict.sqlite', import.meta.url));

function dictionaryPlugin() {
  const attach = server => {
    const store = createDictionaryStore(dictionaryPath);
    server.middlewares.use('/api/dictionary', createDictionaryMiddleware(store));
    server.httpServer?.once('close', () => store.close());
  };
  return {
    name: 'paperlingo-dictionary',
    configureServer: attach,
    configurePreviewServer: attach
  };
}

export default defineConfig({
  plugins: [
    dictionaryPlugin(),
    legacy({
      modernTargets: ['defaults', 'iOS >= 13', 'Android >= 8'],
      modernPolyfills: true,
      renderLegacyChunks: false
    })
  ]
});

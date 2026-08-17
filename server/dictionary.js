import { DatabaseSync } from 'node:sqlite';

const FIELD_NAMES = [
  'word', 'phonetic', 'definition', 'translation', 'pos', 'collins',
  'oxford', 'tag', 'bnc', 'frq', 'exchange', 'detail', 'audio'
];

export function normalizeDictionaryQuery(input = '') {
  const word = String(input).trim().toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
  return word.length <= 80 && /^[a-z]+(?:['-][a-z]+)*$/i.test(word) ? word : '';
}

function lines(value) {
  return String(value || '').split(/\r?\n|\\n/).map(item => item.trim()).filter(Boolean);
}

function parseExchange(value) {
  const labels = {
    p: '过去式', d: '过去分词', i: '现在分词', '3': '第三人称单数',
    r: '比较级', t: '最高级', s: '复数', '0': '原形', '1': '原形'
  };
  return String(value || '').split('/').flatMap(part => {
    const splitAt = part.indexOf(':');
    if (splitAt < 1) return [];
    const type = part.slice(0, splitAt);
    const forms = part.slice(splitAt + 1).split(',').filter(Boolean);
    return forms.map(form => ({ label: labels[type] || type, value: form }));
  });
}

export function formatEntry(row) {
  if (!row) return null;
  return {
    word: row.word,
    phonetic: row.phonetic ? `/${row.phonetic.replace(/^\/+|\/+$/g, '')}/` : '',
    part: row.pos || '',
    meanings: lines(row.translation),
    definitions: lines(row.definition),
    tags: String(row.tag || '').split(/\s+/).filter(Boolean).map(tag => tag.toUpperCase()),
    collins: Number(row.collins) || 0,
    oxford: Boolean(Number(row.oxford)),
    bnc: Number(row.bnc) || 0,
    frequency: Number(row.frq) || 0,
    forms: parseExchange(row.exchange),
    audio: row.audio || ''
  };
}

export function createDictionaryStore(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const lookup = database.prepare(`
    SELECT ${FIELD_NAMES.join(', ')}
    FROM entries
    WHERE word = ? COLLATE NOCASE
    LIMIT 1
  `);
  return {
    find(input) {
      const word = normalizeDictionaryQuery(input);
      return word ? formatEntry(lookup.get(word)) : null;
    },
    count() {
      return database.prepare('SELECT COUNT(*) AS total FROM entries').get().total;
    },
    close() {
      database.close();
    }
  };
}

export function createDictionaryMiddleware(store) {
  return (request, response) => {
    if (request.method !== 'GET') {
      response.statusCode = 405;
      response.end('Method Not Allowed');
      return;
    }
    const url = new URL(request.url, 'http://paperlingo.local');
    const query = url.searchParams.get('q') || '';
    const normalized = normalizeDictionaryQuery(query);
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=86400');
    if (!normalized) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: 'invalid_query' }));
      return;
    }
    const entry = store.find(normalized);
    if (!entry) {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: 'not_found', word: normalized }));
      return;
    }
    response.statusCode = 200;
    response.end(JSON.stringify(entry));
  };
}

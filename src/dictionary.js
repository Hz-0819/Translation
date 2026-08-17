const ENTRIES = {
  ambiguous: { phonetic: '/æmˈbɪɡjuəs/', part: 'adj.', meanings: ['模棱两可的', '含糊不清的'], level: 'CET-6' },
  encounter: { phonetic: '/ɪnˈkaʊntə(r)/', part: 'v. / n.', meanings: ['遇到；遭遇', '偶然相遇'], level: 'CET-4' },
  encountered: { base: 'encounter' },
  sustainable: { phonetic: '/səˈsteɪnəbl/', part: 'adj.', meanings: ['可持续的', '能够维持的'], level: 'IELTS' },
  assumption: { phonetic: '/əˈsʌmpʃn/', part: 'n.', meanings: ['假定；假设', '承担；取得'], level: 'CET-6' },
  assumptions: { base: 'assumption' },
  evidence: { phonetic: '/ˈevɪdəns/', part: 'n.', meanings: ['证据；根据', '迹象'], level: 'CET-4' },
  compelling: { phonetic: '/kəmˈpelɪŋ/', part: 'adj.', meanings: ['令人信服的', '不可抗拒的'], level: 'CET-6' },
  perspective: { phonetic: '/pəˈspektɪv/', part: 'n.', meanings: ['观点；视角', '透视法'], level: 'CET-6' },
  conventional: { phonetic: '/kənˈvenʃənl/', part: 'adj.', meanings: ['传统的；常规的'], level: 'CET-6' },
  consequence: { phonetic: '/ˈkɒnsɪkwəns/', part: 'n.', meanings: ['结果；后果', '重要性'], level: 'CET-4' },
  resilient: { phonetic: '/rɪˈzɪliənt/', part: 'adj.', meanings: ['有韧性的', '能迅速恢复的'], level: 'IELTS' }
};

export function normalizeWord(value = '') {
  return value.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
}

export function lookupWord(value) {
  const word = normalizeWord(value);
  let entry = ENTRIES[word];
  if (!entry && word.endsWith('s')) entry = ENTRIES[word.slice(0, -1)];
  if (!entry && word.endsWith('ed')) entry = ENTRIES[word.slice(0, -2)] || ENTRIES[`${word.slice(0, -1)}`];
  if (!entry && word.endsWith('ing')) entry = ENTRIES[word.slice(0, -3)] || ENTRIES[`${word.slice(0, -3)}e`];
  if (entry?.base) entry = ENTRIES[entry.base];
  return entry ? { word, ...entry } : null;
}

const COMPLETE_CACHE = new Map();

export async function lookupCompleteWord(value, { timeoutMs = 5000 } = {}) {
  const word = normalizeWord(value);
  if (!word) return null;
  if (COMPLETE_CACHE.has(word)) return COMPLETE_CACHE.get(word);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/dictionary?q=${encodeURIComponent(word)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (response.status === 404) {
      COMPLETE_CACHE.set(word, null);
      return null;
    }
    if (!response.ok) throw new Error(`dictionary_${response.status}`);
    const entry = await response.json();
    COMPLETE_CACHE.set(word, entry);
    return entry;
  } finally {
    clearTimeout(timer);
  }
}

export function demoSentenceTranslation(text) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const known = {
    'evidence can be compelling without being complete.': '证据即使并不完整，也可能很有说服力。',
    'a resilient system learns from unexpected consequences.': '一个有韧性的系统会从意外后果中学习。',
    'from another perspective, the assumption appears ambiguous.': '从另一个角度看，这一假设似乎含糊不清。'
  };
  return known[normalized.toLowerCase()] || '演示版尚未连接在线句子翻译服务；单词释义仍可离线使用。';
}

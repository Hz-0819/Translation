const sampleDocument = () => ({
  id: 'sample', title: '阅读练习 · Ways of Seeing', type: 'sample', createdAt: 0, updatedAt: 0, lastOpenedAt: 0, folderId: null, tags: ['英语']
});

export function defaultWorkspaceState() {
  return {
    documents: [sampleDocument()],
    folders: [],
    mistakeBooks: [{ id: 'mistake-default', name: '默认错题本', color: '#d8ef8f', createdAt: 0 }],
    mistakeEntries: [],
    excerptsByDocument: {},
    outlinesByDocument: {}
  };
}

export function normalizeWorkspaceState(value) {
  const fallback = defaultWorkspaceState();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const documents = Array.isArray(source.documents) ? source.documents.filter(item => item?.id && item?.title) : [];
  const mistakeBooks = Array.isArray(source.mistakeBooks) ? source.mistakeBooks.filter(item => item?.id && item?.name) : [];
  return {
    documents: documents.length ? documents : fallback.documents,
    folders: Array.isArray(source.folders) ? source.folders.filter(item => item?.id && item?.name) : [],
    mistakeBooks: mistakeBooks.length ? mistakeBooks : fallback.mistakeBooks,
    mistakeEntries: Array.isArray(source.mistakeEntries) ? source.mistakeEntries.filter(item => item?.id && item?.bookId && item?.image) : [],
    excerptsByDocument: source.excerptsByDocument && typeof source.excerptsByDocument === 'object' && !Array.isArray(source.excerptsByDocument) ? source.excerptsByDocument : {},
    outlinesByDocument: source.outlinesByDocument && typeof source.outlinesByDocument === 'object' && !Array.isArray(source.outlinesByDocument) ? source.outlinesByDocument : {}
  };
}

export function createMistakeBook(state, rawName) {
  const name = String(rawName || '').trim().slice(0, 40) || '未命名错题本';
  const book = { id: `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, color: '#d8ef8f', createdAt: Date.now() };
  return { state: { ...state, mistakeBooks: [...state.mistakeBooks, book] }, book };
}

export function addMistakeEntry(state, input) {
  const entry = {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    bookId: input.bookId,
    documentId: input.documentId,
    documentTitle: String(input.documentTitle || ''),
    pageIndex: Math.max(0, Number(input.pageIndex) || 0),
    image: input.image,
    note: String(input.note || ''),
    tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 12) : [],
    createdAt: Date.now()
  };
  return { ...state, mistakeEntries: [entry, ...state.mistakeEntries] };
}

export function tracePageIndexes({ inkPages = [], excerpts = [] } = {}) {
  return [...new Set([...inkPages, ...excerpts.map(item => Number(item.pageIndex))]
    .filter(index => Number.isInteger(index) && index >= 0))].sort((a, b) => a - b);
}

export function addExcerpt(state, documentId, input) {
  const excerpt = { id: `excerpt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, pageIndex: input.pageIndex, image: input.image, note: String(input.note || ''), tags: [], createdAt: Date.now() };
  const current = Array.isArray(state.excerptsByDocument[documentId]) ? state.excerptsByDocument[documentId] : [];
  return { state: { ...state, excerptsByDocument: { ...state.excerptsByDocument, [documentId]: [excerpt, ...current] } }, excerpt };
}

export function addOutlineNode(state, documentId, input) {
  const node = { id: `outline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: String(input.label || '未命名大纲').trim().slice(0, 80), pageIndex: Math.max(0, Number(input.pageIndex) || 0), parentId: input.parentId || null };
  const current = Array.isArray(state.outlinesByDocument[documentId]) ? state.outlinesByDocument[documentId] : [];
  return { state: { ...state, outlinesByDocument: { ...state.outlinesByDocument, [documentId]: [...current, node] } }, node };
}

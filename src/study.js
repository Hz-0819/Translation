export function noteStorageKey(title = '') {
  return `paperlingo:notes:${String(title).slice(0, 180)}`;
}

export function normalizePageNotes(value, pageCount) {
  const count = Math.max(0, Number(pageCount) || 0);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .map(([index, note]) => [Number(index), String(note || '').slice(0, 8000)])
    .filter(([index, note]) => Number.isInteger(index) && index >= 0 && index < count && note.trim()));
}

export function formatTimer(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function layerStorageKey(title = '') {
  return `paperlingo:layers:${String(title).slice(0, 180)}`;
}

export function mistakeStorageKey(title = '') {
  return `paperlingo:mistakes:${String(title).slice(0, 180)}`;
}

export function normalizeLayers(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const layers = source.flatMap((item, index) => {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name: String(item?.name || `图层 ${index + 1}`).trim().slice(0, 30) || `图层 ${index + 1}`, visible: item?.visible !== false }];
  });
  return layers.length ? layers : [{ id: 'layer-1', name: '图层 1', visible: true }];
}

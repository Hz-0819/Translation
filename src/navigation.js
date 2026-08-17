export function normalizeBookmarkIndexes(values, pageCount) {
  const count = Math.max(0, Number(pageCount) || 0);
  return [...new Set((Array.isArray(values) ? values : [])
    .map(Number)
    .filter(value => Number.isInteger(value) && value >= 0 && value < count))]
    .sort((a, b) => a - b);
}

export function bookmarkStorageKey(title = '') {
  return `paperlingo:bookmarks:${String(title).slice(0, 180)}`;
}

export function headingLevel(element) {
  const tagMatch = /^H([1-6])$/.exec(element?.tagName || '');
  if (tagMatch) return Number(tagMatch[1]);
  const classMatch = /heading[_-]?(\d)/i.exec(element?.className || '');
  return classMatch ? Number(classMatch[1]) : 2;
}

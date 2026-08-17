export function wordAtPoint(clientX, clientY) {
  let range;
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(clientX, clientY);
    if (!position?.offsetNode) return '';
    range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  }
  const node = range?.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE) return '';
  const text = node.textContent;
  let start = range.startOffset;
  let end = range.startOffset;
  while (start > 0 && /[A-Za-z'-]/.test(text[start - 1])) start -= 1;
  while (end < text.length && /[A-Za-z'-]/.test(text[end])) end += 1;
  return text.slice(start, end);
}

export function selectedText() {
  return window.getSelection()?.toString().trim() || '';
}

export function isSentenceSelection(value) {
  const text = String(value || '').trim();
  return text.length > 0 && /\s/.test(text);
}

export function wordFromTarget(target) {
  if (!target) return '';
  const marked = target.closest?.('mark');
  const candidate = marked?.textContent || (target.matches?.('.pdf-text-layer span') ? target.textContent : '');
  const word = String(candidate || '').trim();
  return /^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(word) ? word : '';
}

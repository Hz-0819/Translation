export function normalizePoint(clientX, clientY, rect) {
  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  };
}

export function denormalizePoint(point, width, height) {
  return { x: point.x * width, y: point.y * height };
}

export function parseStoredStrokes(raw) {
  try {
    const value = JSON.parse(raw || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function createInkLayer(canvas, storageKey, getTool) {
  const ctx = canvas.getContext('2d');
  let stored = '[]';
  try { stored = localStorage.getItem(storageKey) || '[]'; } catch { /* Private browsing fallback. */ }
  let strokes = parseStoredStrokes(stored);
  const initialTool = getTool();
  const fallbackLayerId = typeof initialTool === 'object' ? (initialTool.layerId || 'annotation') : 'annotation';
  strokes = strokes.map((stroke, index) => ({ ...stroke, id: stroke.id || `stroke-legacy-${index}`, layerId: stroke.layerId || fallbackLayerId }));
  let undoStack = [];
  let redoStack = [];
  let active = null;
  let activeSource = '';
  let ignoreMouseUntil = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  };

  const draw = () => {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const hiddenLayers = new Set(toolState().hiddenLayers || []);
    for (const stroke of strokes) {
      if (hiddenLayers.has(stroke.layerId || 'annotation')) continue;
      if (!stroke.points?.length) continue;
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        const p = denormalizePoint(point, rect.width, rect.height);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = stroke.color || '#173c36';
      ctx.lineWidth = stroke.width || 2.2;
      ctx.globalAlpha = stroke.opacity ?? 1;
      if (stroke.points.length === 1) {
        const p = denormalizePoint(stroke.points[0], rect.width, rect.height);
        ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color || '#173c36';
        ctx.fill();
      } else ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(strokes)); } catch { /* Continue without persistence. */ }
  };
  const snapshot = () => strokes.map(stroke => ({ ...stroke, points: stroke.points?.map(point => ({ ...point })) || [] }));
  const remember = () => {
    undoStack.push(snapshot());
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
  };
  const toolState = () => {
    const value = getTool();
    return typeof value === 'string' ? { mode: value } : value;
  };
  const eraseAt = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const point = normalizePoint(clientX, clientY, rect);
    const radius = Math.max(14, Math.min(rect.width, rect.height) * .025);
    const before = strokes.length;
    const activeLayerId = toolState().layerId || 'annotation';
    const next = strokes.filter(stroke => (stroke.layerId || 'annotation') !== activeLayerId || !stroke.points?.some(item => {
      const dx = (item.x - point.x) * rect.width;
      const dy = (item.y - point.y) * rect.height;
      return Math.hypot(dx, dy) <= radius;
    }));
    if (next.length !== before) {
      if (!active?.historySaved) {
        remember();
        if (active) active.historySaved = true;
      }
      strokes = next;
      save();
      draw();
      return true;
    }
    return false;
  };
  const begin = (clientX, clientY, inputType = 'touch', source = inputType) => {
    const tool = toolState();
    if (!['ink', 'highlight', 'eraser'].includes(tool.mode) || active) return;
    activeSource = source;
    if (tool.mode === 'eraser') {
      active = { eraser: true, historySaved: false };
      eraseAt(clientX, clientY);
      return;
    }
    remember();
    active = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      color: tool.color || (tool.mode === 'highlight' ? '#e2ef78' : '#173c36'),
      width: tool.width || (tool.mode === 'highlight' ? 16 : (inputType === 'pen' ? 2 : 2.4)),
      opacity: tool.opacity ?? (tool.mode === 'highlight' ? .32 : 1),
      kind: tool.mode,
      layerId: tool.layerId || 'annotation',
      points: []
    };
    active.points.push(normalizePoint(clientX, clientY, canvas.getBoundingClientRect()));
    strokes.push(active);
  };
  const move = (clientX, clientY, source) => {
    if (!active || activeSource !== source) return;
    if (active.eraser) {
      eraseAt(clientX, clientY);
      return;
    }
    active.points.push(normalizePoint(clientX, clientY, canvas.getBoundingClientRect()));
    draw();
  };
  const finish = source => {
    if (!active || activeSource !== source) return;
    active = null;
    activeSource = '';
    save();
  };
  const removers = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  if (typeof window.PointerEvent === 'function') {
    listen(canvas, 'pointerdown', event => {
      if (!['ink', 'highlight', 'eraser'].includes(toolState().mode)) return;
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      begin(event.clientX, event.clientY, event.pointerType, 'pointer');
    });
    listen(canvas, 'pointermove', event => {
      if (!active || activeSource !== 'pointer') return;
      event.preventDefault();
      move(event.clientX, event.clientY, 'pointer');
    });
    listen(canvas, 'pointerup', () => finish('pointer'));
    listen(canvas, 'pointercancel', () => finish('pointer'));
  }
  // Register touch listeners even when PointerEvent exists. Some tablet WebViews
  // advertise PointerEvent but fail to deliver a complete stylus/touch sequence.
  listen(canvas, 'touchstart', event => {
    if (!['ink', 'highlight', 'eraser'].includes(toolState().mode) || !event.touches[0]) return;
    event.preventDefault();
    ignoreMouseUntil = Date.now() + 800;
    if (activeSource === 'pointer') activeSource = 'touch';
    else begin(event.touches[0].clientX, event.touches[0].clientY, 'touch', 'touch');
  }, { passive: false });
  listen(canvas, 'touchmove', event => {
    if (!active || activeSource !== 'touch' || !event.touches[0]) return;
    event.preventDefault();
    move(event.touches[0].clientX, event.touches[0].clientY, 'touch');
  }, { passive: false });
  listen(canvas, 'touchend', () => finish('touch'));
  listen(canvas, 'touchcancel', () => finish('touch'));
  listen(canvas, 'mousedown', event => {
    if (Date.now() < ignoreMouseUntil || active) return;
    event.preventDefault();
    begin(event.clientX, event.clientY, 'mouse', 'mouse');
  });
  listen(window, 'mousemove', event => move(event.clientX, event.clientY, 'mouse'));
  listen(window, 'mouseup', () => finish('mouse'));
  let observer = null;
  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
  } else {
    listen(window, 'resize', resize);
    listen(window, 'orientationchange', resize);
  }
  resize();

  return {
    clear(layerId = null) {
      const before = strokes.length;
      const next = layerId ? strokes.filter(stroke => (stroke.layerId || 'annotation') !== layerId) : [];
      if (next.length === before) return false;
      remember();
      strokes = next;
      save();
      draw();
      return true;
    },
    undo() {
      if (!undoStack.length) return false;
      redoStack.push(snapshot());
      strokes = undoStack.pop();
      save();
      draw();
      return true;
    },
    redo() {
      if (!redoStack.length) return false;
      undoStack.push(snapshot());
      strokes = redoStack.pop();
      save();
      draw();
      return true;
    },
    hasInk(layerId = null) { return layerId ? strokes.some(stroke => (stroke.layerId || 'annotation') === layerId) : strokes.length > 0; },
    selectInRect(rect, layerId = null) {
      const left = Math.min(rect.left, rect.right);
      const right = Math.max(rect.left, rect.right);
      const top = Math.min(rect.top, rect.bottom);
      const bottom = Math.max(rect.top, rect.bottom);
      return strokes.filter(stroke => (!layerId || stroke.layerId === layerId) && stroke.points?.some(point => point.x >= left && point.x <= right && point.y >= top && point.y <= bottom)).map(stroke => stroke.id);
    },
    deleteSelection(ids = []) {
      const selected = new Set(ids);
      const before = strokes.length;
      const next = strokes.filter(stroke => !selected.has(stroke.id));
      if (next.length === before) return false;
      remember();
      strokes = next;
      save(); draw(); return true;
    },
    duplicateSelection(ids = [], offset = { x: .025, y: .025 }) {
      const selected = new Set(ids);
      const copies = strokes.filter(stroke => selected.has(stroke.id)).map(stroke => ({ ...stroke, id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, points: stroke.points.map(point => ({ x: Math.max(0, Math.min(1, point.x + offset.x)), y: Math.max(0, Math.min(1, point.y + offset.y)) })) }));
      if (!copies.length) return [];
      remember();
      strokes.push(...copies); save(); draw(); return copies.map(stroke => stroke.id);
    },
    transformSelection(ids = [], transform = {}) {
      const selected = new Set(ids);
      const dx = Number(transform.dx) || 0;
      const dy = Number(transform.dy) || 0;
      const scale = Number(transform.scale) || 1;
      const origin = transform.origin || { x: .5, y: .5 };
      if (!strokes.some(stroke => selected.has(stroke.id))) return false;
      remember();
      strokes = strokes.map(stroke => {
        if (!selected.has(stroke.id)) return stroke;
        return { ...stroke, points: stroke.points.map(point => ({ x: Math.max(0, Math.min(1, origin.x + (point.x - origin.x) * scale + dx)), y: Math.max(0, Math.min(1, origin.y + (point.y - origin.y) * scale + dy)) })) };
      });
      save(); draw();
      return true;
    },
    redraw() { draw(); },
    destroy() { observer?.disconnect(); removers.forEach(remove => remove()); }
  };
}

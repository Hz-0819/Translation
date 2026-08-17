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
  strokes = strokes.map(stroke => ({ ...stroke, layerId: stroke.layerId || fallbackLayerId }));
  let redoStrokes = [];
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
    strokes = strokes.filter(stroke => (stroke.layerId || 'annotation') !== activeLayerId || !stroke.points?.some(item => {
      const dx = (item.x - point.x) * rect.width;
      const dy = (item.y - point.y) * rect.height;
      return Math.hypot(dx, dy) <= radius;
    }));
    if (strokes.length !== before) {
      redoStrokes = [];
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
      active = { eraser: true };
      eraseAt(clientX, clientY);
      return;
    }
    redoStrokes = [];
    active = {
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
      strokes = layerId ? strokes.filter(stroke => (stroke.layerId || 'annotation') !== layerId) : [];
      if (strokes.length === before) return false;
      redoStrokes = [];
      save();
      draw();
      return true;
    },
    undo() {
      const layerId = toolState().layerId || 'annotation';
      let index = strokes.length - 1;
      while (index >= 0 && (strokes[index].layerId || 'annotation') !== layerId) index -= 1;
      if (index < 0) return false;
      const [stroke] = strokes.splice(index, 1);
      redoStrokes.push(stroke);
      save();
      draw();
      return true;
    },
    redo() {
      const layerId = toolState().layerId || 'annotation';
      let index = redoStrokes.length - 1;
      while (index >= 0 && (redoStrokes[index].layerId || 'annotation') !== layerId) index -= 1;
      if (index < 0) return false;
      const [stroke] = redoStrokes.splice(index, 1);
      strokes.push(stroke);
      save();
      draw();
      return true;
    },
    hasInk(layerId = null) { return layerId ? strokes.some(stroke => (stroke.layerId || 'annotation') === layerId) : strokes.length > 0; },
    redraw() { draw(); },
    destroy() { observer?.disconnect(); removers.forEach(remove => remove()); }
  };
}

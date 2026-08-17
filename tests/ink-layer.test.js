import test from 'node:test';
import assert from 'node:assert/strict';
import { createInkLayer } from '../src/ink.js';

test('ink layer supports draw, undo, redo and clear', () => {
  const canvasListeners = new Map();
  const windowListeners = new Map();
  const stored = new Map();
  const context = {
    setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {}, arc() {}, fill() {}
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 600 }),
    addEventListener: (type, handler) => canvasListeners.set(type, handler),
    removeEventListener() {}
  };
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalResizeObserver = globalThis.ResizeObserver;
  globalThis.window = {
    devicePixelRatio: 1,
    PointerEvent: undefined,
    addEventListener: (type, handler) => windowListeners.set(type, handler),
    removeEventListener() {}
  };
  globalThis.localStorage = {
    getItem: key => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value)
  };
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };

  try {
    const layer = createInkLayer(canvas, 'ink-test', () => ({ mode: 'ink', color: '#000', width: 3, opacity: 1 }));
    canvasListeners.get('mousedown')({ clientX: 40, clientY: 60, preventDefault() {} });
    windowListeners.get('mousemove')({ clientX: 80, clientY: 100 });
    windowListeners.get('mouseup')();

    const selected = layer.selectInRect({ left: 0, top: 0, right: .5, bottom: .5 });
    assert.equal(selected.length, 1);
    const copies = layer.duplicateSelection(selected);
    assert.equal(copies.length, 1);
    assert.equal(layer.transformSelection(copies, { dx: .1, dy: .1, scale: 1.1 }), true);
    assert.equal(layer.deleteSelection(copies), true);

    assert.equal(layer.undo(), true);
    assert.equal(layer.undo(), true);
    assert.equal(layer.redo(), true);
    assert.equal(layer.redo(), true);
    assert.equal(layer.clear(), true);
    assert.equal(layer.clear(), false);
    layer.destroy();
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.ResizeObserver = originalResizeObserver;
  }
});

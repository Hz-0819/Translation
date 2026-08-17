import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPress } from '../src/input.js';

function fakeElement() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); }
  };
}

test('bindPress activates tablet pointer input and suppresses the following click', () => {
  const originalWindow = globalThis.window;
  globalThis.window = { PointerEvent: class {} };
  try {
    const element = fakeElement();
    let activations = 0;
    const dispose = bindPress(element, () => { activations += 1; });
    element.listeners.get('pointerup')({ type: 'pointerup', pointerType: 'touch', button: 0, preventDefault() {} });
    element.listeners.get('click')({ type: 'click', preventDefault() {} });
    assert.equal(activations, 1);
    dispose();
    assert.equal(element.listeners.size, 0);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('bindPress leaves desktop mouse activation to the native click event', () => {
  const originalWindow = globalThis.window;
  globalThis.window = { PointerEvent: class {} };
  try {
    const element = fakeElement();
    let activations = 0;
    bindPress(element, () => { activations += 1; });
    element.listeners.get('pointerup')({ type: 'pointerup', pointerType: 'mouse', button: 0, preventDefault() { throw new Error('mouse pointerup must stay native'); } });
    assert.equal(activations, 0);
    element.listeners.get('click')({ type: 'click', preventDefault() {} });
    assert.equal(activations, 1);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('bindPress keeps touch fallback when PointerEvent is unavailable', () => {
  const originalWindow = globalThis.window;
  globalThis.window = { PointerEvent: undefined };
  try {
    const element = fakeElement();
    let activations = 0;
    bindPress(element, () => { activations += 1; });
    element.listeners.get('touchend')({ type: 'touchend', preventDefault() {} });
    assert.equal(activations, 1);
    assert.equal(element.listeners.has('pointerup'), false);
  } finally {
    globalThis.window = originalWindow;
  }
});

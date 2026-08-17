import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolInstance, defaultToolInstances, normalizeToolInstances, toolDefinition } from '../src/tool-registry.js';

test('defines pen as a family with multiple subtypes', () => {
  const definition = toolDefinition('pen');
  assert.deepEqual(definition.subtypes.map(item => item.id), ['fountain', 'pencil', 'ballpoint', 'highlighter']);
});

test('creates independent configured pen instances', () => {
  const red = createToolInstance('pen', { subtype: 'fountain', color: '#dc3c3c', width: 1.5 });
  const yellow = createToolInstance('pen', { subtype: 'highlighter', color: '#e2ef78', opacity: .3 });
  assert.notEqual(red.id, yellow.id);
  assert.equal(red.params.color, '#dc3c3c');
  assert.equal(yellow.subtype, 'highlighter');
});

test('normalizes tool instances and retains at least one writing tool', () => {
  const tools = normalizeToolInstances([{ id: 'move', type: 'pan', visible: true }]);
  assert.ok(tools.some(item => item.type === 'pen'));
});

test('provides a compact useful default toolbar', () => {
  const tools = defaultToolInstances();
  assert.ok(tools.some(item => item.type === 'lasso'));
  assert.ok(tools.some(item => item.type === 'lookup'));
  assert.equal(new Set(tools.map(item => item.id)).size, tools.length);
});

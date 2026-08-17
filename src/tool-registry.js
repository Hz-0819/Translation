const definitions = {
  pen: {
    id: 'pen', label: '笔', icon: 'pen-nib', configurable: true,
    subtypes: [
      { id: 'fountain', label: '钢笔', icon: 'pen-nib', defaults: { color: '#173c36', width: 2.4, opacity: 1, pressure: true } },
      { id: 'pencil', label: '铅笔', icon: 'pencil-simple', defaults: { color: '#46514e', width: 2, opacity: .78, pressure: true } },
      { id: 'ballpoint', label: '圆珠笔', icon: 'pen', defaults: { color: '#1d4ed8', width: 1.8, opacity: 1, pressure: false } },
      { id: 'highlighter', label: '荧光笔', icon: 'highlighter', defaults: { color: '#e2ef78', width: 16, opacity: .32, pressure: false } }
    ]
  },
  eraser: { id: 'eraser', label: '橡皮', icon: 'eraser', configurable: false },
  lasso: { id: 'lasso', label: '套索', icon: 'selection', configurable: true, defaults: { shape: 'rect' } },
  lookup: { id: 'lookup', label: '查词', icon: 'translate', configurable: false },
  pan: { id: 'pan', label: '浏览', icon: 'hand', configurable: false }
};

export function toolDefinition(type) { return definitions[type] || null; }

export function createToolInstance(type, options = {}) {
  const definition = toolDefinition(type);
  if (!definition) throw new Error(`Unknown tool type: ${type}`);
  const subtype = type === 'pen' ? (definition.subtypes.find(item => item.id === options.subtype) || definition.subtypes[0]) : null;
  const defaults = subtype?.defaults || definition.defaults || {};
  const directParams = Object.fromEntries(['color', 'width', 'opacity', 'pressure', 'shape']
    .filter(key => options[key] !== undefined).map(key => [key, options[key]]));
  return {
    id: options.id || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    subtype: subtype?.id || null,
    name: String(options.name || subtype?.label || definition.label).slice(0, 30),
    icon: options.icon || subtype?.icon || definition.icon,
    params: { ...defaults, ...directParams, ...(options.params || {}) },
    visible: options.visible !== false
  };
}

export function defaultToolInstances() {
  return [
    createToolInstance('pen', { id: 'tool-pen-green', subtype: 'fountain' }),
    createToolInstance('pen', { id: 'tool-highlight-yellow', subtype: 'highlighter' }),
    createToolInstance('eraser', { id: 'tool-eraser' }),
    createToolInstance('lasso', { id: 'tool-lasso' }),
    createToolInstance('lookup', { id: 'tool-lookup' }),
    createToolInstance('pan', { id: 'tool-pan' })
  ];
}

export function normalizeToolInstances(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = source.flatMap(item => {
    if (!item?.id || !toolDefinition(item.type) || seen.has(item.id)) return [];
    seen.add(item.id);
    return [createToolInstance(item.type, item)];
  });
  if (!normalized.some(item => item.type === 'pen')) normalized.unshift(defaultToolInstances()[0]);
  return normalized.length ? normalized : defaultToolInstances();
}

export function toolMode(instance) {
  if (!instance) return 'pan';
  if (instance.type === 'pen') return instance.subtype === 'highlighter' ? 'highlight' : 'ink';
  return instance.type;
}

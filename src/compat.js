const STREAM_GLOBALS = [
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'ByteLengthQueuingStrategy',
  'CountQueuingStrategy'
];

export function needsWebStreams(scope = globalThis) {
  if (STREAM_GLOBALS.some(name => typeof scope[name] !== 'function')) return true;
  try {
    const stream = new scope.ReadableStream({ start(controller) { controller.close(); } });
    return typeof stream.getReader !== 'function';
  } catch {
    return true;
  }
}

export async function ensureWebStreams(scope = globalThis) {
  if (!needsWebStreams(scope)) return false;
  const ponyfill = await import('web-streams-polyfill');
  for (const name of STREAM_GLOBALS) {
    Object.defineProperty(scope, name, {
      configurable: true,
      writable: true,
      value: ponyfill[name]
    });
  }
  return true;
}

export function isReadableStreamError(error) {
  const message = String(error?.message || error || '');
  return /ReadableStream|readable stream|stream.*(?:undefined|constructor|support)/i.test(message);
}

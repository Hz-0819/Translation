import test from 'node:test';
import assert from 'node:assert/strict';
import { isReadableStreamError, needsWebStreams } from '../src/compat.js';

test('detects a browser without Web Streams globals', () => {
  assert.equal(needsWebStreams({}), true);
});

test('accepts a minimal working Web Streams implementation', () => {
  class FakeReadableStream {
    constructor(source) { source.start({ close() {} }); }
    getReader() { return {}; }
  }
  class FakeStream {}
  const scope = {
    ReadableStream: FakeReadableStream,
    WritableStream: FakeStream,
    TransformStream: FakeStream,
    ByteLengthQueuingStrategy: FakeStream,
    CountQueuingStrategy: FakeStream
  };
  assert.equal(needsWebStreams(scope), false);
});

test('recognizes ReadableStream compatibility failures', () => {
  assert.equal(isReadableStreamError(new TypeError('ReadableStream is not a constructor')), true);
  assert.equal(isReadableStreamError(new Error('Invalid PDF structure')), false);
});

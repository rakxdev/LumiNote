import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertFloat32ToInt16, appendPcmChunk } from '../public/audio-processor.js';

describe('AudioProcessor sample conversion & clamping', () => {
  it('should accurately convert standard range Float32 [-1.0, 1.0] to Int16', () => {
    const input = new Float32Array([0, 1.0, -1.0, 0.5, -0.5]);
    const output = convertFloat32ToInt16(input);

    assert.equal(output[0], 0);
    assert.equal(output[1], 32767);
    assert.equal(output[2], -32768);
    assert.equal(output[3], 16383);
    assert.equal(output[4], -16384);
  });

  it('should saturating-clamp values outside [-1.0, 1.0] without integer wrapping', () => {
    const input = new Float32Array([1.5, -2.0, 10.0, -99.0]);
    const output = convertFloat32ToInt16(input);

    // Without clamping, 1.5 * 32767 = 49150.5 which casts to -16386 (sign inversion/crackling)
    // With saturating clamp, it safely limits to 32767 / -32768
    assert.equal(output[0], 32767);
    assert.equal(output[1], -32768);
    assert.equal(output[2], 32767);
    assert.equal(output[3], -32768);
  });
});

describe('appendPcmChunk PCM batching', () => {
  const TOTAL_SAMPLES = 1600; // 100ms at 16kHz

  function makeFeeder() {
    let queue = new Int16Array(0);
    let nextSampleValue = 0;
    const batches = [];
    return {
      feed(n) {
        const chunk = new Int16Array(n);
        for (let i = 0; i < n; i++) chunk[i] = nextSampleValue++;
        const result = appendPcmChunk(queue, chunk, TOTAL_SAMPLES);
        queue = result.queue;
        if (result.batch) batches.push(result.batch);
      },
      batches,
      get queueLength() { return queue.length; },
      get fed() { return nextSampleValue; }
    };
  }

  it('buffers chunks below the batch threshold without emitting', () => {
    const feeder = makeFeeder();
    feeder.feed(128);
    assert.equal(feeder.batches.length, 0);
    assert.equal(feeder.queueLength, 128);
  });

  it('emits exactly totalSamples of PCM bytes per batch with FIFO ordering', () => {
    const feeder = makeFeeder();
    for (let i = 0; i < 25; i++) feeder.feed(128); // 3200 samples fed

    assert.equal(feeder.batches.length, 2);
    for (const batch of feeder.batches) {
      assert.equal(batch.byteLength, TOTAL_SAMPLES * 2);
    }
    const first = new Int16Array(feeder.batches[0].buffer, feeder.batches[0].byteOffset, TOTAL_SAMPLES);
    assert.equal(first[0], 0);
    assert.equal(first[TOTAL_SAMPLES - 1], TOTAL_SAMPLES - 1);
  });

  it('never sends the queued remainder twice (regression: subarray .buffer leak)', () => {
    const feeder = makeFeeder();
    for (let i = 0; i < 50; i++) feeder.feed(128); // 6400 samples fed

    const samplesSent = feeder.batches.reduce((sum, b) => sum + b.byteLength / 2, 0);
    // Every sample must be sent exactly once: sent == fed - still queued
    assert.equal(samplesSent, feeder.fed - feeder.queueLength);
    assert.equal(feeder.fed - feeder.queueLength, 6400 - 6400 % TOTAL_SAMPLES);
  });
});

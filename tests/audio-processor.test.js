import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertFloat32ToInt16 } from '../public/audio-processor.js';

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

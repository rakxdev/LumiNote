import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { meterAdvance, dbToNorm, rms16, METER_ATTACK, METER_RELEASE } from '../public/viz.js';

describe('viz meterAdvance (fast attack, slow release)', () => {
  it('rises much faster than it falls (fraction of the gap closed per frame)', () => {
    const riseGap = meterAdvance(0, 1) - 0; // gap closed on the way up
    const fallGap = 1 - meterAdvance(1, 0); // gap closed on the way down
    assert.ok(
      Math.abs(riseGap - METER_ATTACK) < 1e-12,
      `attack must close exactly METER_ATTACK of the gap, got ${riseGap}`
    );
    assert.ok(
      Math.abs(fallGap - METER_RELEASE) < 1e-12,
      `release must close METER_RELEASE of the gap, got ${fallGap}`
    );
    assert.ok(METER_ATTACK > METER_RELEASE * 3, 'attack must be at least 3x faster than release');
  });

  it('converges monotonically without overshoot', () => {
    let v = 0;
    for (let i = 0; i < 50; i++) {
      const next = meterAdvance(v, 1);
      assert.ok(next >= v && next <= 1, 'must move toward the target, never past it');
      v = next;
    }
    assert.ok(1 - v < 1e-6, 'must converge to the target, got ' + v);
  });

  it('is a no-op at the target', () => {
    assert.equal(meterAdvance(0.42, 0.42), 0.42);
  });
});

describe('viz dbToNorm (speech-range mapping)', () => {
  it('maps the speech range onto 0..1', () => {
    assert.equal(dbToNorm(-60), 0);
    assert.equal(dbToNorm(-12), 1);
    assert.ok(Math.abs(dbToNorm(-36) - 0.5) < 1e-9, 'midpoint maps to 0.5');
  });

  it('clamps out-of-range values and treats non-finite readings as silence', () => {
    assert.equal(dbToNorm(-90), 0);
    assert.equal(dbToNorm(-5), 1);
    // A non-finite FFT reading is a device glitch: it must read as silence,
    // never as a fake full-scale bar.
    assert.equal(dbToNorm(NaN), 0);
    assert.equal(dbToNorm(Infinity), 0);
    assert.equal(dbToNorm(-Infinity), 0);
  });
});

describe('viz rms16 (remote-voice level)', () => {
  it('returns 0 for silence and full scale for full-scale square wave', () => {
    const silence = new Int16Array(1600);
    assert.equal(rms16(silence), 0);

    const full = new Int16Array(1600);
    full.fill(16384); // 0.5 amplitude square wave
    assert.ok(Math.abs(rms16(full) - 0.5) < 1e-9, `expected 0.5, got ${rms16(full)}`);

    const max = new Int16Array(1600);
    max.fill(32767);
    assert.ok(rms16(max) > 0.99, 'near full scale should read ~1');
  });

  it('handles empty input', () => {
    assert.equal(rms16(new Int16Array(0)), 0);
    assert.equal(rms16(null), 0);
  });
});

/**
 * LumiNote voice-visualization math. Pure functions only: usable in the
 * browser module graph and in Node tests (no DOM, no Web Audio).
 *
 * Design notes (per visualization research):
 * - Bar meters need fast attack / slow release (VU-meter convention) so
 *   speech reads as responsive instead of lagged.
 * - AnalyserNode float frequency data is in dBFS; map the speech range
 *   (-60..-12 dBFS) onto 0..1 instead of treating bytes as linear.
 */

export const METER_ATTACK = 0.5; // fraction of the gap closed per frame (rising)
export const METER_RELEASE = 0.06; // fraction per frame (falling)

/**
 * Advance a smoothed meter value toward its target with asymmetric
 * attack/release. Returns the new value.
 */
export function meterAdvance(current, target) {
  if (target > current) {
    return current + (target - current) * METER_ATTACK;
  }
  return current + (target - current) * METER_RELEASE;
}

/**
 * Map a dBFS value to a 0..1 bar height over the speech range.
 * Values below the floor read 0; above the ceiling read 1.
 */
export function dbToNorm(db, floorDb = -60, ceilingDb = -12) {
  if (!Number.isFinite(db)) return 0;
  const n = (db - floorDb) / (ceilingDb - floorDb);
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * RMS level (0..1) of Int16 PCM samples. Used for the remote-voice level
 * relay: the sender computes it per 100ms audio batch and the receiver
 * draws its meter from the streamed scalar.
 */
export function rms16(samples) {
  if (!samples || samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] / 32768;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

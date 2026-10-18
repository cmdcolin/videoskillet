// Windowed-sinc FIR design. Every filter in the signal path is designed here
// from real frequency specs and uploaded to the GPU as taps — no ad-hoc blurs.

import { SAMPLE_RATE } from './constants'

// Blackman window: good stopband for short kernels, modest transition width.
function blackman(k: number, taps: number): number {
  const x = (2 * Math.PI * k) / (taps - 1)
  return 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x)
}

// Unity DC gain lowpass.
export function lowpass(cutoffHz: number, taps: number): Float32Array {
  const m = (taps - 1) / 2
  const fc = cutoffHz / SAMPLE_RATE
  const h = new Float32Array(taps)
  let sum = 0
  for (let k = 0; k < taps; k++) {
    const n = k - m
    const sinc =
      n === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * n) / (Math.PI * n)
    h[k] = sinc * blackman(k, taps)
    sum += h[k]!
  }
  for (let k = 0; k < taps; k++) h[k] = h[k]! / sum
  return h
}

// Unity center gain bandpass (lowpass heterodyned to centerHz).
export function bandpass(
  centerHz: number,
  halfWidthHz: number,
  taps: number,
): Float32Array {
  const lp = lowpass(halfWidthHz, taps)
  const m = (taps - 1) / 2
  const w = (2 * Math.PI * centerHz) / SAMPLE_RATE
  const h = new Float32Array(taps)
  for (let k = 0; k < taps; k++) h[k] = 2 * lp[k]! * Math.cos(w * (k - m))
  return h
}

// Causal one-pole lowpass truncated to an FIR: an exponential tail over the
// preceding samples only (taps past the center are zero). Models a delay-line
// chroma decoder whose color trails rightward past an edge instead of smearing
// symmetrically. Same -3 dB point as the one-pole with this cutoff.
export function lowpassCausal(cutoffHz: number, taps: number): Float32Array {
  const m = (taps - 1) / 2
  const a = Math.exp((-2 * Math.PI * cutoffHz) / SAMPLE_RATE)
  const h = new Float32Array(taps)
  let sum = 0
  for (let k = 0; k <= m; k++) {
    h[k] = Math.pow(a, m - k)
    sum += h[k]!
  }
  for (let k = 0; k <= m; k++) h[k] = h[k]! / sum
  return h
}

// A kernel zero-padded on both sides to `taps`, keeping its centre.
export function centred(h: Float32Array, taps: number): Float32Array {
  const out = new Float32Array(taps)
  out.set(h, (taps - h.length) / 2)
  return out
}

// Pointwise blend of two same-length kernels (both unity-DC stays unity-DC).
export function mixTaps(
  a: Float32Array,
  b: Float32Array,
  t: number,
): Float32Array {
  const h = new Float32Array(a.length)
  for (let k = 0; k < a.length; k++) h[k] = a[k]! + (b[k]! - a[k]!) * t
  return h
}

// Lowpass with high-frequency peaking mixed in: delta + peak*(delta - lp2).
// Models the luma "sharpness" boost of tape decks -> edge overshoot and ringing.
export function lowpassPeaked(
  cutoffHz: number,
  peak: number,
  peakHz: number,
  taps: number,
): Float32Array {
  const lp = lowpass(cutoffHz, taps)
  const lp2 = lowpass(peakHz, taps)
  const m = (taps - 1) / 2
  const h = new Float32Array(taps)
  for (let k = 0; k < taps; k++) {
    const delta = k === m ? 1 : 0
    h[k] = lp[k]! + peak * (delta - lp2[k]!)
  }
  return h
}

// Kernel lengths per section, baked into the WGSL prelude as constants so every
// convolution loop has a compile-time trip count and can unroll. The demod is
// the exception: its length is the bank slot, and decode loops over only the
// taps demodReach says the kernel uses.
export const TAPS = {
  encChroma: 33,
  demod: 63,
  demodShort: 41,
  luma: 49,
  chromaBp: 55,
  under: 55,
}

// A Blackman lowpass passes no band much narrower than its length resolves. At
// a fixed 41 taps, every demod setting below 0.4 MHz decoded with its -6 dB
// point between 0.41 and 0.50 MHz. The kernel's half-width in samples therefore
// grows as DEMOD_SPAN_HZ over the cutoff, which scales one response shape along
// the frequency axis: 20 samples at the 0.6 MHz stock setting, and the full
// slot from 0.39 MHz down. Below that the length stays fixed, so the band
// narrows more slowly than the setting asks, and the slider's 0.05 MHz decodes
// with its -6 dB point at 0.27 MHz.
const DEMOD_SPAN_HZ = 12e6
const DEMOD_MIN_HALF = (TAPS.demodShort - 1) / 2

export function demodHalfWidth(cutoffHz: number): number {
  const half = Math.round(DEMOD_SPAN_HZ / Math.max(cutoffHz, 1))
  return Math.min(Math.max(half, DEMOD_MIN_HALF), (TAPS.demod - 1) / 2)
}

// The decoder's chroma demod lowpass, blended toward a one-pole trail.
export function demodKernel(cutoffHz: number, tail: number): Float32Array {
  const symmetric = centred(
    lowpass(cutoffHz, 2 * demodHalfWidth(cutoffHz) + 1),
    TAPS.demod,
  )
  if (tail <= 0) return symmetric
  const trail = centred(lowpassCausal(cutoffHz, TAPS.demodShort), TAPS.demod)
  return mixTaps(symmetric, trail, tail)
}

// How many taps either side of the centre demodKernel can make nonzero.
export function demodReach(cutoffHz: number, _tail: number): number {
  return demodHalfWidth(cutoffHz)
}

// The GPU filter bank: fixed-stride sections so shaders index kernels by slot.
export const FILTER_STRIDE = 64
export const SEC_ENC_CHROMA = 0 // encoder I/Q (U/V) bandlimit
export const SEC_DEMOD = 1 // decoder chroma demod lowpass
export const SEC_LUMA = 2 // channel/tape luma bandwidth (with peaking)
export const SEC_CHROMA_BP = 3 // chroma extraction bandpass at fsc
export const SEC_UNDER = 4 // color-under lowpass after down-conversion
export const NUM_SECTIONS = 5

export function packFilterBank(
  sections: Map<number, Float32Array>,
): Float32Array<ArrayBuffer> {
  const bank = new Float32Array(NUM_SECTIONS * FILTER_STRIDE)
  for (const [sec, taps] of sections) bank.set(taps, sec * FILTER_STRIDE)
  return bank
}

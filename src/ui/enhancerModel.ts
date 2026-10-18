import {
  ACTIVE_START,
  BURST_LEN,
  BURST_START,
  IRE_BLANK,
  IRE_SYNC,
  SAMPLE_RATE,
  SAMPLES_PER_LINE,
  SYNC_LEN,
} from '../core/signal/constants'
import { TEST_LINE } from './testLine'

// The bent enhancer as enhancer.wgsl runs it on one picture line, with the
// unit conversions uniforms.ts makes on the way in. The line runs through the
// same recurrence sample by sample, and the peaking stage's response is the
// same recurrence read as a filter.

export interface Enhancer {
  clampUs: number
  droopUs: number
  peakMHz: number
  peakQ: number
  peakBoost: number
  sync: number
  sliceIre: number
}

const SPL = SAMPLES_PER_LINE
const RAIL = 120
const SEP_ALPHA = 0.123
/** The sample the clamp gate keys on at stock, on the back porch. */
export const CLAMP_KEY = (BURST_START + BURST_LEN + ACTIVE_START) * 0.5

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi)

// uniforms.ts, enhClampOff through enhSlice.
function uniforms(e: Enhancer) {
  return {
    clampOff: e.clampUs * 1e-6 * SAMPLE_RATE,
    droop:
      e.droopUs > 0 ? 1 - Math.exp(-1 / (e.droopUs * 1e-6 * SAMPLE_RATE)) : 0,
    fc: (e.peakMHz * 1e6) / SAMPLE_RATE,
    r: 0.85 + 0.2 * e.peakQ,
  }
}

/** The sample the clamp gate keys on. */
export const gateSample = (e: Enhancer) =>
  Math.trunc(clamp(CLAMP_KEY + uniforms(e).clampOff, 0, SPL - 1))

export const peaking = (e: Enhancer) => e.peakMHz > 0 && e.peakBoost > 0

/** Past a pole radius of 1 the resonator climbs to the rails on its own. */
export const howls = (e: Enhancer) => peaking(e) && uniforms(e).r >= 1 - 1e-6

function resonator(e: Enhancer) {
  const { fc, r } = uniforms(e)
  return {
    a1: 2 * r * Math.cos(2 * Math.PI * fc),
    a2: -r * r,
    drive: Math.max(1 - r, 0.02),
  }
}

// enhancer.wgsl main, for a row past the vertical interval.
export function enhancedLine(e: Enhancer, line = TEST_LINE): number[] {
  const u = uniforms(e)
  const clamping = e.clampUs !== 0 || u.droop > 0
  const key = gateSample(e)
  let vcap = clamping ? line[key]! - IRE_BLANK : 0
  const peak = peaking(e)
  const { a1, a2, drive } = resonator(e)
  let z1 = 0
  let z2 = 0
  let sep = IRE_BLANK
  let pulse = 0
  return line.map((x, s) => {
    let y = x
    if (clamping) {
      y -= vcap
      if (s === key) {
        vcap = x - IRE_BLANK
        y = IRE_BLANK
      }
      vcap += (y - IRE_BLANK) * u.droop
    }
    if (peak) {
      const v = clamp(drive * y + a1 * z1 + a2 * z2, -RAIL, RAIL)
      z2 = z1
      z1 = v
      y += e.peakBoost * v
    }
    if (e.sync > 0) {
      sep += (y - sep) * SEP_ALPHA
      if (pulse > 0) pulse--
      else if (sep < e.sliceIre) pulse = SYNC_LEN
      const onBurst = s >= BURST_START && s < BURST_START + BURST_LEN
      if (pulse > 0 && !onBurst) y += (IRE_SYNC - y) * e.sync
    }
    return y
  })
}

// The peaking stage as a filter, 1 + boost·drive / (1 − a1 z⁻¹ − a2 z⁻²), off
// the rails. Past a pole radius of 1 the formula still has a shape, which is
// where the stage howls, and no longer says how loud.
export function peakingGains(e: Enhancer, mhzs: readonly number[]): number[] {
  if (!peaking(e)) return mhzs.map(() => 1)
  const { a1, a2, drive } = resonator(e)
  const k = e.peakBoost * drive
  return mhzs.map(mhz => {
    const w = (2 * Math.PI * mhz * 1e6) / SAMPLE_RATE
    const re = 1 - a1 * Math.cos(w) - a2 * Math.cos(2 * w)
    const im = a1 * Math.sin(w) + a2 * Math.sin(2 * w)
    const d = re * re + im * im
    return Math.hypot(1 + (k * re) / d, (-k * im) / d)
  })
}

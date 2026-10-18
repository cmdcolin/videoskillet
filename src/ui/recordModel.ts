import { lumaKernel } from '../core/gpu/filterbank'
import {
  IRE_BLACK,
  IRE_VIDEO_RANGE,
  IRE_WHITE,
  SAMPLE_RATE,
} from '../core/signal/constants'

import type { Controls } from '../core/controls'

// The recording's luma path as channel.wgsl runs it, on one line of picture:
// the FM fold subtracted from the input, then the luma FIR over the result. The
// fold reads the pre-emphasized input, and its streak decays through the
// deemphasis time constant. The threshold noise and the writhe on the streak
// average to zero and to one, so they are left out.

export type Recording = Pick<
  Controls,
  'lumaMHz' | 'lumaPeak' | 'fmOverdev' | 'fmStreakUs'
>

const FM_SPAN = 30
const FOLD_FLOOR = -15

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi)

// The ceiling the emphasized signal folds past, in IRE: ceilIre in channel.wgsl.
export const fmCeiling = (overdev: number) => mix(240, 112, overdev)

// clampIdx: a read off either end takes the end sample.
const at = (x: readonly number[], n: number) => x[clamp(n, 0, x.length - 1)]!

// The record side's pre-emphasis, the e in channel.wgsl's fold loop.
export const emphasize = (x: readonly number[]) =>
  x.map((_, n) => at(x, n) + 1.3 * (at(x, n) - at(x, n - 2)))

/** A line of black with a white bar across it, in samples. */
export const BAR = { us: 5, from: 0.6, to: 3.6 } as const

const sampleUs = (n: number) => (n / SAMPLE_RATE) * 1e6

export function barLine() {
  const samples = Math.round(BAR.us * 1e-6 * SAMPLE_RATE) + 1
  return Array.from({ length: samples }, (_, n) =>
    sampleUs(n) >= BAR.from && sampleUs(n) < BAR.to ? IRE_WHITE : IRE_BLACK,
  )
}

// The luma a line plays back as, sample for sample, with the emphasized signal
// the fold compares with the ceiling and the folded signal the filter reads.
export function playBack(rec: Recording, x: readonly number[]) {
  const h = lumaKernel(rec)
  const m = (h.length - 1) / 2
  const e = emphasize(x)
  const ceiling = fmCeiling(rec.fmOverdev)
  const tau = Math.max(rec.fmStreakUs * 1e-6 * SAMPLE_RATE, 1)
  const folded = x.map((v, n) => {
    if (rec.fmOverdev <= 0) return v
    let streak = 0
    for (let d = 0; d <= FM_SPAN; d++) {
      streak += Math.max(at(e, n - d) - ceiling, 0) * Math.exp(-d / tau)
    }
    return streak > 0 ? Math.max(v - 0.6 * streak, FOLD_FLOOR) : v
  })
  const out = folded.map((_, n) => {
    let luma = 0
    for (let k = 0; k < h.length; k++) luma += h[k]! * at(folded, n + k - m)
    return luma
  })
  return { emphasized: e, folded, out }
}

// What differential gain and phase do to chroma riding luma at `ire`: the
// amplifier's gain on it, and its phase advance in degrees.
export function chromaOn(
  ire: number,
  c: Pick<Controls, 'diffGain' | 'diffPhaseDeg'>,
) {
  const lvl = clamp((ire - IRE_BLACK) / IRE_VIDEO_RANGE, 0, 1)
  return { gain: 1 - c.diffGain * lvl, phaseDeg: c.diffPhaseDeg * lvl }
}

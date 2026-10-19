import { SAMPLE_RATE } from '../core/signal/constants'

import type { Controls } from '../core/controls'

// What one lap of the mixer loop hands back at each frequency, built the way
// fb_composite.wgsl builds the return: the Y/C separator's half of the read,
// plus the resonance read off the same position, through the trim and the
// fader. Noise, the ring modulator and the output rails are not linear and are
// left out, and so is the rest of the chain between the output and the store.

export interface MixerLoop {
  mix: number
  gain: number
  /** 0 composite, 1 chroma, 2 luma. */
  split: number
  filterMHz: number
  filterQ: number
  filterBoost: number
}

export const BAND_MHZ = 6
const RES_M = 16
const BAND_POINTS = 241

export const mixerLoopOf = (c: Controls): MixerLoop => ({
  mix: c.cfbMix,
  gain: c.cfbGain,
  split: Math.round(c.cfbReturn),
  filterMHz: c.cfbFilterMHz,
  filterQ: c.cfbFilterQ,
  filterBoost: c.cfbFilterBoost,
})

const cyclesPerSample = (mhz: number) => (mhz * 1e6) / SAMPLE_RATE

// The shader's 33 Gaussian-windowed cosine taps, normalised to unity at the
// centre frequency. They are symmetric, so the response is real.
export function resonanceTaps(filterMHz: number, filterQ: number) {
  const fc = cyclesPerSample(filterMHz)
  const sigma = 1.2 + (8 - 1.2) * Math.min(Math.max(filterQ, 0), 1)
  const taps: number[] = []
  let norm = 0
  for (let k = -RES_M; k <= RES_M; k++) {
    const cs = Math.cos(2 * Math.PI * fc * k)
    const h = Math.exp(-(k * k) / (2 * sigma * sigma)) * cs
    taps.push(h)
    norm += h * cs
  }
  return { taps, norm: Math.max(norm, 0.05) }
}

export type Resonance = ReturnType<typeof resonanceTaps>

export const resonanceAt = ({ taps, norm }: Resonance, mhz: number) => {
  const f = cyclesPerSample(mhz)
  return (
    taps.reduce(
      (acc, h, i) => acc + h * Math.cos(2 * Math.PI * f * (i - RES_M)),
      0,
    ) / norm
  )
}

// The separator's 4-sample boxcar at offsets -2..1: one subcarrier cycle, so
// it passes luma and nulls chroma.
export function boxcarAt(mhz: number): [number, number] {
  const f = cyclesPerSample(mhz)
  let re = 0
  let im = 0
  for (let m = -2; m <= 1; m++) {
    re += 0.25 * Math.cos(2 * Math.PI * f * m)
    im += 0.25 * Math.sin(2 * Math.PI * f * m)
  }
  return [re, im]
}

const resonates = (loop: MixerLoop) =>
  loop.filterMHz > 0 && loop.filterBoost !== 0

// The gain magnitude at each frequency, with the filter designed once.
export function lapGains(loop: MixerLoop, mhzs: readonly number[]): number[] {
  const res = resonates(loop)
    ? resonanceTaps(loop.filterMHz, loop.filterQ)
    : null
  return mhzs.map(mhz => {
    const [bRe, bIm] = boxcarAt(mhz)
    let re = loop.split === 1 ? 1 - bRe : loop.split === 2 ? bRe : 1
    const im = loop.split === 1 ? -bIm : loop.split === 2 ? bIm : 0
    if (res) re += loop.filterBoost * resonanceAt(res, mhz)
    return loop.mix * Math.abs(loop.gain) * Math.hypot(re, im)
  })
}

export const lapGain = (loop: MixerLoop, mhz: number) =>
  lapGains(loop, [mhz])[0]!

export const bandMHz = (points: number) =>
  Array.from({ length: points }, (_, i) => (BAND_MHZ * i) / (points - 1))

// The highest lap gain anywhere from DC to BAND_MHZ, and where it is.
export function peakLapGain(loop: MixerLoop) {
  const mhzs = bandMHz(BAND_POINTS)
  const gains = lapGains(loop, mhzs)
  let at = 0
  gains.forEach((g, i) => {
    if (g > gains[at]!) at = i
  })
  return { gain: gains[at]!, mhz: mhzs[at]! }
}

// The resonance boost that puts the lap gain at `gain` on its own centre
// frequency, which is where a drag on the curve's peak asks for it. The filter
// is unity there, so the boost adds straight onto the separator's real part.
export function boostFor(loop: MixerLoop, mhz: number, gain: number) {
  const scale = loop.mix * Math.abs(loop.gain)
  if (scale === 0) return loop.filterBoost
  const [bRe, bIm] = boxcarAt(mhz)
  const re = loop.split === 1 ? 1 - bRe : loop.split === 2 ? bRe : 1
  const im = loop.split === 1 ? -bIm : loop.split === 2 ? bIm : 0
  const want = Math.max(gain / scale, Math.abs(im))
  return Math.sqrt(want * want - im * im) - re
}

import { describe, expect, it } from 'vitest'

import { IRE_BLACK, IRE_WHITE } from '../core/signal/constants'
import {
  barLine,
  chromaOn,
  emphasize,
  fmCeiling,
  playBack,
} from './recordModel'

const STOCK = { lumaMHz: 4.2, lumaPeak: 0, fmOverdev: 0, fmStreakUs: 0.4 }
const BAR = barLine()
const RISE = BAR.indexOf(IRE_WHITE)
const FALL = BAR.lastIndexOf(IRE_WHITE) + 1

describe('recording', () => {
  it('spikes the emphasized signal 1.3 times the step past each edge', () => {
    const e = emphasize(BAR)
    const step = IRE_WHITE - IRE_BLACK
    expect(e[RISE]).toBeCloseTo(IRE_WHITE + 1.3 * step)
    expect(e[RISE + 1]).toBeCloseTo(IRE_WHITE + 1.3 * step)
    expect(e[RISE + 2]).toBe(IRE_WHITE)
    expect(e[FALL]).toBeCloseTo(IRE_BLACK - 1.3 * step)
  })

  it('keeps the stock spike under the stock ceiling', () => {
    expect(Math.max(...emphasize(BAR))).toBeLessThan(fmCeiling(0))
  })

  it('plays a flat field back flat at full over-deviation', () => {
    const flat = BAR.map(() => IRE_WHITE)
    const { out } = playBack({ ...STOCK, fmOverdev: 1 }, flat)
    for (const v of out) expect(v).toBeCloseTo(IRE_WHITE, 3)
  })

  it('streaks below black after the rising edge and recovers', () => {
    const quiet = playBack(STOCK, BAR).out
    const hot = playBack({ ...STOCK, fmOverdev: 1 }, BAR).out
    expect(Math.min(...hot.slice(RISE, RISE + 4))).toBeLessThan(0)
    expect(hot[RISE + 32]).toBeCloseTo(quiet[RISE + 32]!, 1)
  })

  it('bottoms the fold out at -15 IRE ahead of the luma filter', () => {
    const fromSync = BAR.map(v => (v === IRE_BLACK ? -40 : v))
    const { folded } = playBack({ ...STOCK, fmOverdev: 1 }, fromSync)
    expect(Math.min(...folded.slice(RISE, RISE + 10))).toBe(-15)
  })

  it('folds nothing at the falling edge', () => {
    const { folded } = playBack({ ...STOCK, fmOverdev: 1 }, BAR)
    for (let n = FALL - 2; n < BAR.length; n++) expect(folded[n]).toBe(BAR[n])
  })

  it('streaks longer with a longer recovery', () => {
    const below = (us: number) =>
      playBack({ ...STOCK, fmOverdev: 0.6, fmStreakUs: us }, BAR).out.filter(
        v => v < IRE_WHITE - 10,
      ).length
    expect(below(0.7)).toBeGreaterThan(below(0.2))
  })

  it('overshoots the edge with peaking', () => {
    const peak = (lumaPeak: number) =>
      Math.max(...playBack({ ...STOCK, lumaPeak }, BAR).out)
    expect(peak(0)).toBeLessThan(IRE_WHITE + 10)
    expect(peak(3)).toBeGreaterThan(IRE_WHITE + 20)
  })

  it('scales and turns chroma on white, and leaves it alone on black', () => {
    const c = { diffGain: 0.3, diffPhaseDeg: 12 }
    expect(chromaOn(IRE_WHITE, c)).toEqual({ gain: 0.7, phaseDeg: 12 })
    expect(chromaOn(IRE_BLACK, c)).toEqual({ gain: 1, phaseDeg: 0 })
  })
})

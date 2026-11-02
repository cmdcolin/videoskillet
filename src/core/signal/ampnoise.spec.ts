import { describe, expect, it } from 'vitest'

import { AmpNoise } from './ampnoise'
import { LINES } from './constants'

const run = (c: {
  popcornIre: number
  popcornHz: number
  flickerIre: number
}) => {
  const amp = new AmpNoise()
  return Array.from({ length: 6000 }, (_, f) => amp.update(f, c))
}

describe('AmpNoise', () => {
  it('is silent with both controls down', () => {
    for (const u of run({ popcornIre: 0, popcornHz: 1, flickerIre: 0 })) {
      expect(u).toEqual({
        ampLvl0: 0,
        ampLvl1: 0,
        ampStep: 0,
        ampStepRow: LINES,
      })
    }
  })

  it('switches between four discrete levels', () => {
    const levels = new Set(
      run({ popcornIre: 10, popcornHz: 2, flickerIre: 0 }).map(u =>
        Math.round(u.ampLvl0 * 1000),
      ),
    )
    expect(levels.size).toBe(4)
  })

  it('steps only on frames that carry a switch row', () => {
    for (const u of run({ popcornIre: 10, popcornHz: 2, flickerIre: 0 })) {
      expect(u.ampStep !== 0).toBe(u.ampStepRow < LINES)
    }
  })

  it('reproduces from the frame count', () => {
    const c = { popcornIre: 8, popcornHz: 1, flickerIre: 5 }
    expect(run(c)).toEqual(run(c))
  })

  it('wanders slowly under flicker alone', () => {
    const u = run({ popcornIre: 0, popcornHz: 1, flickerIre: 5 })
    const lv = u.map(x => x.ampLvl1)
    const rms = Math.sqrt(lv.reduce((s, x) => s + x * x, 0) / lv.length)
    const step = Math.max(...lv.slice(1).map((x, i) => Math.abs(x - lv[i]!)))
    expect(rms).toBeGreaterThan(1)
    expect(step).toBeLessThan(0.6 * rms)
  })
})

import { describe, expect, it } from 'vitest'

import {
  afterglow,
  afterglowSpan,
  burnEfficiency,
  decayRates,
  dosePerSecond,
  FIELD_HZ,
  whiteLight,
} from './phosphorModel'

const tube = { phosphor: 0.6, phosphorSkew: 0.7, phosphorMode: 0 }

describe('phosphor afterglow', () => {
  it('runs a field every 16.7 ms', () => {
    expect(1000 / FIELD_HZ).toBeCloseTo(16.68, 2)
  })

  it('skews red and blue faster than green', () => {
    const [r, g, b] = decayRates(tube)!
    expect(g).toBeCloseTo((8 * 0.4) / 0.6, 9)
    expect(r! / g!).toBeCloseTo(1.7, 9)
    expect(b! / g!).toBeCloseTo(2.4, 9)
  })

  it('gives white back as a hyperbola with the leak under it', () => {
    const k = (8 * 0.4) / 0.6
    const [, g1] = afterglow(tube, 1)[1]!
    expect(g1).toBeCloseTo((1 / (1 + k)) * 0.9995, 9)
    const glow = afterglow(tube, 8)
    for (let n = 1; n < glow.length; n++) {
      const [r, g, b] = glow[n]!
      expect(g).toBeGreaterThan(r!)
      expect(r).toBeGreaterThan(b!)
    }
  })

  it('is gone inside the field with persistence off', () => {
    const glow = afterglow({ ...tube, phosphor: 0 }, 3)
    expect(glow[0]).toEqual([1, 1, 1])
    expect(glow[1]).toEqual([0, 0, 0])
    expect(afterglowSpan({ ...tube, phosphor: 0 })).toBe(4)
  })

  it('stretches the span to seconds near the top of the dial', () => {
    expect(afterglowSpan({ ...tube, phosphor: 0.999 })).toBeGreaterThanOrEqual(
      600,
    )
  })

  it('tints white by the phosphor set', () => {
    expect(whiteLight(1)[1]).toBeCloseTo(1, 4)
    const [r, g, b] = whiteLight(3)
    expect(g).toBe(1)
    expect(r).toBeLessThan(0.05)
    expect(b).toBeLessThan(0.1)
  })
})

describe('phosphor burn-in', () => {
  it('wears blue fastest and red slowest', () => {
    const [r, g, b] = burnEfficiency(1, 2)
    expect(g).toBeCloseTo(1 / 3, 9)
    expect(r).toBeGreaterThan(g!)
    expect(b).toBeLessThan(g!)
    expect(burnEfficiency(0, 10)).toEqual([1, 1, 1])
  })

  it('caps the dose where the f16 store does', () => {
    expect(burnEfficiency(1, 1000)).toEqual(burnEfficiency(1, 64))
  })

  it('takes about one unit of dose a second at full rate', () => {
    expect(dosePerSecond(1)).toBeCloseTo(0.999, 3)
    expect(dosePerSecond(0)).toBe(0)
  })
})

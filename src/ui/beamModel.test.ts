import { describe, expect, it } from 'vitest'

import { edgeProfile, lineProfile, type Edge } from './beamModel'

const STOCK: Edge = { spot: 0, svm: 0, svmWidth: 1, sharp: 0 }
const at = (c: Edge, x: number) => edgeProfile(c, x, x + 1, 2)[0]!

describe('edgeProfile', () => {
  it('ramps across one sample with bilinear reconstruction and no spot', () => {
    expect(at(STOCK, -1)).toBeCloseTo(0.25)
    expect(at(STOCK, 0.5)).toBeCloseTo(0.5)
    expect(at(STOCK, 2)).toBeCloseTo(0.75)
  })

  it('spreads the edge over more samples as the spot widens', () => {
    const wide = { ...STOCK, spot: 4 }
    expect(at(wide, -1)).toBeGreaterThan(0.25 + 0.02)
    expect(at(wide, 2)).toBeLessThan(0.75 - 0.02)
  })

  it('rings past the bright side with the cubic reconstruction', () => {
    expect(at({ ...STOCK, sharp: 1 }, 1.5)).toBeGreaterThan(0.75)
    expect(at({ ...STOCK, sharp: 1 }, -0.5)).toBeLessThan(0.25)
  })

  it('moves light across the edge with scan velocity modulation', () => {
    expect(at({ ...STOCK, svm: 1 }, 1)).toBeGreaterThan(0.75)
    expect(at({ ...STOCK, svm: -1 }, 1)).toBeLessThan(0.75)
  })
})

describe('lineProfile', () => {
  it('is flat with no beam profile', () => {
    expect(new Set(lineProfile(0, 0, 1, 11))).toEqual(new Set([1]))
  })

  it('dims the gap between lines and not the centre', () => {
    const line = lineProfile(1, 0, 1, 11)
    expect(line[5]).toBe(1)
    expect(line[0]).toBeLessThan(0.9)
  })

  it('closes the gap in the whites and not in the shadows with bloom', () => {
    const bright = lineProfile(1, 1, 1, 11)[0]!
    const dark = lineProfile(1, 1, 0.1, 11)[0]!
    expect(bright).toBeGreaterThan(dark)
  })
})

import { describe, expect, it } from 'vitest'

import {
  colorizerOut,
  colorizerTint,
  cyclesPerLine,
  synthLevel,
  synthWave,
} from './synthModel'

describe('synthWave', () => {
  it('draws each shape over one cycle', () => {
    expect(synthWave(0.25, 0)).toBeCloseTo(0.25)
    expect(synthWave(0.5, 1)).toBeCloseTo(1)
    expect(synthWave(0.25, 2)).toBeCloseTo(1)
    expect(synthWave(0.25, 3)).toBe(1)
    expect(synthWave(0.75, 3)).toBe(0)
  })

  it('wraps past one cycle', () => {
    expect(synthWave(1.25, 0)).toBeCloseTo(0.25)
  })
})

describe('synthLevel', () => {
  it('holds mid-video at any level', () => {
    expect(synthLevel(0.5, 4)).toBe(0.5)
  })

  it('squares the wave off into its rails past unity', () => {
    expect(synthLevel(0.9, 4)).toBe(1)
    expect(synthLevel(0.1, 4)).toBe(0)
  })
})

describe('colorizerTint', () => {
  it('lands black and white on opposite hues with the phase rotator', () => {
    const black = colorizerTint(0, 0, false)
    const white = colorizerTint(1, 0, false)
    expect(black[0]).toBeGreaterThan(0.9)
    expect(white[0]).toBeLessThan(0.1)
  })

  it('switches each gun fully on or off with comparators', () => {
    expect(colorizerTint(0.3, 0, true)).toEqual([1, 1, 0])
  })
})

describe('colorizerOut', () => {
  it('passes the grey when the colorizer is at depth 0', () => {
    expect(colorizerOut(0.4, 0, 90, false)).toEqual([0.4, 0.4, 0.4])
  })
})

describe('cyclesPerLine', () => {
  it('counts one cycle a line at the line rate', () => {
    expect(cyclesPerLine(15734.2657)).toBeCloseTo(1, 4)
  })
})

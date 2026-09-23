import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { aimKey, chromaHue, keysOnHue, sourcePoint } from './keyed'

describe('chromaHue', () => {
  // The keyer's own reference points, from the comments beside its controls.
  it('puts the primaries where the encoder does', () => {
    expect(chromaHue(0, 1, 0)).toBeCloseTo(240.7, 0)
    expect(chromaHue(1, 0, 0)).toBeCloseTo(103.4, 0)
  })

  it('puts skin on the I axis', () => {
    const hue = chromaHue(0.87, 0.67, 0.53) ?? 0
    expect(Math.abs(hue - 123)).toBeLessThan(6)
  })

  it('has no hue for grey', () => {
    expect(chromaHue(0.5, 0.5, 0.5)).toBeNull()
  })
})

describe('aimKey', () => {
  const keyed = {
    ...DEFAULT_CONTROLS,
    cfbMix: 0.9,
    cfbKey: 1,
    cfbKeyAcceptDeg: 40,
    cfbKeyHueDeg: 103,
  }

  it('re-aims a hue keyer', () => {
    expect(keysOnHue(keyed)).toBe(true)
    expect(aimKey(keyed, 240.6).cfbKeyHueDeg).toBe(241)
  })

  it('leaves a luma keyer and a look with no loop alone', () => {
    const luma = { ...keyed, cfbKeyAcceptDeg: 0 }
    expect(aimKey(luma, 200)).toBe(luma)
    expect(aimKey(DEFAULT_CONTROLS, 200)).toBe(DEFAULT_CONTROLS)
  })
})

describe('sourcePoint', () => {
  const frame = { width: 400, height: 300 }

  it('crops the long side of a wider camera', () => {
    const p = sourcePoint({ x: 0, y: 0.5 }, frame, {
      width: 1600,
      height: 900,
      mirror: false,
    })
    expect(p.x).toBeCloseTo(0.5 - 0.5 * (4 / 3 / (16 / 9)))
    expect(p.y).toBe(0.5)
  })

  it('reads a mirrored camera from the other side', () => {
    const p = sourcePoint({ x: 0.2, y: 0.3 }, frame, {
      width: 640,
      height: 480,
      mirror: true,
    })
    expect(p.x).toBeCloseTo(0.8)
    expect(p.y).toBeCloseTo(0.3)
  })

  it('maps a tall camera on a turned set straight through', () => {
    const p = sourcePoint(
      { x: 0.25, y: 0.75 },
      { width: 300, height: 400 },
      { width: 480, height: 640, mirror: false },
    )
    expect(p.x).toBeCloseTo(0.25)
    expect(p.y).toBeCloseTo(0.75)
  })
})

import { describe, expect, it } from 'vitest'

import {
  BARS,
  loopSlice,
  mixerGate,
  mixerSlice,
  satGate,
  sliceAt,
  sliceContour,
  smoothstep,
  unsmooth,
} from './hueKey'

const DEG = Math.PI / 180
const stock = mixerSlice({
  bKeyHueDeg: 241,
  bKeyAcceptDeg: 40,
  bKeyClip: 0.06,
  bKeySoft: 0.05,
})
const at = (deg: number, r: number) =>
  [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG)] as const

describe('hue key slice', () => {
  it('inverts smoothstep', () => {
    for (const y of [0, 0.1, 0.5, 0.9, 1]) {
      expect(smoothstep(0, 1, unsmooth(y))).toBeCloseTo(y, 9)
    }
  })

  it('puts the colour bars where a vectorscope does', () => {
    const deg = Object.fromEntries(
      BARS.map(b => [b.name, (((b.angle / DEG) % 360) + 360) % 360]),
    )
    expect(deg.red).toBeCloseTo(103.4, 0)
    expect(deg.yel).toBeCloseTo(167.1, 0)
    expect(deg.grn).toBeCloseTo(240.7, 0)
    expect(deg.blue).toBeCloseTo(347.1, 0)
  })

  it('cuts a saturated green and keeps grey, red and a pale green', () => {
    const green = BARS.find(b => b.name === 'grn')!
    expect(mixerGate(1, stock, ...at(241, green.r))).toBeCloseTo(0, 6)
    expect(mixerGate(1, stock, 0, 0)).toBe(1)
    expect(mixerGate(1, stock, ...at(103, 0.4))).toBe(1)
    expect(mixerGate(1, stock, ...at(241, 0.05))).toBe(1)
  })

  it('wraps the hue across the atan2 branch', () => {
    const blue = mixerSlice({
      bKeyHueDeg: 175,
      bKeyAcceptDeg: 20,
      bKeyClip: 0,
      bKeySoft: 0.01,
    })
    expect(sliceAt(blue, ...at(-175, 0.3))).toBe(1)
  })

  it('inverts on a negative key and swings by its size', () => {
    const uv = at(241, 0.4)
    expect(mixerGate(-1, stock, ...uv)).toBeCloseTo(1, 6)
    expect(mixerGate(-1, stock, 0, 0)).toBe(0)
    expect(mixerGate(0.5, stock, ...uv)).toBeCloseTo(0.5, 6)
    expect(mixerGate(0, stock, ...uv)).toBe(1)
  })

  it('draws contours on which the slice is at their level', () => {
    const wide = mixerSlice({
      bKeyHueDeg: 240,
      bKeyAcceptDeg: 40,
      bKeyClip: 0.1,
      bKeySoft: 0.3,
    })
    for (const level of [0.1, 0.5, 0.9]) {
      const c = sliceContour(wide, level, 40)!
      for (const p of c.edge.slice(1, -1)) {
        const [u, v] = [p.r * Math.cos(p.angle), p.r * Math.sin(p.angle)]
        expect(sliceAt(wide, u, v)).toBeCloseTo(level, 6)
      }
    }
  })

  it('wraps the full turn once the edge passes π, and misses an unreachable level', () => {
    const all = mixerSlice({
      bKeyHueDeg: 0,
      bKeyAcceptDeg: 170,
      bKeyClip: 0,
      bKeySoft: 0.2,
    })
    expect(sliceContour(all, 0.2, 8)?.whole).toBe(true)
    const thin = mixerSlice({
      bKeyHueDeg: 0,
      bKeyAcceptDeg: 0,
      bKeyClip: 0,
      bKeySoft: 0.2,
    })
    expect(sliceContour(thin, 0.9, 8)).toBeNull()
  })

  it('reads the loop keyer softness as a fraction of π against a fixed clip', () => {
    const s = loopSlice({
      cfbKeyHueDeg: 180,
      cfbKeyAcceptDeg: 30,
      cfbKeySoft: 10,
    })
    expect(s.edge).toBeCloseTo(0.1 * Math.PI, 9)
    expect(satGate(s, 3)).toBe(0)
    expect(satGate(s, 6)).toBe(1)
  })
})

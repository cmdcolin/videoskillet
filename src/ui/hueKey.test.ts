import { describe, expect, it } from 'vitest'

import { IRE_VIDEO_RANGE } from '../core/signal/constants'
import {
  additiveMatte,
  additiveShare,
  BARS,
  backingLevel,
  loopSlice,
  mixerGate,
  mixerSlice,
  satGate,
  sliceAt,
  shareContour,
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
    expect(satGate(s, 3 / IRE_VIDEO_RANGE)).toBe(0)
    expect(satGate(s, 6 / IRE_VIDEO_RANGE)).toBe(1)
  })
})

// mix_b.wgsl chromaKey's level, written out as the shader has it.
function shaderLevel(hueDeg: number, acceptDeg: number, u: number, v: number) {
  const hue = hueDeg * DEG
  const accept = acceptDeg * DEG
  const [kx, ky] = [Math.cos(hue), Math.sin(hue)]
  const across =
    Math.max(Math.cos(accept), 0) / Math.max(Math.sin(accept), 1e-3)
  return u * kx + v * ky - across * Math.abs(u * ky - v * kx)
}

describe('additive key matte', () => {
  const green = additiveMatte({
    bKeyHueDeg: 241,
    bKeyAcceptDeg: 40,
    bKeyLevel: 0.3,
  })

  it('measures backing as the shader does', () => {
    for (const acceptDeg of [0, 10, 40, 89, 90, 135, 180]) {
      const m = additiveMatte({
        bKeyHueDeg: 241,
        bKeyAcceptDeg: acceptDeg,
        bKeyLevel: 0.3,
      })
      for (const [deg, r] of [
        [241, 0.2],
        [260, 0.4],
        [200, 0.1],
        [103, 0.5],
        [0, 0],
      ] as const) {
        const uv = at(deg, r)
        expect(backingLevel(m, ...uv)).toBeCloseTo(
          shaderLevel(241, acceptDeg, ...uv),
          9,
        )
      }
    }
  })

  it('rises along the key hue to 1 at the backing level and is 0 on the wedge edges', () => {
    expect(additiveShare(green, ...at(241, 0.15))).toBeCloseTo(0.5, 9)
    expect(additiveShare(green, ...at(241, 0.3))).toBeCloseTo(1, 9)
    expect(additiveShare(green, ...at(241, 0.6))).toBe(1)
    expect(additiveShare(green, ...at(281, 0.5))).toBeCloseTo(0, 9)
    expect(additiveShare(green, ...at(201, 0.5))).toBeCloseTo(0, 9)
    expect(additiveShare(green, ...at(103, 0.5))).toBe(0)
  })

  it('keys a half plane once the acceptance passes 90°', () => {
    const wide = additiveMatte({
      bKeyHueDeg: 0,
      bKeyAcceptDeg: 120,
      bKeyLevel: 0.2,
    })
    expect(additiveShare(wide, 0.1, 0.5)).toBeCloseTo(0.5, 9)
    expect(additiveShare(wide, 0.1, -0.5)).toBeCloseTo(0.5, 9)
    expect(additiveShare(wide, -0.01, 0.5)).toBe(0)
  })

  it('draws contours on which the matte is at their share', () => {
    const rim = 0.7
    for (const acceptDeg of [5, 40, 90, 150]) {
      const m = additiveMatte({
        bKeyHueDeg: 300,
        bKeyAcceptDeg: acceptDeg,
        bKeyLevel: 0.4,
      })
      for (const share of [0.25, 0.5, 1]) {
        const { from, apex, to } = shareContour(m, share, rim)!
        expect(from.r).toBeCloseTo(rim, 9)
        expect(to.r).toBeCloseTo(rim, 9)
        expect(apex.r).toBeCloseTo(share * 0.4, 9)
        for (const end of [from, to]) {
          for (const t of [0.1, 0.5, 0.9]) {
            const u =
              apex.r * Math.cos(apex.angle) * (1 - t) +
              end.r * Math.cos(end.angle) * t
            const v =
              apex.r * Math.sin(apex.angle) * (1 - t) +
              end.r * Math.sin(end.angle) * t
            expect(backingLevel(m, u, v) / 0.4).toBeCloseTo(share, 6)
          }
        }
      }
    }
  })

  it('has no contour past the rim', () => {
    expect(shareContour(green, 1, 0.2)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'

import { ACTIVE_HEIGHT, ACTIVE_WIDTH } from '../core/signal/constants'
import { smpteBarsPixels, sweepPixels } from './pattern'

// The patterns are written as pixels and wrapped in a canvas for the app, so
// that the offline renderer draws the same bars rather than its own. The canvas
// half cannot be exercised here — node has none — which is exactly why the
// pixel half is worth pinning: it is the copy both callers now share, and a
// pattern that quietly changes shape changes what every screenshot, contact
// sheet and render made against it means.

const W = ACTIVE_WIDTH
const H = ACTIVE_HEIGHT

const at = (px: Uint8ClampedArray, x: number, y: number) => {
  const i = (y * W + x) * 4
  return [px[i], px[i + 1], px[i + 2], px[i + 3]]
}

describe('SMPTE bars', () => {
  const px = smpteBarsPixels()

  it('fills the frame opaquely', () => {
    expect(px.length).toBe(W * H * 4)
    for (let i = 3; i < px.length; i += 4) {
      if (px[i] !== 255) throw new Error(`transparent pixel at ${(i - 3) / 4}`)
    }
  })

  it('lays the seven 75% bars across the top band', () => {
    // Mid-bar on each, a third of the way down, which is inside the top band
    // (0.67 of the height) wherever the rounding lands.
    const y = Math.round(H * 0.3)
    const bw = W / 7
    const mid = (i: number) => at(px, Math.round(i * bw + bw / 2), y)
    const C = 0xc0
    expect(mid(0)).toEqual([C, C, C, 255])
    expect(mid(1)).toEqual([C, C, 0, 255])
    expect(mid(2)).toEqual([0, C, C, 255])
    expect(mid(3)).toEqual([0, C, 0, 255])
    expect(mid(4)).toEqual([C, 0, C, 255])
    expect(mid(5)).toEqual([C, 0, 0, 255])
    expect(mid(6)).toEqual([0, 0, C, 255])
  })

  it('puts white and the two PLUGE steps along the bottom', () => {
    const y = H - 2
    // The second of the seven bottom cells is 100% white, and the sub-black and
    // above-black pair either side of black is what makes the row a PLUGE.
    expect(at(px, Math.round(W * (5 / 28) + 10), y)).toEqual([
      255, 255, 255, 255,
    ])
    const cell = (frac: number) => at(px, Math.round(W * frac) + 4, y)[0]
    expect(cell(20 / 28)).toBe(0x09)
    expect(cell(20 / 28 + 8 / 84)).toBe(0x13)
    expect(cell(20 / 28 + 16 / 84)).toBe(0x1d)
  })
})

describe('sweep', () => {
  const px = sweepPixels()

  it('fills the frame opaquely and in grey', () => {
    expect(px.length).toBe(W * H * 4)
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] !== px[i + 1] || px[i] !== px[i + 2]) {
        throw new Error(`coloured pixel at ${i / 4}`)
      }
      if (px[i + 3] !== 255) throw new Error(`transparent pixel at ${i / 4}`)
    }
  })

  it('ramps across the top', () => {
    const y = 4
    expect(at(px, 2, y)[0]).toBeLessThan(10)
    expect(at(px, W - 3, y)[0]).toBeGreaterThan(245)
  })

  it('grates faster further down the band stack', () => {
    // Zero crossings across one row: a higher band crosses more often, which is
    // the whole claim the pattern makes about the bandwidth sliders.
    const crossings = (y: number) => {
      let n = 0
      for (let x = 1; x < W; x++) {
        const a = at(px, x - 1, y)[0] - 128
        const b = at(px, x, y)[0] - 128
        if (a < 0 !== b < 0) n++
      }
      return n
    }
    const low = crossings(Math.round(H * 0.2))
    const high = crossings(Math.round(H * 0.7))
    expect(high).toBeGreaterThan(low)
  })
})

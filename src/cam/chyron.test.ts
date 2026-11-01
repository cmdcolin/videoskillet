import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { GLYPH_W } from '../core/gpu/captionrom'
import { ACTIVE_WIDTH } from '../core/signal/constants'
import { captioned, chyronOn, chyronText } from './chyron'
import { SLICE } from './tape'

const WORDS = 'so this is the kitchen where we keep the good spoons'

// The block's edges across the glass, as far as its longest row reaches.
const span = (slice: number) => {
  const c = { ...DEFAULT_CONTROLS, ...chyronOn(slice) }
  const longest = Math.max(
    ...chyronText(WORDS, slice)
      .split('\n')
      .map(r => r.length),
  )
  return [c.cgX, c.cgX + (c.cgScale * GLYPH_W * longest) / ACTIVE_WIDTH]
}

describe('the captions chyron', () => {
  it('sits centred across a whole picture', () => {
    const [left = 0, right = 0] = span(1)
    expect(left).toBeGreaterThan(0.1)
    expect(right).toBeLessThan(1 - left)
  })

  it('fits inside an upright slice at the same type size', () => {
    const [left = 0, right = 0] = span(SLICE)
    expect(left).toBeGreaterThan((1 - SLICE) / 2)
    expect(right).toBeLessThan((1 + SLICE) / 2)
    expect(chyronOn(SLICE).cgScale).toBe(chyronOn(1).cgScale)
  })

  it('leaves a look that keys its own chyron alone', () => {
    const own = { ...DEFAULT_CONTROLS, cgMix: 0.8, cgX: 0.3, cgScale: 3 }
    expect(captioned(own, 1)).toEqual(own)
    expect(captioned(DEFAULT_CONTROLS, 1).cgMix).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'

import { CAPTION_SEED, wantsWords } from './captionSeed'

describe('wantsWords', () => {
  it('is true for a look that turns on the caption decoder or the chyron', () => {
    expect(wantsWords({ cc: 1 })).toBe(true)
    expect(wantsWords({ cgMix: 0.4 })).toBe(true)
  })

  it('is false for a look that leaves both off or does not name them', () => {
    expect(wantsWords({ cc: 0, cgMix: 0 })).toBe(false)
    expect(wantsWords({ noiseIre: 9 })).toBe(false)
    expect(wantsWords({})).toBe(false)
  })

  it('seeds with words rather than an empty caption', () => {
    expect(CAPTION_SEED.length).toBeGreaterThan(0)
  })
})

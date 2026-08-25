import { describe, expect, it } from 'vitest'

import { codecFor, levelsFor } from './record'

describe('H.264 level selection', () => {
  it('spells a level as the last byte of the codec string', () => {
    expect(codecFor(0x2a)).toBe('avc1.42002a')
    expect(codecFor(0x32)).toBe('avc1.420032')
  })

  it('declines level 4.2 for the retina window that broke recording', () => {
    // 2560x1592 codes as 2560x1600 = 16000 macroblocks, against 4.2's 8704.
    const levels = levelsFor(2560, 1592)
    expect(levels).not.toContain(0x2a)
    expect(levels[0]).toBe(0x32)
  })

  it('offers the smallest level that fits first, and larger ones after', () => {
    expect(levelsFor(640, 480)[0]).toBe(0x1e)
    expect(levelsFor(1920, 1080)[0]).toBe(0x28)
    expect(levelsFor(3840, 2160)[0]).toBe(0x33)
    expect(levelsFor(1920, 1080)).toContain(0x3c)
  })

  it('has nothing to offer a picture past the top level', () => {
    expect(levelsFor(16384, 16384)).toEqual([])
  })
})

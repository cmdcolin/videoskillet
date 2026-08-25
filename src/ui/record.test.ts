import { describe, expect, it } from 'vitest'

import { candidatesFor, codecFor } from './record'

describe('H.264 level selection', () => {
  it('spells profile and level into the codec string', () => {
    expect(codecFor('6400', 0x32)).toBe('avc1.640032')
    expect(codecFor('4200', 0x2a)).toBe('avc1.42002a')
  })

  it('declines level 4.2 for the retina window that broke recording', () => {
    // 2560x1592 codes as 2560x1600 = 16000 macroblocks, against 4.2's 8704.
    const codecs = candidatesFor(2560, 1592)
    expect(codecs.some(c => c.endsWith('2a'))).toBe(false)
    expect(codecs[0]).toBe('avc1.640032')
  })

  it('asks for High first and keeps the lesser profiles as fallbacks', () => {
    const codecs = candidatesFor(1920, 1080)
    expect(codecs[0]).toBe('avc1.640028')
    expect(codecs).toContain('avc1.4d0028')
    expect(codecs).toContain('avc1.420028')
    expect(codecs.indexOf('avc1.640028')).toBeLessThan(
      codecs.indexOf('avc1.4d0028'),
    )
  })

  it('offers the smallest level that fits before the larger ones', () => {
    expect(candidatesFor(640, 480)[0]).toBe('avc1.64001e')
    expect(candidatesFor(3840, 2160)[0]).toBe('avc1.640033')
  })

  it('has nothing to offer a picture past the top level', () => {
    expect(candidatesFor(16384, 16384)).toEqual([])
  })
})

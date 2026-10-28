import { describe, expect, it } from 'vitest'

import { CAPTION_FONT } from './captionfont'
import {
  buildCaptionRom,
  CC_BUF_LEN,
  CC_PAGE,
  GLYPH_COUNT,
  GLYPH_FIRST,
  GLYPH_H,
} from './captionrom'

const glyph = (rom: Uint32Array, ch: string) => {
  const i = ch.codePointAt(0)! - GLYPH_FIRST
  return Array.from(rom.subarray(i * GLYPH_H, (i + 1) * GLYPH_H))
}

describe('buildCaptionRom', () => {
  it('fills the font half from the committed font, without a canvas', () => {
    expect(CAPTION_FONT.length).toBe(GLYPH_COUNT * GLYPH_H)
    const rom = buildCaptionRom()
    expect(rom.length).toBe(CC_BUF_LEN)
    expect(glyph(rom, ' ').every(r => r === 0)).toBe(true)
    for (const ch of 'AZaz09#') {
      expect(glyph(rom, ch).some(r => r !== 0)).toBe(true)
    }
    expect(glyph(rom, 'A')).not.toEqual(glyph(rom, 'B'))
    expect(rom.subarray(CC_PAGE).every(v => v === 0)).toBe(true)
  })
})

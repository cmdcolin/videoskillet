// The caption decoder's memory, as one buffer: a font ROM baked once at
// construction and the page RAM the decoder writes a character at a time.
//
// They share a binding for two reasons. `decode` already carries seven storage
// buffers and eight is the floor WebGPU guarantees, so a ninth would be a
// device that works here and refuses somewhere else. And on the chip this is
// modelling they genuinely are one memory — which is why bending an address
// line reaches the glyphs and the page alike.
//
// A cell is a glyph index with a flag above it. Odd parity is what line 21
// protects each character with, and a decoder that caught a failure drew a
// solid block rather than guessing, so the flag has to survive as far as the
// painter.

import { CC_COLS, wrapCaption } from '../signal/captionwrap'
import { CAPTION_FONT } from './captionfont'

// Cells on the wire per line: seven of run-in, two blank, three start bits and
// two eight-bit characters. Both ends index the same grid off this.
export const CC_CELLS = 28

export { CC_COLS }
export const CC_ROWS = 4 // roll-up depth: the rows that scroll as one
export const GLYPH_W = 8
export const GLYPH_H = 12
export const GLYPH_FIRST = 0x20
export const GLYPH_COUNT = 96 // 0x20..0x7f, the printable half

export const CC_BLOCK = 1 << 8 // parity failed: draw the block, not a guess
// A cell the decoder has actually written. Glyph 0 is a space, so without this
// an untouched cell and a received space would be the same value — and they
// are not, because the caption's black box only covers what arrived.
export const CC_SET = 1 << 9

const FONT_LEN = GLYPH_COUNT * GLYPH_H
export const CC_PAGE = FONT_LEN // first cell of page RAM
export const CC_CURSOR = CC_PAGE + CC_ROWS * CC_COLS
export const CC_BUF_LEN = CC_CURSOR + 1

// One u32 per glyph row, low bit leftmost. Wasteful against packing seven rows
// into two words, and worth it: every read of this buffer is a row lookup, and
// the packed form would put a shift and a mask in the painter's inner loop for
// 2 KiB.
//
// The font is committed data (`captionfont.ts`), so a Linux tab, a Mac tab
// and the headless renderer all decode the same glyphs.
export function buildCaptionRom(): Uint32Array {
  const rom = new Uint32Array(CC_BUF_LEN)
  rom.set(CAPTION_FONT)
  return rom
}

// The same memory laid out for a character generator that is *not* decoding
// anything: the page written straight from the text, because a box standing at
// the switcher has the words in hand rather than recovering them off a wire.
//
// The rows come from the same wrap the encoder rolls the page by, so the open
// and closed caption show the same words.
export function buildPage(text: string): Uint32Array {
  const page = new Uint32Array(CC_ROWS * CC_COLS)
  // The last rows rather than the first: a lower third that overran should show
  // where the text got to, the same way the roll-up page does.
  const shown = wrapCaption(text).slice(-CC_ROWS)
  shown.forEach((line, r) => {
    const row = r + CC_ROWS - shown.length
    Array.from(line).forEach((ch, c) => {
      const code = ch.codePointAt(0) ?? 0x20
      const glyph =
        code >= GLYPH_FIRST && code < GLYPH_FIRST + GLYPH_COUNT
          ? code - GLYPH_FIRST
          : 0
      page[row * CC_COLS + c] = glyph | CC_SET
    })
  })
  return page
}

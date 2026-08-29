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

// Cells on the wire per line: seven of run-in, two blank, three start bits and
// two eight-bit characters. Both ends index the same grid off this.
export const CC_CELLS = 28

export const CC_COLS = 32 // what line 21 carries, and what every caption was
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

// Same size, threshold and font stack the teletype card draws its dots at
// (`sources/teletype.ts`), and for the same reason: a glyph rasterised clean
// and scaled down is a picture of type, where one thresholded at dot
// resolution is type. The two are not shared because core cannot import the
// app — and because they want different things out of the same decision. The
// card makes a picture; this makes a ROM.
const CELL_PX = 11
const INK = 96
const FONT = `${CELL_PX}px "DejaVu Sans Mono", "Liberation Mono", "Courier New", monospace`

// One u32 per glyph row, low bit leftmost. Wasteful against packing seven rows
// into two words, and worth it: every read of this buffer is a row lookup, and
// the packed form would put a shift and a mask in the painter's inner loop for
// 2 KiB.
export function buildCaptionRom(): Uint32Array {
  const rom = new Uint32Array(CC_BUF_LEN)
  // The headless profiler has a GPU and no DOM. A caption it cannot draw is
  // better than a pass it cannot build, so the ROM comes back blank there and
  // everything downstream still runs.
  if (typeof OffscreenCanvas === 'undefined') return rom

  const cell = new OffscreenCanvas(GLYPH_W, GLYPH_H)
  const g = cell.getContext('2d')
  if (!g) return rom
  g.font = FONT
  g.textAlign = 'center'
  g.textBaseline = 'middle'

  for (let i = 0; i < GLYPH_COUNT; i++) {
    g.clearRect(0, 0, GLYPH_W, GLYPH_H)
    g.fillStyle = '#fff'
    g.fillText(String.fromCodePoint(GLYPH_FIRST + i), GLYPH_W / 2, GLYPH_H / 2)
    const img = g.getImageData(0, 0, GLYPH_W, GLYPH_H)
    for (let y = 0; y < GLYPH_H; y++) {
      let bits = 0
      for (let x = 0; x < GLYPH_W; x++) {
        if (img.data[(y * GLYPH_W + x) * 4 + 3] >= INK) bits |= 1 << x
      }
      rom[i * GLYPH_H + y] = bits
    }
  }
  return rom
}

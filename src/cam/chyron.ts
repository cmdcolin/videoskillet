import { CC_COLS, GLYPH_W } from '../core/gpu/captionrom'
import { wrapText } from '../core/signal/captionwrap'
import { ACTIVE_WIDTH } from '../core/signal/constants'

import type { Controls } from '../core/controls'

// Picture samples per font dot. Much under 2 and the glyphs fall below the
// chain's bandwidth and smear.
const SCALE = 2

// The columns the words wrap to: all of them on a whole picture, and the same
// share of an upright slice, so the block takes as much of the screen in
// either layout.
const colsOf = (slice: number) => Math.floor(CC_COLS * slice)

// The chyron's block, centred in the part of the glass on show.
export const chyronOn = (slice: number): Partial<Controls> => {
  const width = (SCALE * GLYPH_W * colsOf(slice)) / ACTIVE_WIDTH
  return { cgMix: 1, cgScale: SCALE, cgX: (1 - width) / 2 }
}

// The words broken into the block's rows. The encoder keeps a row that fits as
// it is, so it does not wrap them again.
export const chyronText = (text: string, slice: number) =>
  wrapText(text, colsOf(slice)).join('\n')

// Captions key what people say into the picture over any look. A look that
// keys the chyron itself keeps its own block.
export const captioned = (c: Controls, slice: number): Controls =>
  c.cgMix > 0 ? c : { ...c, ...chyronOn(slice) }

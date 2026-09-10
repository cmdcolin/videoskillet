// A source with no file behind it, for rendering a look on its own.
//
// The patterns themselves are the app's (`src/sources/pattern.ts`), handed in
// as pixel producers rather than reimplemented — a renderer with its own idea
// of what bars look like is a renderer whose output cannot be compared with the
// app's. What is left here is which one, and the fact that a still is uploaded
// once.
//
// `tv static`, `vhs static` and the video synth are not here at all: the engine
// generates those on the GPU (`compose.wgsl`), so what they need is
// `setNoiseSource` and an empty deck, which is what `none` leaves behind.

import { ACTIVE_HEIGHT, ACTIVE_WIDTH } from '../../src/core/signal/constants.ts'

export interface Frames {
  next: () => Promise<Uint8Array | null>
  close: () => Promise<void>
}

const black = (w: number, h: number): Uint8Array => {
  const px = new Uint8Array(w * h * 4)
  for (let i = 3; i < px.length; i += 4) px[i] = 255
  return px
}

export function pattern(
  name: string,
  bars: () => Uint8ClampedArray,
  sweep: () => Uint8ClampedArray,
): Frames {
  const px = name === 'bars' ? bars() : name === 'sweep' ? sweep() : null
  // Black rather than nothing for `none`, so a deck the link left empty holds a
  // picture the chain can damage instead of whatever the texture came up with.
  // A GPU-generated source bypasses it either way.
  const frame =
    px === null
      ? black(ACTIVE_WIDTH, ACTIVE_HEIGHT)
      : new Uint8Array(px.buffer.slice(0))
  let first = true
  return {
    next: () => {
      // Only the first frame is handed over. The picture does not change, and
      // re-uploading a still sixty times a second is work with no effect — the
      // engine holds the last texture it was given. What moves is everything
      // the chain does to it.
      if (!first) return Promise.resolve(null)
      first = false
      return Promise.resolve(frame)
    },
    close: () => Promise.resolve(),
  }
}

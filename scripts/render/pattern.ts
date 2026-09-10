// A source with no file behind it, for rendering a look on its own.
//
// Deliberately thin. The engine already generates TV and VHS static and the
// video synth on the GPU (`--set=srcNoise:1` and friends reach them), so what is
// actually missing here is a still to point the chain at — bars, or nothing at
// all when the look is a feedback loop that builds its own picture.

export interface Frames {
  next: () => Promise<Uint8Array | null>
  close: () => Promise<void>
}

// SMPTE bars over the active picture, matching `gpuprof/sources.ts` so a look
// screened there and rendered here stands on the same ground.
function bars(w: number, h: number): Uint8Array {
  const px = new Uint8Array(w * h * 4)
  const top = [
    [191, 191, 191],
    [191, 191, 0],
    [0, 191, 191],
    [0, 191, 0],
    [191, 0, 191],
    [191, 0, 0],
    [0, 0, 191],
  ]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const t = y / h
      const b = Math.min(6, Math.floor((x / w) * 7))
      let rgb: number[]
      if (t < 0.67) rgb = top[b]
      else if (t < 0.75) rgb = b % 2 === 0 ? top[6 - b] : [19, 19, 19]
      else {
        const k = Math.min(5, Math.floor((x / w) * 6))
        rgb =
          k === 0
            ? [0, 33, 76]
            : k === 1
              ? [255, 255, 255]
              : k === 2
                ? [50, 0, 106]
                : k === 4
                  ? [26, 26, 26]
                  : [19, 19, 19]
      }
      px[i] = rgb[0]
      px[i + 1] = rgb[1]
      px[i + 2] = rgb[2]
      px[i + 3] = 255
    }
  }
  return px
}

const black = (w: number, h: number): Uint8Array => {
  const px = new Uint8Array(w * h * 4)
  for (let i = 3; i < px.length; i += 4) px[i] = 255
  return px
}

export function pattern(name: string, w: number, h: number): Frames {
  // Built once and handed over on every frame: it is a still, and the engine
  // uploads whatever it is given each time. What moves is everything the chain
  // does to it.
  const frame = name === 'none' ? null : name === 'static' ? null : bars(w, h)
  // 'static' means the GPU's own noise, so the deck stays empty and
  // `--set=srcNoise:1` is what puts snow on it. 'none' likewise, for a look
  // that is all loop.
  const blank = name === 'none' || name === 'static' ? black(w, h) : null
  let first = true
  return {
    next: () => {
      // Only the first frame is handed over. The picture does not change, and
      // re-uploading a still sixty times a second is work with no effect —
      // the engine holds the last texture it was given.
      if (!first) return Promise.resolve(null)
      first = false
      return Promise.resolve(frame ?? blank)
    },
    close: () => Promise.resolve(),
  }
}

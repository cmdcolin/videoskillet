import { ACTIVE_HEIGHT, ACTIVE_WIDTH } from '../../src/core/signal/constants'

// SMPTE bars for A, a gradient with a disc for B: enough picture for every
// path to have edges, colour and a highlight to work on.
export function barsA(): Uint8Array<ArrayBuffer> {
  const px = new Uint8Array(ACTIVE_WIDTH * ACTIVE_HEIGHT * 4)
  const bars = [
    [191, 191, 191],
    [191, 191, 0],
    [0, 191, 191],
    [0, 191, 0],
    [191, 0, 191],
    [191, 0, 0],
    [0, 0, 191],
  ]
  for (let y = 0; y < ACTIVE_HEIGHT; y++) {
    for (let x = 0; x < ACTIVE_WIDTH; x++) {
      const i = (y * ACTIVE_WIDTH + x) * 4
      const t = y / ACTIVE_HEIGHT
      const b = Math.floor((x / ACTIVE_WIDTH) * 7)
      let rgb: number[]
      if (t < 0.67) rgb = bars[b]
      else if (t < 0.75) rgb = b % 2 === 0 ? bars[6 - b] : [19, 19, 19]
      else {
        const k = Math.floor((x / ACTIVE_WIDTH) * 6)
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

export function gradientB(): Uint8Array<ArrayBuffer> {
  const px = new Uint8Array(ACTIVE_WIDTH * ACTIVE_HEIGHT * 4)
  for (let y = 0; y < ACTIVE_HEIGHT; y++) {
    for (let x = 0; x < ACTIVE_WIDTH; x++) {
      const i = (y * ACTIVE_WIDTH + x) * 4
      const dx = x - ACTIVE_WIDTH * 0.5
      const dy = y - ACTIVE_HEIGHT * 0.5
      const disc = dx * dx + dy * dy < 120 * 120
      px[i] = disc ? 240 : (x / ACTIVE_WIDTH) * 255
      px[i + 1] = disc ? 240 : (y / ACTIVE_HEIGHT) * 255
      px[i + 2] = disc ? 200 : 128
      px[i + 3] = 255
    }
  }
  return px
}

// The other half of a fair test, and the one bars cannot be. Every effect that
// works on *detail* — luma bandwidth, tape softening, chroma noise, dropouts,
// a comb filter — moves a flat colour bar by almost nothing and moves this a
// lot, so a survey run only on bars reports the whole tape-wear family as
// barely visible. Four bands, top to bottom: a multiburst sweeping fine luma
// detail, saturated edges on a grey ramp, coloured text-scale blocks, and a lit
// sphere over a textured floor for something with modelling in it.
export function detailA(): Uint8Array<ArrayBuffer> {
  const px = new Uint8Array(ACTIVE_WIDTH * ACTIVE_HEIGHT * 4)
  const put = (i: number, r: number, g: number, b: number): void => {
    px[i] = Math.max(0, Math.min(255, Math.round(r)))
    px[i + 1] = Math.max(0, Math.min(255, Math.round(g)))
    px[i + 2] = Math.max(0, Math.min(255, Math.round(b)))
    px[i + 3] = 255
  }
  const hash = (x: number, y: number): number => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  for (let y = 0; y < ACTIVE_HEIGHT; y++) {
    const t = y / ACTIVE_HEIGHT
    for (let x = 0; x < ACTIVE_WIDTH; x++) {
      const i = (y * ACTIVE_WIDTH + x) * 4
      const u = x / ACTIVE_WIDTH
      if (t < 0.22) {
        // multiburst: period sweeping from 24 samples down to 2
        const period = 24 * (1 - u) + 2 * u
        const v = 128 + 110 * Math.sin((2 * Math.PI * x) / period)
        put(i, v, v, v)
      } else if (t < 0.42) {
        // saturated blocks on a luma ramp — chroma detail against luma detail
        const k = Math.floor(u * 12)
        const ramp = 20 + 215 * u
        const hue = (k / 12) * 2 * Math.PI
        put(
          i,
          ramp * (0.5 + 0.5 * Math.cos(hue)),
          ramp * (0.5 + 0.5 * Math.cos(hue - 2.1)),
          ramp * (0.5 + 0.5 * Math.cos(hue + 2.1)),
        )
      } else if (t < 0.58) {
        // text-scale structure: 3px strokes with 2px gaps, the thing a comb
        // filter and a soft luma path each ruin in their own way
        const on = x % 5 < 3 && y % 9 < 6
        put(i, on ? 230 : 16, on ? 230 : 16, on ? 230 : 16)
      } else {
        // a lit sphere on a noisy floor: gradients, a specular highlight, and
        // texture fine enough for grain and dropouts to have something to eat
        const cx = ACTIVE_WIDTH * 0.5
        const cy = ACTIVE_HEIGHT * 0.79
        const r = ACTIVE_HEIGHT * 0.19
        const dx = (x - cx) / r
        const dy = (y - cy) / r
        const d2 = dx * dx + dy * dy
        if (d2 < 1) {
          const nz = Math.sqrt(1 - d2)
          const lam = Math.max(0, -0.45 * dx - 0.5 * dy + 0.74 * nz)
          const spec = Math.pow(Math.max(0, nz - 0.3), 12) * 255
          put(
            i,
            40 + 190 * lam + spec,
            30 + 150 * lam + spec,
            60 + 120 * lam + spec,
          )
        } else {
          const n = hash(Math.floor(x / 2), Math.floor(y / 2))
          const v = 45 + 70 * n + 40 * Math.sin(u * 30)
          put(i, v * 0.9, v, v * 1.15)
        }
      }
    }
  }
  return px
}

// SMPTE color bars: the validation instrument. 75% bars, castellation strip,
// and a PLUGE-ish bottom row. Drawn at raster resolution.
//
// **Each pattern exists twice, as pixels and as a canvas**, and the canvas is
// the thin one. The app stages a source through `copyExternalImageToTexture`,
// which wants something drawable; the offline renderer
// (`scripts/render/`) runs where there is no canvas at all and hands the engine
// raw bytes. Writing the pattern once and wrapping it is what stops the two
// from drifting — a renderer with its own idea of what bars look like is a
// renderer whose output cannot be compared with the app's.

import { ACTIVE_HEIGHT, ACTIVE_WIDTH } from '../core/signal/constants'

const W = ACTIVE_WIDTH
const H = ACTIVE_HEIGHT

// A rect written straight into RGBA, with the same rounding `fillRect` was
// called with. Integer edges and no anti-aliasing, so this is the same coverage
// the canvas produced; later rects overwrite earlier ones, as they did there.
function fill(
  px: Uint8ClampedArray<ArrayBuffer>,
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
): void {
  const xEnd = Math.min(W, x0 + w)
  const yEnd = Math.min(H, y0 + h)
  for (let y = Math.max(0, y0); y < yEnd; y++) {
    for (let x = Math.max(0, x0); x < xEnd; x++) {
      const i = (y * W + x) * 4
      px[i] = r
      px[i + 1] = g
      px[i + 2] = b
      px[i + 3] = 255
    }
  }
}

const canvasOf = (px: Uint8ClampedArray<ArrayBuffer>): OffscreenCanvas => {
  const cv = new OffscreenCanvas(W, H)
  const g = cv.getContext('2d')
  if (!g) throw new Error('no 2d context')
  g.putImageData(new ImageData(px, W, H), 0, 0)
  return cv
}

// Multiburst-style sweep: frequency gratings at known MHz plus a luma ramp.
// The bandwidth sliders should visibly erase gratings above their cutoff.
export function sweepPixels(): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(W * H * 4)
  // active width = 754 samples at 14.318 MHz; grating of period p px = 14.318/(2p)... MHz
  const bands = [0.5, 1, 2, 3, 4.2, 5]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      let v: number
      if (y < H * 0.15) {
        v = (x / W) * 255 // ramp
      } else if (y < H * 0.8) {
        const band =
          bands[
            Math.min(
              Math.floor((y - H * 0.15) / ((H * 0.65) / bands.length)),
              bands.length - 1,
            )
          ]
        // band MHz -> cycles per sample at 14.318 MHz raster
        v = 128 + 100 * Math.sin(2 * Math.PI * (band / 14.318182) * x)
      } else {
        v = x % 94 < 47 ? 20 : 235 // coarse squares for ringing
      }
      px[i] = v
      px[i + 1] = v
      px[i + 2] = v
      px[i + 3] = 255
    }
  }
  return px
}

export const sweep = (): OffscreenCanvas => canvasOf(sweepPixels())

// The top band's seven bars, as 0..1 triples, and the single source the drawn
// pattern is built from. 0xC0 rather than exactly 0.75 is the conventional
// 8-bit value for 75% bars, and is what this has always drawn.
const B = 0xc0 / 0xff
const SMPTE_BAR_RGB: readonly (readonly [number, number, number])[] = [
  [B, B, B],
  [B, B, 0],
  [0, B, B],
  [0, B, 0],
  [B, 0, B],
  [B, 0, 0],
  [0, 0, B],
]

const byte = (v: number) => Math.round(v * 0xff)

// `#rrggbb` as the three bytes it names. The strips below are written as hex
// because that is how a bar chart's colours are quoted, and this is the one
// place that has to turn them back into numbers.
const rgbOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]

export function smpteBarsPixels(): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(W * H * 4)
  const topH = Math.round(H * 0.67)
  const bw = W / 7
  SMPTE_BAR_RGB.forEach((rgb, i) => {
    fill(
      px,
      Math.round(i * bw),
      0,
      Math.ceil(bw),
      topH,
      byte(rgb[0]),
      byte(rgb[1]),
      byte(rgb[2]),
    )
  })
  const castH = Math.round(H * 0.08)
  const cast = [
    '#0000c0',
    '#131313',
    '#c000c0',
    '#131313',
    '#00c0c0',
    '#131313',
    '#c0c0c0',
  ]
  cast.forEach((col, i) => {
    fill(px, Math.round(i * bw), topH, Math.ceil(bw), castH, ...rgbOf(col))
  })
  const by = topH + castH
  const bh = H - by
  const bottom: [string, number][] = [
    ['#00214c', 5 / 28], // -I
    ['#ffffff', 5 / 28], // 100% white
    ['#32006a', 5 / 28], // +Q
    ['#131313', 5 / 28],
    ['#090909', 8 / 84], // sub-black
    ['#131313', 8 / 84],
    ['#1d1d1d', 8 / 84], // above-black
  ]
  let x = 0
  for (const [col, frac] of bottom) {
    const w = W * frac
    fill(px, Math.round(x), by, Math.ceil(w), bh, ...rgbOf(col))
    x += w
  }
  return px
}

export const smpteBars = (): OffscreenCanvas => canvasOf(smpteBarsPixels())

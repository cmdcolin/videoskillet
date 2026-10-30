import { chromaOf, satGate, type HueSlice } from '../ui/hueKey'

import type { ControlKey, Controls } from '../core/controls'

const wrapDeg = (deg: number) => ((deg % 360) + 360) % 360

// The hue the encoder gives an RGB colour, in degrees: the angle of its (U, V)
// chroma, atan2(V, U), which is the angle the hue keyers slice. Null for a
// colour too close to grey for `slice` to act on even half way.
export function chromaHue(r: number, g: number, b: number, slice: HueSlice) {
  const { u, v } = chromaOf(r, g, b)
  return satGate(slice, Math.hypot(u, v)) < 0.5
    ? null
    : wrapDeg((Math.atan2(v, u) * 180) / Math.PI)
}

// Whether the look's mixer loop keys on hue, which is what a tap can re-aim.
export const keysOnHue = (c: Controls): boolean =>
  c.cfbMix > 0 && c.cfbKey !== 0 && c.cfbKeyAcceptDeg > 0

export const aimKey = (c: Controls, hue: number | null): Controls =>
  hue === null || !keysOnHue(c) ? c : { ...c, cfbKeyHueDeg: Math.round(hue) }

// The chroma keyer across the mixer, cutting the camera on B where it shows
// the key hue and filling the hole from the frame store. These are the
// settings a sweep over a still on A found best, and a knob turned by hand
// overrides them. Strobe hold stays odd: at an even count the fill's fade
// cancels A's colour toward grey.
const KEYER: Partial<Controls> = {
  bKeyAcceptDeg: 45,
  bKeyClip: 0.05,
  bKeySpill: 0.6,
  bKeyFill: 2,
  bKeyFillMixA: 0.15,
  cfbHold: 3,
}

// The switches that make the mixer a keyer, which no knob overrides.
const KEYER_SWITCHES: Partial<Controls> = {
  bGain: 1,
  bGenlock: 1,
  bKey: 1,
  wipeMode: 0,
  pipMix: 0,
  pipKey: 0,
}

// The keyer knobs the loops sheet shows, its main ones first.
export const KEYER_KNOBS = {
  main: ['bKeyAcceptDeg', 'bKeyFill', 'bKeyFillMixA', 'bKeyFillHueDeg'],
  more: ['bKeyClip', 'bKeySoft', 'bKeySpill', 'bKeyDelayUs'],
} as const satisfies Record<string, readonly ControlKey[]>

// The keyer sees B's colour after B's hue trim, so the camera's hue is moved
// round by it to land on the backing.
export function keyOn(c: Controls, tweaks: Partial<Controls>, hue: number) {
  const keyed = { ...c, ...KEYER, ...tweaks, ...KEYER_SWITCHES }
  return { ...keyed, bKeyHueDeg: Math.round(wrapDeg(hue + keyed.bHueDeg)) }
}

// Where a point on the picture lands on the camera's own frame, both in 0..1.
// The picture is the camera cropped by the zoom and cover-fitted into the
// frame, so the long side is cropped, and a camera facing its subject is shown
// mirrored. A set on its side needs no case of its own: turning the tube and
// the camera together leaves the picture upright in the camera's own axes.
export function sourcePoint(
  at: { x: number; y: number },
  view: { width: number; height: number },
  src: { width: number; height: number; mirror: boolean; crop?: number },
): { x: number; y: number } {
  const va = view.width / view.height
  const sa = src.width / src.height
  const crop = src.crop ?? 1
  let x = 0.5 + (at.x - 0.5) / crop
  let y = 0.5 + (at.y - 0.5) / crop
  if (sa > va) x = 0.5 + (x - 0.5) * (va / sa)
  else y = 0.5 + (y - 0.5) * (sa / va)
  return { x: src.mirror ? 1 - x : x, y }
}

// The camera's colour at a point, averaged over a few pixels so one noisy
// photosite does not decide it, as 0..1 RGB.
export function colourAt(
  video: HTMLVideoElement,
  p: { x: number; y: number },
): [number, number, number] | null {
  const n = 7
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const g = c.getContext('2d', { willReadFrequently: true })
  if (g === null || video.videoWidth === 0) return null
  const sx = Math.min(
    Math.max(p.x * video.videoWidth - n / 2, 0),
    video.videoWidth - n,
  )
  const sy = Math.min(
    Math.max(p.y * video.videoHeight - n / 2, 0),
    video.videoHeight - n,
  )
  g.drawImage(video, sx, sy, n, n, 0, 0, n, n)
  const d = g.getImageData(0, 0, n, n).data
  let r = 0
  let gr = 0
  let b = 0
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]!
    gr += d[i + 1]!
    b += d[i + 2]!
  }
  const k = 255 * n * n
  return [r / k, gr / k, b / k]
}

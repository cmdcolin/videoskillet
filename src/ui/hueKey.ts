import { IRE_VIDEO_RANGE } from '../core/signal/constants'

import type { Controls } from '../core/controls'

// A hue keyer's slice of the U/V plane, as the two chroma keyers in the shaders
// cut it: a wedge either side of the key hue, eased over `edge` radians, times a
// saturation gate that rises over `satEdge` from `clip`. mix_b.wgsl `chromaKey`
// cuts the backing with it, and fb_composite.wgsl `keyGate` keeps the loop
// return with it, so 1 means "inside the slice" in both.

export interface HueSlice {
  /** Radians, on atan2(V, U). */
  hue: number
  accept: number
  edge: number
  clip: number
  satEdge: number
}

const TAU = 2 * Math.PI

export const wrapPi = (a: number) => a - TAU * Math.round(a / TAU)

export function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1)
  return t * t * (3 - 2 * t)
}

// The t in [0, 1] whose smoothstep is y.
export const unsmooth = (y: number) => 0.5 - Math.sin(Math.asin(1 - 2 * y) / 3)

const DEG = Math.PI / 180

// mix_b.wgsl chromaKey: the gain knob widens the hue edge by soft·π and the
// saturation edge by soft, and uniforms.ts hands both angles over in radians.
// The shader turns B's chroma by B's carrier phase before slicing, so the hue
// here is on the house wheel, which B's hue trim moves B's colours round.
export function mixerSlice(
  c: Pick<Controls, 'bKeyHueDeg' | 'bKeyAcceptDeg' | 'bKeyClip' | 'bKeySoft'>,
): HueSlice {
  const soft = Math.max(c.bKeySoft, 1e-4)
  return {
    hue: c.bKeyHueDeg * DEG,
    accept: c.bKeyAcceptDeg * DEG,
    edge: soft * Math.PI,
    clip: c.bKeyClip,
    satEdge: soft,
  }
}

const LOOP_KEY_CLIP = 3 / IRE_VIDEO_RANGE

// fb_composite.wgsl keyGate's hue branch: the softness is IRE of a 100 IRE
// slice, read as the same fraction of π, and the clip is fixed at 3 IRE of
// demodulated chroma on the bus, which the slice holds in the encoder's chroma
// units so it shares a wheel with the bars.
export function loopSlice(
  c: Pick<Controls, 'cfbKeyHueDeg' | 'cfbKeyAcceptDeg' | 'cfbKeySoft'>,
): HueSlice {
  return {
    hue: c.cfbKeyHueDeg * DEG,
    accept: c.cfbKeyAcceptDeg * DEG,
    edge: c.cfbKeySoft * 0.01 * Math.PI,
    clip: LOOP_KEY_CLIP,
    satEdge: LOOP_KEY_CLIP,
  }
}

// prelude.ts hueGate, with the hue already subtracted.
export const hueGate = (s: HueSlice, w: number) =>
  1 - smoothstep(s.accept - s.edge, s.accept + s.edge, Math.abs(wrapPi(w)))

export const satGate = (s: HueSlice, r: number) =>
  smoothstep(s.clip, s.clip + s.satEdge, r)

export const sliceAt = (s: HueSlice, u: number, v: number) =>
  hueGate(s, Math.atan2(v, u) - s.hue) * satGate(s, Math.hypot(u, v))

// mix_b.wgsl chromaKey's gate: 1 keeps B, 0 cuts it for the fill. A negative
// key inverts the slice and the key's size sets how far the gate swings.
export function mixerGate(key: number, s: HueSlice, u: number, v: number) {
  const inside = sliceAt(s, u, v)
  const g = key < 0 ? inside : 1 - inside
  return 1 + (g - 1) * Math.min(Math.abs(key), 1)
}

/** One point of a contour: an angle on the wheel and a chroma radius. */
export interface PolarPoint {
  angle: number
  r: number
}

export interface AdditiveMatte {
  /** Radians, on atan2(V, U). */
  hue: number
  accept: number
  /** The backing's chroma at full light, where the matte reaches 1. */
  level: number
}

export function additiveMatte(
  c: Pick<Controls, 'bKeyHueDeg' | 'bKeyAcceptDeg' | 'bKeyLevel'>,
): AdditiveMatte {
  return {
    hue: c.bKeyHueDeg * DEG,
    accept: c.bKeyAcceptDeg * DEG,
    level: c.bKeyLevel,
  }
}

// The weight mix_b.wgsl chromaKey puts on chroma across the key hue, which
// balances chroma along it at the edge of the wedge. Past 90° it stops at 0, so
// a wider acceptance keys the same half plane.
const acrossWeight = (accept: number) =>
  Math.max(Math.cos(accept), 0) / Math.max(Math.sin(accept), 1e-3)

// mix_b.wgsl chromaKey's `level`: how much backing a sample holds.
export function backingLevel(m: AdditiveMatte, u: number, v: number) {
  const kx = Math.cos(m.hue)
  const ky = Math.sin(m.hue)
  return u * kx + v * ky - acrossWeight(m.accept) * Math.abs(u * ky - v * kx)
}

// mix_b.wgsl backingShare as the matte takes it, capped at 1: the share of the
// fill laid under B, or of B kept when the key is inverted.
export const additiveShare = (m: AdditiveMatte, u: number, v: number) =>
  Math.min(Math.max(backingLevel(m, u, v) / Math.max(m.level, 1e-3), 0), 1)

// Where the additive matte reaches `share`, out to a rim of chroma `rim`: a
// chevron with its apex `share` of the backing level along the key hue and its
// arms parallel to the wedge's edges. Null when the apex is past the rim.
export function shareContour(m: AdditiveMatte, share: number, rim: number) {
  const apex = share * Math.max(m.level, 1e-3)
  const half = Math.atan2(1, acrossWeight(m.accept))
  const toRim =
    -apex * Math.cos(half) + Math.sqrt(rim * rim - (apex * Math.sin(half)) ** 2)
  const arm = (side: number): PolarPoint => {
    const a = m.hue + side * half
    const u = apex * Math.cos(m.hue) + toRim * Math.cos(a)
    const v = apex * Math.sin(m.hue) + toRim * Math.sin(a)
    return { angle: Math.atan2(v, u), r: Math.hypot(u, v) }
  }
  return apex < rim
    ? { from: arm(1), apex: { angle: m.hue, r: apex }, to: arm(-1) }
    : null
}

// Where the slice reaches `level`, as the inner edge of the region inside it:
// for each hue in the wedge, the least saturation at which it gets there.
// `whole` is a region that wraps the full turn. Null is a level the slice
// never reaches.
export function sliceContour(
  s: HueSlice,
  level: number,
  steps: number,
): { whole: boolean; edge: PolarPoint[] } | null {
  const lo = s.accept - s.edge
  const reach = lo + 2 * s.edge * unsmooth(1 - level)
  if (reach < 0 || level <= 0 || level > 1) return null
  const whole = reach >= Math.PI
  const half = Math.min(reach, Math.PI)
  const edge = Array.from({ length: steps + 1 }, (_, i) => {
    const w = -half + (2 * half * i) / steps
    const need = Math.min(level / Math.max(hueGate(s, w), 1e-9), 1)
    return { angle: s.hue + w, r: s.clip + s.satEdge * unsmooth(need) }
  })
  return { whole, edge }
}

// An RGB colour's chroma as the encoder makes it: yuvOf in prelude.ts, on the
// Rec. 601 luma.
export function chromaOf(r: number, g: number, b: number) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  return { u: 0.492 * (b - y), v: 0.877 * (r - y) }
}

// Where the 75% colour bars sit on the wheel, for each bar's RGB at 0.75.
const BAR_RGB = {
  yel: [1, 1, 0],
  cyan: [0, 1, 1],
  grn: [0, 1, 0],
  mag: [1, 0, 1],
  red: [1, 0, 0],
  blue: [0, 0, 1],
} as const

export const BARS = Object.entries(BAR_RGB).map(([name, [r, g, b]]) => {
  const { u, v } = chromaOf(r, g, b)
  return { name, angle: Math.atan2(v, u), r: 0.75 * Math.hypot(u, v) }
})

/** The burst sits on −U. */
export const BURST_ANGLE = Math.PI

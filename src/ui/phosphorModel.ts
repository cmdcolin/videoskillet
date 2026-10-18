import { F_H, LINES } from '../core/signal/constants'

import type { Controls } from '../core/controls'

// The screen's memory as decode.wgsl keeps it: the light the layer holds after
// a field of white, given back field by field, and the efficiency the coating
// keeps once static white has worn it. Scatter moves held light between
// neighbours and conserves it, so a flat field of white decays the same with or
// without it, and the plots leave it out.

export const FIELD_HZ = (2 * F_H) / LINES

type Rgb = readonly number[]
type Phosphor = Pick<Controls, 'phosphor' | 'phosphorSkew' | 'phosphorMode'>

const toLight = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((Math.max(c, 0) + 0.055) / 1.055) ** 2.4

// decode.wgsl phosphorRgb for a white input: the matrices' rows summed, since
// white is 1 in every channel, and the mono tube's tint.
const DRIVE_OF_WHITE: readonly Rgb[] = [
  [1, 1, 1],
  [1, 1, 1],
  [0.95581, 0.88581, 1],
  [0.18, 1, 0.33],
]
const MATRIXED = [false, true, true, false]

export function whiteLight(mode: number): Rgb {
  const m = Math.min(Math.max(Math.round(mode), 0), 3)
  const drive = DRIVE_OF_WHITE[m]!.map(c =>
    MATRIXED[m] ? Math.min(c, 1) ** (1 / 2.2) : c,
  )
  return drive.map(toLight)
}

// decode.wgsl ~810: the rate per field, skewed red and blue against green.
// Null with persistence off, where the shader skips the layer and the light is
// gone inside the field.
export function decayRates(p: Phosphor): Rgb | null {
  if (p.phosphor <= 0) return null
  const ph = Math.min(p.phosphor, 0.9995)
  const k = (8 * (1 - ph)) / ph
  const s = p.phosphorSkew
  return [k * (1 + s), k, k * (1 + 2 * s)]
}

const LEAK = 0.9995

// Each channel's light, field by field after the beam leaves a white patch: the
// held light through phosphorDecay e/(1+ke) and the slow leak under it, with
// nothing driving it any more.
export function afterglow(p: Phosphor, fields: number): Rgb[] {
  const rates = decayRates(p)
  const start = whiteLight(p.phosphorMode)
  const out: Rgb[] = [start]
  let e = start
  for (let n = 1; n <= fields; n++) {
    e = rates ? e.map((v, c) => (v / (1 + rates[c]! * v)) * LEAK) : [0, 0, 0]
    out.push(e)
  }
  return out
}

const SPANS = [4, 8, 15, 30, 60, 120, 300, 600, 1200, 3600]

// Fields enough for the slowest channel to fall to a hundredth of white, on a
// round span.
export function afterglowSpan(p: Phosphor) {
  const rates = decayRates(p)
  if (!rates) return SPANS[0]!
  const k = Math.min(...rates)
  let e = 1
  let n = 0
  while (e > 0.01 && n < SPANS.at(-1)!) {
    e = (e / (1 + k * e)) * LEAK
    n++
  }
  return SPANS.find(s => s >= n * 1.2) ?? SPANS.at(-1)!
}

const WEAR: Rgb = [0.75, 1, 1.5]

// decode.wgsl ~1009: what a patch gives back of its light after `dose`.
export const burnEfficiency = (depth: number, dose: number): Rgb =>
  WEAR.map(w => 1 / (1 + depth * Math.min(dose, 64) * w))

// uniforms.ts divides the rate by 60 and the pass adds it, times the light's
// luma, once a field: dose per second of static white.
export const dosePerSecond = (burnRate: number) => (burnRate / 60) * FIELD_HZ

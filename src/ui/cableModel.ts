import { rngFor } from '../core/rng'
import {
  ACTIVE_START,
  ACTIVE_TOP,
  ACTIVE_WIDTH,
  BURST_LEN,
  BURST_START,
  IRE_BLACK,
  IRE_BLANK,
  IRE_VIDEO_RANGE,
  LINES,
  SYNC_LEN,
} from '../core/signal/constants'
import { TEST_LINE } from './testLine'

const BAND_ROWS = 12
const STRIPE_ROWS = 6
const ECHO_SAMPLES = 5
const SEED = 0xca81e

export interface Cable {
  polarityFlip: number
  termination: number
  chromaPinOnly: number
  scramble: number
  scrambleMode: number
}

export interface Band {
  row: number
  rows: number
}

const inBurst = (s: number) => s >= BURST_START && s < BURST_START + BURST_LEN
const inPicture = (s: number) =>
  s >= ACTIVE_START && s < ACTIVE_START + ACTIVE_WIDTH

// An even line through channel.wgsl's cable stages, in the shader's order: the
// chroma pin, the head-end scrambler, the polarity swap, the termination. The
// echo reads the line as it was before the channel, five samples back.
export function cableLine(c: Cable, line = TEST_LINE): number[] {
  return line.map((v, s) => {
    const chroma = inBurst(s) ? v - IRE_BLANK : 0
    let out = (v - chroma) * (1 - c.chromaPinOnly) + chroma
    if (c.scramble > 0) {
      if (s < SYNC_LEN) out += (IRE_BLANK - out) * c.scramble
      if (c.scrambleMode > 1.5 && inPicture(s)) {
        const negative = 2 * IRE_BLACK + IRE_VIDEO_RANGE - out
        out += (negative - out) * c.scramble
      }
    }
    out *= 1 - 2 * c.polarityFlip
    const echo = line[Math.max(s - ECHO_SAMPLES, 0)]!
    return out * 2 ** c.termination + Math.max(c.termination, 0) * 0.6 * echo
  })
}

const bands = (chance: number, seed: number): Band[] => {
  const rand = rngFor(seed)
  const out: Band[] = []
  for (let row = 0; row < LINES; row += BAND_ROWS) {
    if (rand() < chance * 0.5) out.push({ row, rows: BAND_ROWS })
  }
  return out
}

export function contactBands(amount: number, mode: number) {
  return {
    pin: mode < 0.5 || mode > 1.5 ? bands(amount, SEED) : [],
    shield: mode > 0.5 ? bands(amount, SEED ^ 0x5eed) : [],
  }
}

export function stripeBands(degrees: number): Band[] {
  if (degrees === 0) return []
  const out: Band[] = []
  for (let row = ACTIVE_TOP; row < LINES; row += 4 * STRIPE_ROWS) {
    out.push({ row, rows: 2 * STRIPE_ROWS })
  }
  return out
}

export const GUARD_ROWS: Band = { row: 12, rows: 8 }

export const humColumn = (ire: number, points = 64): number[] =>
  Array.from(
    { length: points },
    (_, i) => ire * Math.sin((2 * Math.PI * i) / (points - 1)),
  )

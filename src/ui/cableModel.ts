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
  SAMPLES_PER_LINE,
  SYNC_LEN,
  usToSamples,
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

// The carrier scrambler's gate, from 2.44 us before the sync edge to 10.56 us
// after it. A tri-mode line is drawn at its deepest step, and a keyed SSAVI
// line suppressed and inverted.
const inCarrierGate = (s: number) =>
  s < Math.round(usToSamples(10.56)) ||
  s >= SAMPLES_PER_LINE - Math.round(usToSamples(2.44))

// The sine-wave scrambler's shape: 1 on the sync tip, 0 mid-line.
const towardTip = (s: number) =>
  0.5 + 0.5 * Math.cos((2 * Math.PI * (s - SYNC_LEN / 2)) / SAMPLES_PER_LINE)

// The carrier map is channel.wgsl's, sync -40 to white 100 onto 1 to 0.125.
const carrierScaled = (ire: number, db: number) => {
  const carrier = Math.max(1 - 0.00625 * (ire + 40), 0)
  return (1 - 10 ** (-db / 20) * carrier) / 0.00625 - 40
}

const pinned = (v: number, s: number, pin: number) => {
  const chroma = inBurst(s) ? v - IRE_BLANK : 0
  return (v - chroma) * (1 - pin) + chroma
}

// An even line through the program bus's cable stages, in the shaders' order:
// the chroma pin and the head-end scrambler in channel.wgsl, then the polarity
// swap and the termination in timebase.wgsl. The echo is the line the cable
// carries, five samples back.
export function cableLine(c: Cable, line = TEST_LINE): number[] {
  const flip = 1 - 2 * c.polarityFlip
  const carried = line.map((v, s) => {
    let out = pinned(v, s, c.chromaPinOnly)
    if (c.scramble > 0) {
      const system = Math.round(c.scrambleMode)
      if (system === 3 || system === 4) {
        if (inCarrierGate(s)) out = carrierScaled(out, 10 * c.scramble)
      } else if (system === 5) {
        out = carrierScaled(out, 6.5 * c.scramble * towardTip(s))
      } else {
        if (s < SYNC_LEN) out += (IRE_BLANK - out) * c.scramble
        if ((system === 2 || system === 6) && inPicture(s)) {
          out = 2 * IRE_BLACK + IRE_VIDEO_RANGE - out
        }
      }
    }
    return out * flip
  })
  return carried.map(
    (v, s) =>
      v * 2 ** c.termination +
      Math.max(c.termination, 0) *
        0.6 *
        (carried[Math.max(s - ECHO_SAMPLES, 0)] ?? 0),
  )
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

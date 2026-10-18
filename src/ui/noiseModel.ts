import { noiseTiltWeights } from '../core/gpu/uniforms'
import { rngFor } from '../core/rng'
import {
  FSC,
  LINES,
  SAMPLE_RATE,
  SAMPLES_PER_LINE,
} from '../core/signal/constants'

const SPL = SAMPLES_PER_LINE
const FRAME_SAMPLES = SPL * LINES
const COLOUR_HALF_WIDTH_HZ = 1.5e6
const ARC_SAMPLES = [60, 22000] as const
const MAX_ARC_ROWS = 24
const STRIKE_ROWS = [6, 32] as const
const SEED = 0x1ce4

export interface Mark {
  x0: number
  x1: number
  row: number
}

export interface Strike {
  row: number
  rows: number
}

const taps = (tilt: number): [number, number, number] => {
  const [lo, hi] = noiseTiltWeights(tilt)
  const edge = lo / Math.sqrt(6)
  return [edge - hi * Math.SQRT1_2, 2 * edge + hi * Math.SQRT1_2, edge]
}

export function floorGain(tilt: number, hz: number): number {
  const [a, b, c] = taps(tilt)
  const w = (2 * Math.PI * hz) / SAMPLE_RATE
  return Math.hypot(b + (a + c) * Math.cos(w), (a - c) * Math.sin(w))
}

export function colourBandGain(tilt: number): number {
  const points = 33
  let power = 0
  for (let i = 0; i < points; i++) {
    const hz = FSC + COLOUR_HALF_WIDTH_HZ * ((2 * i) / (points - 1) - 1)
    power += floorGain(tilt, hz) ** 2
  }
  return Math.sqrt(power / points)
}

export const colourBand = (maxHz: number): [number, number] => [
  (FSC - COLOUR_HALF_WIDTH_HZ) / maxHz,
  (FSC + COLOUR_HALF_WIDTH_HZ) / maxHz,
]

function run(start: number, length: number): Mark[] {
  const marks: Mark[] = []
  let at = start
  let left = length
  while (left > 0 && marks.length < MAX_ARC_ROWS && at < FRAME_SAMPLES) {
    const row = Math.floor(at / SPL)
    const x0 = at - row * SPL
    const span = Math.min(left, SPL - x0)
    marks.push({ row, x0: x0 / SPL, x1: (x0 + span) / SPL })
    at += span
    left -= span
  }
  return marks
}

export function ignitionMarks(hz: number): Mark[] {
  if (hz <= 0) return []
  const step = SAMPLE_RATE / hz
  const marks: Mark[] = []
  for (let t = 0; t < FRAME_SAMPLES; t += step) {
    const row = Math.floor(t / SPL)
    const x = (t - row * SPL) / SPL
    marks.push({ row, x0: x, x1: x })
  }
  return marks
}

function dimmerWeight(row: number, lock: number) {
  const phase = (2 * Math.PI * row) / LINES
  const w = (0.5 + 0.5 * Math.cos(2 * phase - 2.2)) ** 6
  return 1 + (Math.min(w * 5, 1) - 1) * Math.min(Math.max(lock, 0), 1)
}

export function arcMarks(perFrame: number, lock: number): Mark[] {
  const rand = rngFor(SEED)
  const [short, long] = ARC_SAMPLES
  const marks: Mark[] = []
  for (let i = 0; i < Math.round(perFrame); i++) {
    let row = Math.floor(rand() * LINES)
    for (let tries = 0; tries < 40; tries++) {
      if (rand() <= dimmerWeight(row, lock)) break
      row = Math.floor(rand() * LINES)
    }
    const x = rand()
    const length = Math.exp(
      Math.log(short) + (Math.log(long) - Math.log(short)) * rand(),
    )
    marks.push(...run((row + x) * SPL, length))
  }
  return marks
}

export function strikeSlab(perSecond: number): Strike | null {
  if (perSecond <= 0) return null
  const rand = rngFor(SEED ^ 0x77b)
  const [short, long] = STRIKE_ROWS
  return {
    row: Math.floor(rand() * LINES * 0.7),
    rows: short + (long - short) * rand(),
  }
}

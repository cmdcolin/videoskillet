import { rngFor } from '../core/rng'
import { IRE_SYNC, IRE_WHITE } from '../core/signal/constants'

const SEED = 0x5a0f
const DRAWS = 256
const CARRIER_PER_IRE = 0.00625
const CARRIER_OFFSET_IRE = 40
const SNOW_SIGMA = 0.28
const DETECTOR_SPAN_IRE = 160
export const SOUND_MHZ = 4.5
export const NEXT_CHANNEL_MHZ = 6

const gauss = (rand: () => number) =>
  Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-7))) *
  Math.cos(2 * Math.PI * rand())

const noise = (() => {
  const rand = rngFor(SEED)
  return Array.from(
    { length: DRAWS },
    () => [gauss(rand), gauss(rand)] as const,
  )
})()

// channel.wgsl's envelope detector at one picture level: the carrier is sync at
// full power and white at 12.5%, the IF noise adds in two quadratures, and the
// detector recovers the envelope. Returns what comes out, in IRE: the level it
// settles at and how far the grain spreads around it.
export function snowStats(level: number, snow: number) {
  const sigma = SNOW_SIGMA * snow
  const carrier = Math.max(
    1 - CARRIER_PER_IRE * (level + CARRIER_OFFSET_IRE),
    0,
  )
  let sum = 0
  let sumSquares = 0
  for (const [i, q] of noise) {
    const envelope = Math.hypot(carrier + sigma * i, sigma * q)
    const out = DETECTOR_SPAN_IRE * (1 - envelope) - CARRIER_OFFSET_IRE
    sum += out
    sumSquares += out * out
  }
  const mean = sum / DRAWS
  return {
    mean,
    rms: Math.sqrt(Math.max(sumSquares / DRAWS - mean * mean, 0)),
  }
}

export function snowByLevel(snow: number, points: number) {
  const stats = Array.from({ length: points }, (_, i) =>
    snowStats(IRE_SYNC + ((IRE_WHITE - IRE_SYNC) * i) / (points - 1), snow),
  )
  return { mean: stats.map(s => s.mean), rms: stats.map(s => s.rms) }
}

const smoothstep = (lo: number, hi: number, x: number) => {
  const t = Math.min(Math.max((x - lo) / (hi - lo), 0), 1)
  return t * t * (3 - 2 * t)
}

// A sketch of the IF filter, in MHz from the picture carrier: the Nyquist slope
// that halves the carrier, the sound trap at 4.5 MHz, and the channel's top edge.
export function ifResponse(mhz: number): number {
  const trap = 1 - 0.97 * Math.exp(-(((mhz - SOUND_MHZ) / 0.3) ** 2))
  return smoothstep(-0.75, 0.75, mhz) * trap * (1 - smoothstep(4.6, 4.9, mhz))
}

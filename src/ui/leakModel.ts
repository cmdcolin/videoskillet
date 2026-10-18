import { SAMPLE_RATE, SAMPLES_PER_LINE } from '../core/signal/constants'
import { TEST_LINE } from './testLine'

// The ghost and the sound carrier as channel.wgsl adds them to the program, on
// a line where the hum crosses zero. The audio that frequency-modulates the
// sound carrier is taken as silence, and each line repeats the one before it,
// which is what the ghost reads when its delay reaches back past the sync edge.

export interface Leak {
  ghostDelayUs: number
  ghostGain: number
  soundIre: number
}

const SPL = SAMPLES_PER_LINE

// catmull in prelude.ts.
const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  p1 +
  0.5 *
    t *
    (p2 -
      p0 +
      t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))

const ghostDelay = (l: Leak) => l.ghostDelayUs * 1e-6 * SAMPLE_RATE

// channel.wgsl's multipath ghost and 4.5 MHz sound leak.
export function channelLine(l: Leak, line = TEST_LINE): number[] {
  const at = (i: number) => line[((i % SPL) + SPL) % SPL]!
  const delay = ghostDelay(l)
  return line.map((x, s) => {
    let out = x
    if (l.ghostGain !== 0) {
      const gpos = s - delay
      const g0 = Math.floor(gpos)
      out +=
        l.ghostGain *
        catmull(at(g0 - 1), at(g0), at(g0 + 1), at(g0 + 2), gpos - g0)
    }
    if (l.soundIre > 0) {
      const ph = ((11 * s) % 35) / 35
      const vis = Math.max(1 - 0.00625 * (out + 40), 0.12) / 0.75
      out += l.soundIre * vis * Math.sin(2 * Math.PI * ph)
    }
    return out
  })
}

// The ghost as a filter: the direct path plus the gain times the four
// Catmull-Rom taps either side of the delay.
export function ghostGains(l: Leak, mhzs: readonly number[]): number[] {
  if (l.ghostGain === 0) return mhzs.map(() => 1)
  const delay = ghostDelay(l)
  const back = Math.ceil(delay)
  const t = back - delay
  const taps = [0, 1, 2, 3].map(k =>
    catmull(+(k === 0), +(k === 1), +(k === 2), +(k === 3), t),
  )
  return mhzs.map(mhz => {
    const w = (2 * Math.PI * mhz * 1e6) / SAMPLE_RATE
    let re = 1
    let im = 0
    taps.forEach((c, k) => {
      const lag = back + 1 - k
      re += l.ghostGain * c * Math.cos(w * lag)
      im -= l.ghostGain * c * Math.sin(w * lag)
    })
    return Math.hypot(re, im)
  })
}

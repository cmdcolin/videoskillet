import { lumaKernel } from '../core/gpu/filterbank'
import { rngFor } from '../core/rng'
import { SAMPLES_PER_LINE, usToSamples } from '../core/signal/constants'
import { magnitude, response } from './response'
import { TEST_LINE } from './testLine'

const SEED = 0xd20f
const HOLE_START_US = 36
const NULL_LEVEL_IRE = 55
const NULL_SPREAD_IRE = 45
const NULL_DEPTH = 0.95
const CYCLES_PER_LINE = SAMPLES_PER_LINE / 4

export const HOLE_FROM_US = HOLE_START_US

// channel.wgsl's dropout on one line. Without a compensator the gap reads as no
// carrier at all, a bright streak of hash; with one it is patched from a line
// that played earlier, which on a picture with no vertical detail is identical.
export function dropoutLine(
  lenUs: number,
  compensator: number,
  line: readonly number[] = TEST_LINE,
): number[] {
  const start = Math.round(usToSamples(HOLE_START_US))
  const end = start + Math.round(usToSamples(lenUs))
  const rand = rngFor(SEED)
  return line.map((v, s) => {
    if (s < start || s >= end || compensator > 0) return v
    const gauss =
      Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-7))) *
      Math.cos(2 * Math.PI * rand())
    return v + (NULL_LEVEL_IRE + NULL_SPREAD_IRE * gauss - v) * NULL_DEPTH
  })
}

// How far the patch's subcarrier sits from the one it replaces. A line holds
// 227.5 cycles, so one line back arrives half a cycle out; two lines back is
// 455, a whole number.
export function patchHueDegrees(compensator: number): number {
  const lines = Math.round(compensator)
  const cycles = CYCLES_PER_LINE * lines
  return Math.round(360 * (cycles - Math.floor(cycles))) % 360
}

// The luma section's gain in dB after `passes` trips through the channel, which
// is what a copy of a copy does to bandwidth: every pass multiplies the loss.
export function lumaAfterCopies(
  lumaMHz: number,
  lumaPeak: number,
  passes: number,
  points: number,
  maxMhz: number,
): number[] {
  const kernel = lumaKernel({ lumaMHz, lumaPeak })
  return Array.from({ length: points }, (_, i) => {
    const gain = magnitude(response(kernel, (maxMhz * 1e6 * i) / (points - 1)))
    return passes * 20 * Math.log10(Math.max(gain, 1e-6))
  })
}

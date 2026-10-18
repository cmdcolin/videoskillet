import { F_H } from '../core/signal/constants'

export type Rgb = readonly [number, number, number]

const TURN = 2 * Math.PI
const PHASES = [0, -2.0943951, 2.0943951] as const
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

// prelude.ts's synthWave: every shape comes back 0..1.
export function synthWave(cycles: number, shape: number): number {
  const p = cycles - Math.floor(cycles)
  if (shape < 0.5) return p
  if (shape < 1.5) return 1 - Math.abs(2 * p - 1)
  if (shape < 2.5) return 0.5 + 0.5 * Math.sin(TURN * p)
  return p < 0.5 ? 1 : 0
}

export const synthLevel = (wave: number, level: number): number =>
  clamp01(0.5 + level * (wave - 0.5))

// The colorizer's guns at one input level: three phase shifts 120 degrees
// apart, or three comparators whose thresholds the hue knob slides together.
export function colorizerTint(
  input: number,
  hueDeg: number,
  comparators: boolean,
): Rgb {
  const hue = (hueDeg * Math.PI) / 180
  const level = clamp01(input)
  if (comparators) {
    const shift = hue * (0.5 / Math.PI) - 0.25
    const gun = (threshold: number) => (level >= threshold + shift ? 1 : 0)
    return [gun(0.3), gun(0.5), gun(0.7)]
  }
  const gun = (phase: number) =>
    0.5 + 0.5 * Math.cos(Math.PI * level + hue + phase)
  return [gun(PHASES[0]), gun(PHASES[1]), gun(PHASES[2])]
}

export function colorizerOut(
  input: number,
  depth: number,
  hueDeg: number,
  comparators: boolean,
): Rgb {
  const [r, g, b] = colorizerTint(input, hueDeg, comparators)
  const grey = clamp01(input)
  const blend = (gun: number) => clamp01(grey + (gun - grey) * depth)
  return [blend(r), blend(g), blend(b)]
}

export const cyclesPerLine = (hz: number): number => hz / F_H

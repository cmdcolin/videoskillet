import {
  ACTIVE_START,
  ACTIVE_WIDTH,
  IRE_BLACK,
  IRE_WHITE,
  SAMPLE_RATE,
  SAMPLES_PER_LINE,
} from '../core/signal/constants'

import type { Controls } from '../core/controls'

// How far round the U/V plane one lap of the mixer loop turns the colour it
// hands back, read off fb_composite.wgsl's read position. The carrier lattice
// advances a quarter cycle per sample and half a cycle per frame. A return read
// d samples late therefore comes back (d + 2) quarter turns behind the lattice
// the decoder demodulates against, clockwise on a vectorscope. The stock delay
// of 0.15 µs nearly cancels the frame's half cycle, and each line of offset
// adds another half cycle. The read clock stretches the delay along the line
// and the varactor stretches it with the level, so a turn is a range.

const BUS_MID = 40
const QUARTER = 90
// Degrees of spread below which a turn reads as one angle.
export const SPREAD_MIN = 3

const turnOf = (delay: number) => -(delay + 2) * QUARTER

export interface LapTurn {
  /** Degrees counter-clockwise at the shortest delay the read lands on. */
  from: number
  /** Degrees counter-clockwise at the longest. */
  to: number
}

export function lapTurn(
  c: Pick<Controls, 'cfbDelayUs' | 'cfbLines' | 'cfbClockPct' | 'cfbServoUs'>,
): LapTurn {
  const base =
    (c.cfbDelayUs * 1e-6 * SAMPLE_RATE + c.cfbLines * SAMPLES_PER_LINE) % 4
  const clock = c.cfbClockPct * 0.01
  const servo = c.cfbServoUs * 1e-6 * SAMPLE_RATE
  const along = [ACTIVE_START, ACTIVE_START + ACTIVE_WIDTH].map(s => -s * clock)
  const level = [IRE_BLACK, IRE_WHITE].map(
    ire => (servo * (ire - BUS_MID)) / 100,
  )
  const delays = along.flatMap(a => level.map(l => base + a + l))
  const mid = turnOf((Math.min(...delays) + Math.max(...delays)) / 2)
  const shift = Math.round(mid / 360) * 360
  return {
    from: turnOf(Math.min(...delays)) - shift,
    to: turnOf(Math.max(...delays)) - shift,
  }
}

export function turnWords(turn: LapTurn) {
  const spread = turn.from - turn.to
  if (spread >= 360) return 'turns every hue'
  if (spread > SPREAD_MIN) return `fans ${Math.round(spread)}° a lap`
  return `turns ${Math.round(Math.abs(turn.from + turn.to) / 2)}° a lap`
}

import { describe, expect, it } from 'vitest'

import { HEAD_SWITCH_LINE, LINES } from '../core/signal/constants'
import {
  lineTiming,
  lost,
  rings,
  servoKick,
  SHUTTLE_STILL,
  shuttleNull,
  trackingTear,
  trackNull,
} from './tapeModel'

const STILL = { tbJitterNs: 0, tbWowNs: 0, tbStickNs: 0, headSwitchShiftUs: 0 }

describe('timebase', () => {
  it('leaves every line on time at stock', () => {
    const { field, over } = lineTiming(STILL, 30)
    expect(field.every(v => v === 0)).toBe(true)
    expect(over.every(v => v === 0)).toBe(true)
  })

  it('steps by the switch shift at the head switch and nowhere else', () => {
    const { field } = lineTiming({ ...STILL, headSwitchShiftUs: 3 }, 2)
    expect(field[HEAD_SWITCH_LINE - 1]).toBe(0)
    expect(field[HEAD_SWITCH_LINE]).toBeCloseTo(3, 4)
    expect(field[LINES - 1]).toBeCloseTo(3, 4)
  })

  it('draws the same trace twice for the same controls', () => {
    const bent = { ...STILL, tbJitterNs: 400, tbWowNs: 2000, tbStickNs: 1000 }
    expect(lineTiming(bent, 20)).toEqual(lineTiming(bent, 20))
  })

  it('wanders slowly with wow alone', () => {
    const { over } = lineTiming({ ...STILL, tbWowNs: 3000 }, 120)
    const steps = over.slice(1).map((v, i) => Math.abs(v - over[i]!))
    expect(Math.max(...over.map(Math.abs))).toBeGreaterThan(1)
    expect(Math.max(...steps)).toBeLessThan(0.5)
  })
})

describe('tracking', () => {
  it('nulls nothing on a clean deck at play', () => {
    for (let row = 0; row < LINES; row++) {
      expect(trackNull(row, 0, 0.5)).toBe(0)
      expect(shuttleNull(row, 0, SHUTTLE_STILL)).toBe(0)
    }
    expect(trackingTear({ trackAmt: 0, trackPos: 0.5, bars: 0 })).toEqual(
      Array(LINES).fill(0),
    )
  })

  it('centres the band on the band position and tapers it', () => {
    const centre = Math.round(0.4 * LINES)
    expect(trackNull(centre, 1, 0.4)).toBeCloseTo(1.3, 6)
    expect(trackNull(centre + 10, 1, 0.4)).toBeLessThan(1.3)
    expect(trackNull(centre + 21, 1, 0.4)).toBe(0)
  })

  it('puts one bar per crossing at shuttle speed', () => {
    const bars = Array.from({ length: LINES }, (_, row) =>
      shuttleNull(row, 3, SHUTTLE_STILL),
    )
    const starts = bars.filter((s, i) => s > 0 && !(bars[i - 1]! > 0)).length
    expect(starts).toBe(3)
  })

  it('caps what one null leaves at the rfNull clamp', () => {
    expect(lost(0)).toBe(0)
    expect(lost(2)).toBeCloseTo(0.95, 6)
    expect(lost(0.5, 0.5)).toBeCloseTo(0.75, 6)
  })
})

describe('servo', () => {
  const servo = { trackPos: 0.85, trackAmt: 0, trackKick: 1 }

  it('holds the band where the hand put it with hunt off', () => {
    expect(servoKick({ ...servo, trackHunt: 0 }, 60).every(e => e === 0)).toBe(
      true,
    )
  })

  it('settles after a kick when tight and rings when loose', () => {
    const tight = servoKick({ ...servo, trackHunt: 0.2 }, 180)
    const loose = servoKick({ ...servo, trackHunt: 1 }, 180)
    expect(Math.max(...tight.map(Math.abs))).toBeGreaterThan(10)
    expect(rings(tight)).toBe(false)
    expect(rings(loose)).toBe(true)
  })
})

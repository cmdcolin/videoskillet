import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { SAMPLE_RATE } from '../core/signal/constants'
import { lapTurn } from './lapTurn'

const at = (over: Partial<typeof DEFAULT_CONTROLS>) =>
  lapTurn({ ...DEFAULT_CONTROLS, ...over })
const sampleUs = 1e6 / SAMPLE_RATE

describe('hue turn per lap of the mixer loop', () => {
  it('comes back half a cycle out with no delay, from the frame alone', () => {
    const t = at({ cfbDelayUs: 0 })
    expect(Math.abs(t.from)).toBeCloseTo(180, 6)
    expect(t.to).toBe(t.from)
  })

  it('turns the stock loop about 13° clockwise', () => {
    expect(at({}).from).toBeCloseTo(-13.3, 1)
  })

  it('turns a quarter cycle clockwise per sample of delay', () => {
    const a = at({ cfbDelayUs: 2 * sampleUs }).from
    const b = at({ cfbDelayUs: 2.5 * sampleUs }).from
    expect(a).toBeCloseTo(0, 6)
    expect(b).toBeCloseTo(-45, 6)
  })

  it('adds half a cycle per line of offset', () => {
    const t = at({ cfbDelayUs: 2 * sampleUs, cfbLines: 1 })
    expect(Math.abs(t.from)).toBeCloseTo(180, 6)
  })

  it('fans along the line with the read clock off', () => {
    const t = at({ cfbDelayUs: 2 * sampleUs, cfbClockPct: 0.1 })
    expect(t.from - t.to).toBeCloseTo(754 * 0.001 * 90, 6)
  })

  it('fans with the level when the varactor pulls', () => {
    const servoUs = sampleUs
    const t = at({ cfbDelayUs: 2 * sampleUs, cfbServoUs: servoUs })
    expect(t.from - t.to).toBeCloseTo(0.925 * 90, 6)
  })
})

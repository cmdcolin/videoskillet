import { describe, expect, it } from 'vitest'

import { F_H, SAMPLE_RATE, SAMPLES_PER_LINE } from '../core/signal/constants'
import {
  ablDrive,
  beamIre,
  cardLoads,
  frameShifts,
  hLocks,
  hRateOf,
  leftEdges,
  lineShifts,
  vLocks,
  vRateOf,
} from './scanModel'

const STOCK_HOLD = {
  hHold: 0.35,
  hDetuneHz: 0,
  syncBendUs: 0,
  vHold: 1,
  vFreqHz: 60,
}

describe('deflection', () => {
  const stock = {
    bendUs: 0,
    bendShape: 0,
    bendPeriod: 60,
    hvSagUs: 0,
    hvRing: 0.5,
    abl: 0,
  }

  it('leaves every line where it belongs at stock', () => {
    expect(leftEdges(stock).every(v => v === 0)).toBe(true)
  })

  it('pulls the white bar and its black surround apart', () => {
    const edges = leftEdges({ ...stock, hvSagUs: 25, hvRing: 0 })
    expect(edges[240]).toBeLessThan(-20)
    expect(edges[60]).toBeGreaterThan(15)
  })

  it('settles the limiter on the ceiling over the beam it senses', () => {
    const beam = beamIre(cardLoads('white'))
    const drive = ablDrive(0.5, beam, 240)
    expect(drive.at(-1)).toBeCloseTo(56.5 / beam, 2)
    expect(ablDrive(0, beam, 10).every(g => g === 1)).toBe(true)
  })
})

describe('sync', () => {
  it('pulls in the horizontal oscillator up to 40 samples a line', () => {
    const edgeHz = (hold: number) => {
      const rate = (hold * 40) / SAMPLES_PER_LINE
      return F_H / (1 - rate) - F_H
    }
    const at = edgeHz(0.35)
    expect(hLocks({ ...STOCK_HOLD, hDetuneHz: at * 0.99 })).toBe(true)
    expect(hLocks({ ...STOCK_HOLD, hDetuneHz: at * 1.01 })).toBe(false)
  })

  it('holds a detune inside the range as a steady shift', () => {
    const h = { ...STOCK_HOLD, hDetuneHz: 100 }
    const shifts = lineShifts(h)
    const pll = ((1 - h.hHold) * hRateOf(h.hDetuneHz)) / h.hHold
    const us = (-pll / SAMPLE_RATE) * 1e6
    expect(shifts[0]).toBeCloseTo(us, 6)
    expect(shifts[479]).toBeCloseTo(us, 6)
  })

  it('settles a vertical detune inside the range and rolls one past it', () => {
    const locked = { ...STOCK_HOLD, vFreqHz: 59 }
    expect(vLocks(locked)).toBe(true)
    expect(frameShifts(locked, 60).at(-1)).toBeCloseTo(
      (0.65 * vRateOf(59)) / 0.35,
      3,
    )
    const loose = { ...locked, vHold: 0.1 }
    expect(vLocks(loose)).toBe(false)
    const roll = frameShifts(loose, 3)
    expect(roll[2]! - roll[1]!).toBeCloseTo(vRateOf(59) - 3, 3)
  })
})

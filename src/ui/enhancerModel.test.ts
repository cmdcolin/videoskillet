import { describe, expect, it } from 'vitest'

import {
  ACTIVE_START,
  BURST_LEN,
  BURST_START,
  IRE_BLACK,
  IRE_SYNC,
  usToSamples,
} from '../core/signal/constants'
import {
  enhancedLine,
  gateSample,
  howls,
  peakingGains,
  type Enhancer,
} from './enhancerModel'
import { BAR_US, TEST_LINE } from './testLine'

const stock: Enhancer = {
  clampUs: 0,
  droopUs: 0,
  peakMHz: 0,
  peakQ: 0.5,
  peakBoost: 0,
  sync: 0,
  sliceIre: -20,
}

const barStart = Math.round(usToSamples(BAR_US[0]))
const barEnd = Math.round(usToSamples(BAR_US[1]))

describe('bent enhancer', () => {
  it('passes the line untouched at stock', () => {
    expect(enhancedLine(stock)).toEqual(TEST_LINE)
    expect(peakingGains(stock, [0, 2, 5]).every(g => g === 1)).toBe(true)
  })

  it('keys the clamp on the back porch at stock', () => {
    const key = gateSample(stock)
    expect(key).toBeGreaterThanOrEqual(BURST_START + BURST_LEN)
    expect(key).toBeLessThan(ACTIVE_START)
  })

  it('pins the white bar to blanking with the gate slid into it', () => {
    const out = enhancedLine({ ...stock, clampUs: 17 })
    expect(gateSample({ ...stock, clampUs: 17 })).toBeGreaterThan(barStart)
    expect(out[barStart + 5]).toBeCloseTo(0, 6)
    expect(out[barEnd + 50]).toBeCloseTo(IRE_BLACK - 100, 6)
  })

  it('sags the bar back toward blanking with a short coupling cap', () => {
    const out = enhancedLine({ ...stock, droopUs: 10 })
    expect(out[barEnd - 1]!).toBeLessThan(out[barStart]! - 30)
    expect(out[barEnd + 5]!).toBeLessThan(IRE_BLACK - 20)
  })

  it('peaks near the detail frequency and stays bounded under unity regen', () => {
    const e = { ...stock, peakMHz: 1.5, peakBoost: 2 }
    const [low, at, high] = peakingGains(e, [0.2, 1.5, 5])
    expect(at!).toBeGreaterThan(2)
    expect(at!).toBeGreaterThan(low!)
    expect(at!).toBeGreaterThan(high!)
    expect(howls(e)).toBe(false)
    expect(Math.max(...enhancedLine(e))).toBeLessThan(250)
  })

  it('howls into the rails from a regen of 0.75', () => {
    const e = { ...stock, peakMHz: 2, peakQ: 0.8, peakBoost: 2 }
    expect(howls(e)).toBe(true)
    expect(howls({ ...e, peakQ: 0.74 })).toBe(false)
    const swing = enhancedLine(e).map((y, s) => y - TEST_LINE[s]!)
    expect(Math.max(...swing)).toBeCloseTo(240, 0)
  })

  it('stamps only the real tip at the stock slice', () => {
    const out = enhancedLine({ ...stock, sync: 1 })
    expect(out[0]).toBe(IRE_SYNC)
    expect(out.slice(ACTIVE_START).includes(IRE_SYNC)).toBe(false)
  })

  it('mints pulses in black picture with the slice above it', () => {
    const out = enhancedLine({ ...stock, sync: 1, sliceIre: 10 })
    expect(out.slice(ACTIVE_START, barStart).includes(IRE_SYNC)).toBe(true)
  })
})

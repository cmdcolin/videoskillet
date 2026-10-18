import { describe, expect, it } from 'vitest'

import { ifResponse, snowByLevel, snowStats } from './rfModel'

describe('snowStats', () => {
  it('passes the level untouched with no snow', () => {
    const { mean, rms } = snowStats(50, 0)
    expect(mean).toBeCloseTo(50)
    expect(rms).toBe(0)
  })

  it('sinks the whites further than the sync tips', () => {
    const white = 100 - snowStats(100, 1).mean
    const sync = snowStats(-40, 1).mean + 40
    expect(white).toBeGreaterThan(30)
    expect(Math.abs(sync)).toBeLessThan(white)
  })

  it('grows the grain with the snow knob', () => {
    expect(snowStats(50, 1).rms).toBeGreaterThan(snowStats(50, 0.3).rms)
  })
})

describe('snowByLevel', () => {
  it('runs from the sync tip to white', () => {
    const { mean, rms } = snowByLevel(0.5, 29)
    expect(mean).toHaveLength(29)
    expect(rms).toHaveLength(29)
    expect(mean.at(-1)).toBeGreaterThan(mean[0]!)
  })
})

describe('ifResponse', () => {
  it('halves the carrier on the Nyquist slope and passes the video band', () => {
    expect(ifResponse(0)).toBeCloseTo(0.5, 1)
    expect(ifResponse(2)).toBeCloseTo(1, 1)
  })

  it('notches the sound carrier and cuts off above the channel', () => {
    expect(ifResponse(4.5)).toBeLessThan(0.05)
    expect(ifResponse(6)).toBe(0)
    expect(ifResponse(-2)).toBe(0)
  })
})

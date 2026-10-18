import { describe, expect, it } from 'vitest'

import { FSC } from '../core/signal/constants'
import { lapGain, peakLapGain, type MixerLoop } from './loopGain'

const flat: MixerLoop = {
  mix: 0.6,
  gain: 1.3,
  split: 0,
  filterMHz: 0,
  filterQ: 0.5,
  filterBoost: 2,
}

describe('mixer loop gain per lap', () => {
  it('is the fader times the trim across the band with the filter off', () => {
    for (const mhz of [0, 1, 3.58, 5.5]) {
      expect(lapGain(flat, mhz)).toBeCloseTo(0.78, 6)
    }
    expect(peakLapGain(flat).gain).toBeCloseTo(0.78, 6)
  })

  it('reads the trim by magnitude', () => {
    expect(lapGain({ ...flat, gain: -1.3 }, 2)).toBeCloseTo(0.78, 6)
  })

  it('adds the boost at the resonance centre', () => {
    const ringing = { ...flat, filterMHz: 2, filterBoost: 0.8 }
    expect(lapGain(ringing, 2)).toBeCloseTo(0.78 * 1.8, 6)
    const peak = peakLapGain(ringing)
    expect(peak.gain).toBeCloseTo(0.78 * 1.8, 2)
    expect(peak.mhz).toBeCloseTo(2, 1)
  })

  it('sends only chroma round on a chroma return, and only luma on a luma one', () => {
    const chroma = { ...flat, split: 1 }
    expect(lapGain(chroma, 0)).toBeCloseTo(0, 6)
    expect(lapGain(chroma, FSC / 1e6)).toBeCloseTo(0.78, 6)
    const luma = { ...flat, split: 2 }
    expect(lapGain(luma, 0)).toBeCloseTo(0.78, 6)
    expect(lapGain(luma, FSC / 1e6)).toBeCloseTo(0, 6)
  })

  it('is zero with the fader down', () => {
    expect(peakLapGain({ ...flat, mix: 0, filterMHz: 2 }).gain).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'

import { FSC, SAMPLE_RATE } from '../core/signal/constants'
import { bandpass, lowpass, TAPS } from '../core/signal/filters'
import { magnitude, response } from './response'

describe('response', () => {
  it('passes DC through a unity lowpass with no phase', () => {
    const [re, im] = response(lowpass(3e6, TAPS.luma), 0)
    expect(re).toBeCloseTo(1, 6)
    expect(im).toBeCloseTo(0, 6)
  })

  it('reads a symmetric kernel as real at every frequency', () => {
    const h = lowpass(2e6, TAPS.luma)
    for (const hz of [0.5e6, 2e6, 4e6])
      expect(response(h, hz)[1]).toBeCloseTo(0, 6)
  })

  it('reaches unity at the centre of a bandpass', () => {
    expect(
      magnitude(response(bandpass(FSC, 0.6e6, TAPS.chromaBp), FSC)),
    ).toBeCloseTo(1, 2)
  })

  it('turns a tap one past centre into a one-sample advance', () => {
    const hz = 1e6
    const w = (2 * Math.PI * hz) / SAMPLE_RATE
    const [re, im] = response(Float32Array.from([0, 0, 1]), hz)
    expect(re).toBeCloseTo(Math.cos(w), 6)
    expect(im).toBeCloseTo(Math.sin(w), 6)
  })
})

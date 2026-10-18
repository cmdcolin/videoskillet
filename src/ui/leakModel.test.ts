import { describe, expect, it } from 'vitest'

import {
  IRE_BLACK,
  IRE_WHITE,
  SAMPLE_RATE,
  usToSamples,
} from '../core/signal/constants'
import { channelLine, ghostGains, type Leak } from './leakModel'
import { BAR_US, TEST_LINE } from './testLine'

const stock: Leak = { ghostDelayUs: 0, ghostGain: 0, soundIre: 0 }
const samplesUs = (n: number) => (n / SAMPLE_RATE) * 1e6
const barStart = Math.round(usToSamples(BAR_US[0]))

describe('ghosting and leakage', () => {
  it('passes the line untouched at stock', () => {
    expect(channelLine(stock)).toEqual(TEST_LINE)
  })

  it('lands the echo the delay later at the gain, inverted when negative', () => {
    const delay = 40
    for (const ghostGain of [0.3, -0.4]) {
      const out = channelLine({
        ...stock,
        ghostDelayUs: samplesUs(delay),
        ghostGain,
      })
      const edge = out[barStart + delay + 5]! - out[barStart + delay - 5]!
      expect(edge).toBeCloseTo((IRE_WHITE - IRE_BLACK) * ghostGain, 3)
    }
  })

  it('reads the line before for an echo reaching back past the sync edge', () => {
    const delay = TEST_LINE.length - 10
    const out = channelLine({
      ...stock,
      ghostDelayUs: samplesUs(delay),
      ghostGain: 0.5,
    })
    expect(out[200]! - TEST_LINE[200]!).toBeCloseTo(0.5 * TEST_LINE[210]!, 3)
  })

  it('combs the band between one plus and one minus the gain', () => {
    const [dc, notch] = ghostGains(
      { ...stock, ghostDelayUs: 2, ghostGain: 0.4 },
      [0, 0.25],
    )
    expect(dc).toBeCloseTo(1.4, 6)
    expect(notch).toBeCloseTo(0.6, 4)
  })

  it('weaves the sound carrier deepest in the dark', () => {
    const out = channelLine({ ...stock, soundIre: 10 })
    const depth = (from: number) =>
      Math.max(
        ...out
          .slice(from, from + 35)
          .map((y, i) => Math.abs(y - TEST_LINE[from + i]!)),
      )
    expect(depth(barStart + 20)).toBeLessThan(depth(barStart - 200) / 4)
  })
})

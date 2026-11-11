import { describe, expect, it } from 'vitest'

import { SAMPLE_RATE } from './constants'
import {
  SERIES_CAP_FLOOR_MHZ,
  SERIES_CAP_REACH,
  seriesCapHold,
} from './seriescap'

describe('seriesCapHold', () => {
  it('is a wire at zero', () => {
    expect(seriesCapHold(0)).toBe(0)
  })

  it('loses 1/e of its charge in one time constant', () => {
    const cornerMHz = 0.5
    const tauSamples = SAMPLE_RATE / (2 * Math.PI * cornerMHz * 1e6)
    expect(seriesCapHold(cornerMHz) ** tauSamples).toBeCloseTo(1 / Math.E)
  })

  it('holds less from sample to sample as the corner rises', () => {
    expect(seriesCapHold(3)).toBeLessThan(seriesCapHold(1))
  })

  it('stops at the corner whose charge the feed can still sum', () => {
    expect(seriesCapHold(0.01)).toBe(seriesCapHold(SERIES_CAP_FLOOR_MHZ))
    expect(
      seriesCapHold(SERIES_CAP_FLOOR_MHZ) ** SERIES_CAP_REACH,
    ).toBeLessThan(0.02)
  })
})

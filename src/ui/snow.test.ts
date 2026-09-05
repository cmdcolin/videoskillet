import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { faultDepth } from '../core/signal/fault'
import {
  SNOW_MAX_SECONDS,
  SNOW_MIN_SECONDS,
  SNOW_SECONDS,
  snowPlan,
  snowSeconds,
} from './snow'

describe('snowSeconds', () => {
  it('reads the flag alone, and anything unreadable, as the default', () => {
    expect(snowSeconds('')).toBe(SNOW_SECONDS)
    expect(snowSeconds('yes')).toBe(SNOW_SECONDS)
  })

  it('holds a hand-written duration inside the bounds', () => {
    expect(snowSeconds('3')).toBe(3)
    expect(snowSeconds('1e9')).toBe(SNOW_MAX_SECONDS)
    expect(snowSeconds('-4')).toBe(SNOW_MIN_SECONDS)
  })
})

describe('snowPlan', () => {
  it('opens at full depth and only heals', () => {
    const plan = snowPlan(DEFAULT_CONTROLS, SNOW_SECONDS)
    expect(faultDepth(0, plan.frames, 0)).toBe(1)
    expect(faultDepth(plan.frames - 1, plan.frames, 0)).toBe(0)
    expect(plan.cut).toBe(0)
  })

  it('never cleans a board that is already noisier than the burst', () => {
    const loud = { ...DEFAULT_CONTROLS, noiseIre: 120 }
    expect(snowPlan(loud, SNOW_SECONDS).peak.noiseIre).toBe(120)
    expect(
      snowPlan(DEFAULT_CONTROLS, SNOW_SECONDS).peak.noiseIre,
    ).toBeGreaterThan(0)
  })

  it('counts its span in frames at the sim rate', () => {
    expect(snowPlan(DEFAULT_CONTROLS, 2).frames).toBe(120)
    expect(snowPlan(DEFAULT_CONTROLS, 1e9).frames).toBe(SNOW_MAX_SECONDS * 60)
  })
})

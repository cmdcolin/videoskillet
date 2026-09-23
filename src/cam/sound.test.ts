import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { sounded } from './sound'

describe('sounded', () => {
  it('hangs the kick on the supply of a look that leaves it alone', () => {
    const c = sounded(DEFAULT_CONTROLS)
    expect(c.audioSagUs).toBeGreaterThan(0)
    expect(c.hvRing).toBeGreaterThan(0)
  })

  it('keeps a look that works the supply harder', () => {
    const hard = { ...DEFAULT_CONTROLS, audioSagUs: 40, hvRing: 0.9 }
    expect(sounded(hard)).toEqual(hard)
  })

  it('touches nothing but the supply', () => {
    const c = sounded(DEFAULT_CONTROLS)
    for (const key of Object.keys(c) as (keyof typeof c)[]) {
      if (key !== 'audioSagUs' && key !== 'hvRing')
        expect(c[key], key).toBe(DEFAULT_CONTROLS[key])
    }
  })
})

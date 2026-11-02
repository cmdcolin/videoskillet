import { describe, expect, test } from 'vitest'

import { checkControls } from './controls'

const ranges = new Map([
  ['bGain', { min: 0, max: 1 }],
  ['frameLock', { min: 0, max: 4 }],
] as const)

describe('checkControls', () => {
  test('writes an in-range value as given', () => {
    const { values, write } = checkControls({ bGain: 0.5 }, ranges)
    expect(values).toEqual({ bGain: 0.5 })
    expect(write).toEqual({
      applied: ['bGain'],
      clamped: [],
      rejected: [],
      unknown: [],
    })
  })

  test('clamps to the range and reports it', () => {
    const { values, write } = checkControls({ frameLock: -1 }, ranges)
    expect(values).toEqual({ frameLock: 0 })
    expect(write.applied).toEqual(['frameLock'])
    expect(write.clamped).toEqual(['frameLock'])
  })

  test('rejects non-finite and non-number values', () => {
    const { values, write } = checkControls(
      { frameLock: NaN, bGain: Infinity, noiseIre: '3' },
      ranges,
    )
    expect(values).toEqual({})
    expect(write.rejected).toEqual(['frameLock', 'bGain', 'noiseIre'])
  })

  test('reports unknown keys, including inherited property names', () => {
    const { values, write } = checkControls(
      { fluxCapacitor: 1, toString: 1, bGain: 1 },
      ranges,
    )
    expect(values).toEqual({ bGain: 1 })
    expect(write.unknown).toEqual(['fluxCapacitor', 'toString'])
  })

  test('writes a key with no range unclamped', () => {
    const { values, write } = checkControls({ noiseIre: 999 }, ranges)
    expect(values).toEqual({ noiseIre: 999 })
    expect(write.clamped).toEqual([])
  })
})

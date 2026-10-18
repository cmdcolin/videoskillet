import { describe, expect, it } from 'vitest'

import { IRE_WHITE } from '../core/signal/constants'
import { dropoutLine, lumaAfterCopies, patchHueDegrees } from './dubModel'
import { TEST_LINE } from './testLine'

describe('dropoutLine', () => {
  it('lifts the gap into a bright streak with no compensator', () => {
    const line = dropoutLine(10, 0)
    const gap = line.slice(520, 600)
    expect(gap.some((v, i) => v !== TEST_LINE[520 + i])).toBe(true)
    expect(gap.reduce((a, b) => a + b, 0) / gap.length).toBeGreaterThan(30)
  })

  it('leaves the rest of the line alone', () => {
    const line = dropoutLine(10, 0)
    expect(line[10]).toBe(TEST_LINE[10])
    expect(line[900]).toBe(TEST_LINE[900])
  })

  it('patches the gap invisibly with a compensator', () => {
    expect(dropoutLine(10, 1)).toEqual([...TEST_LINE])
  })

  it('keeps the white bar a white bar', () => {
    expect(dropoutLine(10, 2)[400]).toBe(IRE_WHITE)
  })
})

describe('patchHueDegrees', () => {
  it('arrives half a cycle out one line back and in phase two lines back', () => {
    expect(patchHueDegrees(1)).toBe(180)
    expect(patchHueDegrees(2)).toBe(0)
  })
})

describe('lumaAfterCopies', () => {
  it('multiplies the loss at every frequency by the number of passes', () => {
    const one = lumaAfterCopies(3, 0, 1, 25, 6)
    const four = lumaAfterCopies(3, 0, 4, 25, 6)
    expect(four[18]!).toBeCloseTo(4 * one[18]!, 5)
    expect(four[18]!).toBeLessThan(one[18]!)
  })

  it('holds 0 dB at DC', () => {
    expect(lumaAfterCopies(3, 0, 4, 25, 6)[0]).toBeCloseTo(0, 1)
  })
})

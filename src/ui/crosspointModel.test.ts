import { describe, expect, it } from 'vitest'

import { LINES } from '../core/signal/constants'
import { cutRows, driftAcrossFrame, lostRows } from './crosspointModel'

describe('driftAcrossFrame', () => {
  it('runs from the full reach at the top to its opposite at the bottom', () => {
    const line = driftAcrossFrame(8, 5)
    expect(line[0]).toBe(8)
    expect(line[2]).toBe(0)
    expect(line[4]).toBe(-8)
  })
})

describe('lostRows', () => {
  it('loses no rows while the capture range holds the whole swing', () => {
    expect(lostRows(4, 5)).toEqual([])
  })

  it('loses a band at each end once the swing passes the range', () => {
    const [top, bottom] = lostRows(8, 4)
    expect(top!.row).toBe(0)
    expect(bottom!.row + bottom!.rows).toBe(LINES)
    expect(top!.rows).toBeCloseTo(LINES / 4, -1)
  })

  it('loses the whole frame with no capture range at full wander', () => {
    const rows = lostRows(8, 0.1)
    expect(rows.reduce((sum, b) => sum + b.rows, 0)).toBeGreaterThan(LINES - 20)
  })
})

describe('cutRows', () => {
  it('counts the cut back from the bottom of the frame', () => {
    expect(cutRows(0)).toEqual([])
    const [band] = cutRows(0.25)
    expect(band!.row + band!.rows).toBe(LINES)
    expect(band!.rows).toBeCloseTo(LINES / 4)
  })
})

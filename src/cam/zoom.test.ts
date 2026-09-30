import { describe, expect, it } from 'vitest'

import {
  CROP_MAX,
  stopAt,
  zoomLabel,
  zoomSpan,
  zoomSplit,
  zoomStops,
} from './zoom'

const ULTRAWIDE = { min: 0.5, max: 10 }
const SHORT = { min: 1, max: 2 }

describe('the zoom', () => {
  it('crops from 1× where the lens reports no zoom', () => {
    expect(zoomSpan(null)).toEqual({ min: 1, max: CROP_MAX })
    expect(zoomSplit(3, null)).toEqual({ lens: 1, crop: 3 })
    expect(zoomStops(null)).toEqual([1, 2])
  })

  it('reaches the ultrawide through the lens', () => {
    expect(zoomSpan(ULTRAWIDE)).toEqual(ULTRAWIDE)
    expect(zoomSplit(0.5, ULTRAWIDE)).toEqual({ lens: 0.5, crop: 1 })
    expect(zoomStops(ULTRAWIDE)).toEqual([0.5, 1, 2])
  })

  // A crop throws samples away, so it waits until the lens has none left.
  it('crops only past the lens', () => {
    expect(zoomSplit(2, SHORT)).toEqual({ lens: 2, crop: 1 })
    expect(zoomSplit(3, SHORT)).toEqual({ lens: 2, crop: 1.5 })
    expect(zoomSpan(SHORT).max).toBe(CROP_MAX)
  })

  it('lights the longest stop a zoom has reached', () => {
    expect(stopAt(0.5, [0.5, 1, 2])).toBe(0.5)
    expect(stopAt(0.8, [0.5, 1, 2])).toBe(0.5)
    expect(stopAt(1.4, [0.5, 1, 2])).toBe(1)
    expect(stopAt(3, [1, 2])).toBe(2)
  })

  it('names a zoom to a tenth', () => {
    expect(zoomLabel(1)).toBe('1')
    expect(zoomLabel(0.5)).toBe('0.5')
    expect(zoomLabel(1.4321)).toBe('1.4')
  })
})

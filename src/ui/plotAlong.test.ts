import { describe, expect, it } from 'vitest'

import { alongPicture, alongRange } from './plotAlong'

describe('plot readings', () => {
  it('names a place on an axis in its own unit', () => {
    expect(alongRange(0, 52.6, 'µs')(0.5)).toBe('26.3 µs')
    expect(alongRange(0, 6, 'MHz')(1)).toBe('6 MHz')
    expect(alongRange(-2, 2, '×')(0.75)).toBe('1×')
  })

  it('names a place down the picture as a percentage', () => {
    expect(alongPicture(0.6)).toBe('60% down')
  })
})

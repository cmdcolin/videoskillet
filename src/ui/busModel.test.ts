import { describe, expect, it } from 'vitest'

import { clipBus, overloaded, sumBus, whiteAtFader, type Bus } from './busModel'

const STOCK: Bus = {
  aGain: 1,
  bGain: 0,
  bRing: 0,
  busClip: 0,
  genlock: false,
}

describe('clipBus', () => {
  it('passes the sum untouched with plenty of headroom', () => {
    expect(clipBus(300, 0)).toBe(300)
  })

  it('compresses toward the rail without passing it', () => {
    const out = clipBus(400, 1)
    expect(out).toBeGreaterThan(105)
    expect(out).toBeLessThan(135)
  })

  it('leaves levels under the rail alone', () => {
    expect(clipBus(50, 1)).toBe(50)
  })
})

describe('sumBus', () => {
  it('adds the two pictures at their gains', () => {
    expect(sumBus(100, 100, { ...STOCK, bGain: 1 })).toBe(200)
  })

  it('cancels A against B when A is inverted', () => {
    expect(sumBus(50, 50, { ...STOCK, aGain: -1, bGain: 1 })).toBe(0)
  })

  it('multiplies with the ring mod', () => {
    expect(sumBus(100, 100, { ...STOCK, aGain: 0, bRing: 1 })).toBe(100)
  })
})

describe('whiteAtFader', () => {
  it('holds white flat in a clean dissolve', () => {
    const line = whiteAtFader({ ...STOCK, genlock: true }, 7, 3)
    expect(new Set(line)).toEqual(new Set([100]))
  })

  it('climbs with B in the dirty sum', () => {
    const line = whiteAtFader(STOCK, 7, 3)
    expect(line[6]).toBe(400)
    expect(line[3]).toBe(100)
  })
})

describe('overloaded', () => {
  it('is false at stock and true with both whites against the rail', () => {
    expect(overloaded(STOCK)).toBe(false)
    expect(overloaded({ ...STOCK, bGain: 1, busClip: 1 })).toBe(true)
  })
})

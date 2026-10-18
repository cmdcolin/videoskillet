import { describe, expect, it } from 'vitest'

import { IRE_BLANK, IRE_SYNC, IRE_WHITE } from '../core/signal/constants'
import { cableLine, contactBands, stripeBands, type Cable } from './cableModel'

const STOCK: Cable = {
  polarityFlip: 0,
  termination: 0,
  chromaPinOnly: 0,
  scramble: 0,
  scrambleMode: 0,
}
const SYNC = 10
const BAR = 400
const PORCH = 900

describe('cableLine', () => {
  it('leaves the line alone at stock', () => {
    const line = cableLine(STOCK)
    expect(line[SYNC]).toBe(IRE_SYNC)
    expect(line[BAR]).toBe(IRE_WHITE)
  })

  it('negates the whole line, sync included, on a hard polarity flip', () => {
    const line = cableLine({ ...STOCK, polarityFlip: 1 })
    expect(line[SYNC]).toBe(-IRE_SYNC)
    expect(line[BAR]).toBe(-IRE_WHITE)
  })

  it('halves the line when double-terminated', () => {
    const line = cableLine({ ...STOCK, termination: -1 })
    expect(line[BAR]).toBeCloseTo(IRE_WHITE / 2)
  })

  it('runs an open line hot and echoes each edge', () => {
    const line = cableLine({ ...STOCK, termination: 1 })
    expect(line[BAR + 20]).toBeGreaterThan(IRE_WHITE * 1.9)
    expect(line[PORCH]).toBe(IRE_BLANK)
  })

  it('lifts the sync tip toward blanking with the scrambler', () => {
    const line = cableLine({ ...STOCK, scramble: 1 })
    expect(line[SYNC]).toBe(IRE_BLANK)
    expect(line[BAR]).toBe(IRE_WHITE)
  })

  it('inverts the picture under SSAVI', () => {
    const line = cableLine({ ...STOCK, scramble: 1, scrambleMode: 2 })
    expect(line[BAR]).toBeLessThan(IRE_WHITE / 2)
  })

  it('keeps only the burst on the chroma pin', () => {
    const line = cableLine({ ...STOCK, chromaPinOnly: 1 })
    expect(line[SYNC]).toBe(0)
    expect(line[BAR]).toBe(0)
    expect(line.some(v => v !== 0)).toBe(true)
  })
})

describe('contactBands', () => {
  it('breaks the pin and not the shield in pin mode', () => {
    const { pin, shield } = contactBands(1, 0)
    expect(pin.length).toBeGreaterThan(0)
    expect(shield).toEqual([])
  })

  it('breaks both contacts independently in both mode', () => {
    const { pin, shield } = contactBands(1, 2)
    expect(pin.length).toBeGreaterThan(0)
    expect(shield.length).toBeGreaterThan(0)
    expect(pin).not.toEqual(shield)
  })

  it('draws no bands with a good plug', () => {
    expect(contactBands(0, 2)).toEqual({ pin: [], shield: [] })
  })
})

describe('stripeBands', () => {
  it('draws nothing at zero degrees', () => {
    expect(stripeBands(0)).toEqual([])
  })

  it('poisons two bands of every four', () => {
    const [first, second] = stripeBands(90)
    expect(first!.rows).toBe(12)
    expect(second!.row - first!.row).toBe(24)
  })
})

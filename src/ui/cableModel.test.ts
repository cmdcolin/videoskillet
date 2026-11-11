import { describe, expect, it } from 'vitest'

import {
  ACTIVE_START,
  BURST_LEN,
  BURST_START,
  IRE_BLANK,
  IRE_SYNC,
  IRE_WHITE,
  SYNC_LEN,
  usToSamples,
} from '../core/signal/constants'
import {
  cableLine,
  contactBands,
  humColumn,
  stripeBands,
  type Cable,
} from './cableModel'
import { BAR_US } from './testLine'

const STOCK: Cable = {
  polarityFlip: 0,
  termination: 0,
  chromaPinOnly: 0,
  seriesCapMHz: 0,
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

  it('inverts the whole picture under SSAVI at any depth', () => {
    const half = cableLine({ ...STOCK, scramble: 0.5, scrambleMode: 2 })
    const full = cableLine({ ...STOCK, scramble: 1, scrambleMode: 2 })
    expect(half[BAR]).toBe(full[BAR])
  })

  it('lifts the blanking interval above picture black on the carrier system', () => {
    const line = cableLine({ ...STOCK, scramble: 0.6, scrambleMode: 3 })
    expect(line[SYNC]).toBeCloseTo(40, 0)
    expect(line[PORCH]).toBeCloseTo(60, 0)
    expect(line[BAR]).toBe(IRE_WHITE)
  })

  it('runs the carrier gate a microsecond into the picture', () => {
    const stock = cableLine(STOCK)
    const line = cableLine({ ...STOCK, scramble: 1, scrambleMode: 3 })
    expect(line[ACTIVE_START + 10]).not.toBe(stock[ACTIVE_START + 10])
    expect(line[ACTIVE_START + 30]).toBe(stock[ACTIVE_START + 30])
  })

  it('lifts the tip and leaves mid-line alone on the sine system', () => {
    const line = cableLine({ ...STOCK, scramble: 1, scrambleMode: 5 })
    expect(line[SYNC]).toBeGreaterThan(IRE_BLANK)
    expect(line[455]).toBeCloseTo(cableLine(STOCK)[455]!, 0)
  })

  it('keeps only the burst on the chroma pin', () => {
    const line = cableLine({ ...STOCK, chromaPinOnly: 1 })
    expect(line[SYNC]).toBe(0)
    expect(line[BAR]).toBe(0)
    expect(line.some(v => v !== 0)).toBe(true)
  })

  it('keeps the sync and the bar and drops the burst on the luma pin', () => {
    const line = cableLine({ ...STOCK, chromaPinOnly: -1 })
    expect(line[SYNC]).toBe(IRE_SYNC)
    expect(line[BAR]).toBe(IRE_WHITE)
    expect(line.slice(BURST_START, BURST_START + BURST_LEN)).toEqual(
      Array.from({ length: BURST_LEN }, () => IRE_BLANK),
    )
  })

  it('passes the edges of sync and of the bar through a series capacitor', () => {
    const line = cableLine({ ...STOCK, seriesCapMHz: 1 })
    const bar = Math.round(usToSamples(BAR_US[0]))
    expect(line[0]).toBeLessThan(-10)
    expect(line[SYNC_LEN - 1]).toBeGreaterThan(line[0]! / 2)
    expect(line[SYNC_LEN]).toBeGreaterThan(10)
    expect(line[bar]).toBeGreaterThan(20)
    expect(Math.abs(line[BAR]!)).toBeLessThan(1)
  })

  it('carries the burst round a series capacitor on the colour wire', () => {
    const stock = cableLine(STOCK)
    const line = cableLine({ ...STOCK, seriesCapMHz: 0.3 })
    const swing = (of: number[]) => {
      const at = BURST_START + 8
      return of[at]! - (of[at - 2]! + of[at + 2]!) / 2
    }
    expect(Math.abs(swing(stock))).toBeGreaterThan(30)
    expect(swing(line)).toBeCloseTo((2 / 3) * swing(stock), 0)
  })

  it('echoes only the chroma pin when the line is open', () => {
    const line = cableLine({ ...STOCK, chromaPinOnly: 1, termination: 0.7 })
    expect(line[SYNC]).toBe(0)
    expect(line[BAR]).toBe(0)
  })

  it('swaps the echo along with the signal', () => {
    const open = cableLine({ ...STOCK, termination: 0.7 })
    const swapped = cableLine({ ...STOCK, polarityFlip: 1, termination: 0.7 })
    expect(swapped).toEqual(open.map(v => -v))
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

describe('humColumn', () => {
  it('runs one mains cycle down the frame at the given amplitude', () => {
    const hum = humColumn(-20)
    expect(Math.max(...hum.map(Math.abs))).toBeCloseTo(20, 0)
    expect(hum[0]).toBeCloseTo(0)
    expect(hum.at(-1)).toBeCloseTo(0)
    expect(Math.min(...hum)).toBeLessThan(0)
  })
})

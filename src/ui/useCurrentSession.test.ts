import { describe, expect, it } from 'vitest'

import {
  MIN_GAP_MS,
  SETTLE_MS,
  nextWriteAt,
  worthResuming,
} from './useCurrentSession'

describe('the current-session write gate', () => {
  it('waits for the board to settle before the first write', () => {
    expect(nextWriteAt({ query: null, at: 0 }, 'set=1', 10_000)).toBe(
      10_000 + SETTLE_MS,
    )
  })

  it('writes nothing for the query already written to the account', () => {
    expect(
      nextWriteAt({ query: 'set=1', at: 10_000 }, 'set=1', 99_000),
    ).toBeNull()
  })

  it('holds a change back to one write per gap', () => {
    // A change a second after a write waits out the rest of the gap, which
    // reaches further than the debounce does.
    expect(nextWriteAt({ query: 'set=1', at: 10_000 }, 'set=2', 11_000)).toBe(
      10_000 + MIN_GAP_MS,
    )
  })

  it('debounces once the gap has passed', () => {
    const now = 10_000 + MIN_GAP_MS * 2
    expect(nextWriteAt({ query: 'set=1', at: 10_000 }, 'set=2', now)).toBe(
      now + SETTLE_MS,
    )
  })

  it('never schedules a write in the past', () => {
    expect(nextWriteAt({ query: 'set=1', at: 0 }, 'set=2', 1_000_000)).toBe(
      1_000_000 + SETTLE_MS,
    )
  })
})

describe('which sessions the account is offered back', () => {
  it("leaves a bare load alone: the landing look on bars is nobody's session", () => {
    expect(worthResuming(0, 'bars', 'bars')).toBe(false)
  })

  it('takes a control off rest', () => {
    expect(worthResuming(1, 'bars', 'bars')).toBe(true)
  })

  it('takes a deck on something other than bars, with the board at rest', () => {
    expect(worthResuming(0, 'url', 'bars')).toBe(true)
    expect(worthResuming(0, 'bars', 'file')).toBe(true)
  })
})

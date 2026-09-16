import { describe, expect, it } from 'vitest'

import {
  MIN_GAP_MS,
  SETTLE_MS,
  nextWriteAt,
  observe,
} from './useCurrentSession'

import type { Opened } from './useCurrentSession'

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
  const fresh: Opened = { query: null, moved: false }

  it('waits for a board before it knows where the page opened', () => {
    expect(observe(fresh, null)).toEqual(fresh)
  })

  it('does not count the board the page opened on as a session', () => {
    const at = observe(fresh, 'set=gallery')
    expect(at).toEqual({ query: 'set=gallery', moved: false })
    expect(observe(at, 'set=gallery').moved).toBe(false)
  })

  it('starts the session when the board moves off it', () => {
    const at = observe(fresh, 'set=gallery')
    expect(observe(at, 'set=gallery&gain=2').moved).toBe(true)
  })

  it('keeps the session once started, back on the opening board included', () => {
    const moved = observe(observe(fresh, 'set=a'), 'set=b')
    expect(observe(moved, 'set=a').moved).toBe(true)
  })

  it('keeps where the page opened across a spell with no engine', () => {
    const at = observe(fresh, 'set=a')
    expect(observe(observe(at, null), 'set=a').moved).toBe(false)
  })
})

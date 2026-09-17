import { describe, expect, it } from 'vitest'

import { stillShows, stillTag } from './cloud'
import {
  MIN_GAP_MS,
  SETTLE_MS,
  nextWriteAt,
  observe,
} from './useCurrentSession'

import type { Still } from './cloud'
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

// A session entry is rewritten in place as the board settles, and the write made
// from a hidden tab carries no new picture. Comparing clocks therefore called a
// good still stale the moment a still-less write moved the entry on, and the
// card fell back to the mark.
describe('which still a session card shows', () => {
  const still = (over: Partial<Still> = {}): Still => ({
    webp: 'UklGRh',
    at: 1000,
    ...over,
  })

  it('shows a still tagged with the board the card resumes', () => {
    const q = stillTag('set=a&gain=2')
    expect(stillShows(still({ q }), { q, since: 9000 })).toBe(true)
  })

  it('refuses a still tagged with a board the card has moved off', () => {
    expect(
      stillShows(still({ q: stillTag('set=a') }), { q: stillTag('set=b') }),
    ).toBe(false)
  })

  it('falls back to the clock for a still written before tagging', () => {
    const want = { q: stillTag('set=a'), since: 1000 }
    expect(stillShows(still({ at: 2000 }), want)).toBe(true)
    expect(stillShows(still({ at: 500 }), want)).toBe(false)
  })

  it('tags a board the same way every time, and two boards apart', () => {
    expect(stillTag('set=a&gain=2')).toBe(stillTag('set=a&gain=2'))
    expect(stillTag('set=a&gain=2')).not.toBe(stillTag('set=a&gain=3'))
    expect(stillTag('')).toMatch(/^[0-9a-z]+$/)
  })
})

import { useEffect, useEffectEvent } from 'react'

import { randomIndex } from '../core/rng'
import { ANY_TOPIC } from '../sources/pools'

import type { Rand } from '../core/rng'
import type { PoolMode, PoolOrigin, PoolRef, RollTopic } from '../sources/pools'

// A deck can be on a *feed*: a stream of files advanced by hand or on a timer.
// Two things feed one. A topic on a public archive rolls a new file out of a
// pool each time; a list — a search, the browser's results, the clip shelf —
// walks a fixed set of items in shuffled order. Either way the deck remembers
// what it showed, so it can step back.

// One thing a feed can put on a deck: a file upstream, or a clip on the shelf.
export type FeedItem =
  | { at: 'ref'; ref: PoolRef }
  | { at: 'clip'; id: string; name: string }

// The deck mode a list feed puts its items up under. A search from the topic
// picker stays on the archive's own mode; the browser and the shelf have
// theirs.
export type ListMode = PoolMode | 'browse' | 'library'

export interface FeedList {
  label: string
  mode: ListMode
  // Shuffled once when the list starts, and again each time it wraps.
  items: FeedItem[]
  next: number
}

// What the deck has shown, and where it is in that. `at` is below the end
// after stepping back; advancing from there replays forward before drawing
// anything new.
export interface FeedTrail {
  items: FeedItem[]
  at: number
}

export interface FeedSettings {
  // Kept per origin, so moving a deck from Commons to archive.org and back
  // finds the topic it had there.
  topic: Record<PoolOrigin, RollTopic>
  // Seconds between advances while `auto` is on.
  every: number
  auto: boolean
}

export interface DeckFeed {
  settings: FeedSettings
  list: FeedList | null
  trail: FeedTrail
  busy: boolean
}

export const FEED_EVERY_MIN = 2
export const FEED_EVERY_MAX = 600
export const TRAIL_LIMIT = 30

export const EMPTY_TRAIL: FeedTrail = { items: [], at: -1 }

export const FEED_DEFAULT: DeckFeed = {
  settings: {
    topic: { commons: ANY_TOPIC, archive: ANY_TOPIC },
    every: 10,
    auto: false,
  },
  list: null,
  trail: EMPTY_TRAIL,
  busy: false,
}

export const clampEvery = (seconds: number) =>
  Math.min(FEED_EVERY_MAX, Math.max(FEED_EVERY_MIN, Math.round(seconds)))

export function shuffled<T>(xs: readonly T[], rand: Rand = Math.random): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, rand)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const startList = (
  label: string,
  mode: ListMode,
  items: readonly FeedItem[],
  rand: Rand = Math.random,
): FeedList => ({ label, mode, items: shuffled(items, rand), next: 0 })

// The next item off a list, and the list with its cursor moved. Wrapping
// reshuffles, so a long slideshow does not repeat the same order.
export function drawList(
  list: FeedList,
  rand: Rand = Math.random,
): { item: FeedItem; list: FeedList } {
  const items =
    list.next >= list.items.length ? shuffled(list.items, rand) : list.items
  const at = list.next >= list.items.length ? 0 : list.next
  return { item: items[at], list: { ...list, items, next: at + 1 } }
}

// A newly shown item onto the trail. Anything ahead of the cursor is dropped:
// once the deck shows something new, the old forward history is a different
// branch.
export function pushTrail(trail: FeedTrail, item: FeedItem): FeedTrail {
  const kept = [...trail.items.slice(0, trail.at + 1), item].slice(-TRAIL_LIMIT)
  return { items: kept, at: kept.length - 1 }
}

export const canStepBack = (trail: FeedTrail) => trail.at > 0

export const hasAhead = (trail: FeedTrail) => trail.at < trail.items.length - 1

// Advance a feed `every` seconds after the last file landed. The count starts
// when an advance settles, so an archive.org download that takes twenty
// seconds is never cut short by the next tick, and a failed one is retried an
// interval later.
export function useFeedTimer(opts: {
  on: boolean
  every: number
  busy: boolean
  advance: () => void
}) {
  const { on, every, busy } = opts
  const fire = useEffectEvent(() => opts.advance())
  useEffect(() => {
    const timer =
      on && !busy ? setTimeout(() => fire(), every * 1000) : undefined
    return () => clearTimeout(timer)
  }, [on, every, busy])
}

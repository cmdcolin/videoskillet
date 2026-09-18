import { describe, expect, it } from 'vitest'

import { rngFor } from '../core/rng'
import {
  EMPTY_TRAIL,
  TRAIL_LIMIT,
  canStepBack,
  drawList,
  hasAhead,
  pushTrail,
  startList,
} from './feed'

import type { FeedItem } from './feed'

const clip = (id: string): FeedItem => ({ at: 'clip', id, name: id })
const ids = (items: readonly FeedItem[]) =>
  items.map(i => (i.at === 'clip' ? i.id : i.ref.title))

describe('list feeds', () => {
  it('walks every item once before repeating any', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map(clip)
    let list = startList('five', 'library', items, rngFor(1))
    const seen: FeedItem[] = []
    for (let i = 0; i < items.length; i++) {
      const drawn = drawList(list, rngFor(i))
      seen.push(drawn.item)
      list = drawn.list
    }
    expect(ids(seen).toSorted()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('reshuffles and keeps going when it wraps', () => {
    let list = startList('two', 'library', [clip('a'), clip('b')], rngFor(3))
    const seen: FeedItem[] = []
    for (let i = 0; i < 6; i++) {
      const drawn = drawList(list, rngFor(i))
      seen.push(drawn.item)
      list = drawn.list
    }
    expect(seen).toHaveLength(6)
    expect(ids(seen.slice(2, 4)).toSorted()).toEqual(['a', 'b'])
  })
})

describe('feed trail', () => {
  it('steps back, then replays forward before drawing anything new', () => {
    const trail = [clip('a'), clip('b'), clip('c')].reduce(
      pushTrail,
      EMPTY_TRAIL,
    )
    expect(canStepBack(trail)).toBe(true)
    expect(hasAhead(trail)).toBe(false)
    const back = { ...trail, at: trail.at - 1 }
    expect(hasAhead(back)).toBe(true)
  })

  it('drops the old forward branch once something new is shown', () => {
    const trail = [clip('a'), clip('b'), clip('c')].reduce(
      pushTrail,
      EMPTY_TRAIL,
    )
    const branched = pushTrail({ ...trail, at: 0 }, clip('x'))
    expect(ids(branched.items)).toEqual(['a', 'x'])
    expect(branched.at).toBe(1)
  })

  it('holds at most TRAIL_LIMIT items', () => {
    const many = Array.from({ length: TRAIL_LIMIT + 5 }, (_, i) =>
      clip(String(i)),
    )
    const trail = many.reduce(pushTrail, EMPTY_TRAIL)
    expect(trail.items).toHaveLength(TRAIL_LIMIT)
    expect(trail.at).toBe(TRAIL_LIMIT - 1)
    expect(canStepBack(EMPTY_TRAIL)).toBe(false)
  })
})

import { useRef, useState } from 'react'

import {
  MODE_ORIGIN,
  browsePool,
  isPoolMode,
  releasePick,
  resolvePool,
  rollPool,
} from '../sources/pools'
import {
  EMPTY_TRAIL,
  FEED_DEFAULT,
  canStepBack,
  drawList,
  hasAhead,
  pushTrail,
  startList,
  useFeedTimer,
} from './feed'

import type { SourceBMode, SourceMode } from '../sources/modes'
import type {
  PoolMode,
  PoolOrigin,
  PoolPick,
  PoolRef,
  RollAim,
  RollTopic,
} from '../sources/pools'
import type {
  DeckFeed,
  FeedItem,
  FeedList,
  FeedSettings,
  FeedTrail,
  ListMode,
} from './feed'
import type { StashSlot } from './fileStash'

// How many results a search feed walks. Commons hands back thumbnails for at
// most fifty files in one request, and a feed wants the same list the browser
// would show.
export const FEED_SEARCH_LIMIT = 50

// What a feed needs from the engine: what a deck is on, and the two ways to put
// something on it. Each resolves to what landed, or null when it did not land —
// a failure, or a deck that moved on while it was out.
export interface FeedDeps {
  modeOf: (key: StashSlot) => SourceMode | SourceBMode
  roll: (
    key: StashSlot,
    mode: PoolMode,
    aim: RollAim,
  ) => Promise<PoolRef | null>
  show: (key: StashSlot, item: FeedItem, mode: ListMode) => Promise<boolean>
  // Put a pick that was rolled ahead of time on a deck.
  land: (key: StashSlot, pick: PoolPick) => boolean
  fail: (message: string) => void
}

// A roll made while the current file was still up, waiting for the next
// advance. `aim` says which topic it came from, so a topic change does not
// hand back a file off the old one.
interface Ahead {
  aim: string
  pick: Promise<PoolPick | null>
}

const aimKey = (mode: PoolMode, aim: RollAim) =>
  `${mode}\n${aim.kind ?? ''}\n${aim.topic ?? ''}`

// Fetch a still's bytes so the browser has them cached when it is shown. A
// clip needs nothing here: a Commons clip streams, and an archive.org clip is
// already held whole once its pick resolves.
const warm = (pick: PoolPick) => {
  if (pick.kind === 'photo')
    void fetch(pick.url)
      .then(r => r.blob())
      .catch(() => null)
}

const listModeOf = (mode: SourceMode | SourceBMode): ListMode | null =>
  isPoolMode(mode) || mode === 'browse' || mode === 'library' ? mode : null

// Whether a deck is on its feed right now: on an archive's own mode, or on the
// mode a list feed put it on.
export const feedShowing = (
  feed: DeckFeed,
  mode: SourceMode | SourceBMode,
): boolean =>
  isPoolMode(mode) || (feed.list !== null && feed.list.mode === mode)

// Both decks' feeds, and the verbs that move them. Lives beside the engine
// rather than inside a panel component, so a slideshow keeps running with its
// stage folded away.
export function useFeeds(deps: FeedDeps) {
  const [feeds, setFeeds] = useState({ a: FEED_DEFAULT, b: FEED_DEFAULT })

  // The next item, fetched while a slideshow shows the current one, so the
  // advance does not wait on the network. A ref because it is a handle on a
  // download in flight, which no render reads.
  const ahead = useRef<{ a: Ahead | null; b: Ahead | null }>({
    a: null,
    b: null,
  })

  const dropAhead = (key: StashSlot) => {
    const held = ahead.current[key]
    ahead.current[key] = null
    if (held !== null)
      void held.pick.then(p => {
        if (p !== null) releasePick(p)
      })
  }

  // The held roll if it came off this topic, and nothing otherwise. Taking it
  // clears it, so it is shown at most once.
  const takeAhead = (key: StashSlot, aim: string) => {
    const held = ahead.current[key]
    if (held !== null && held.aim !== aim) dropAhead(key)
    ahead.current[key] = null
    return held !== null && held.aim === aim ? held.pick : null
  }

  const rollAhead = (
    key: StashSlot,
    mode: PoolMode,
    aim: RollAim,
    avoid: string,
  ) => {
    dropAhead(key)
    ahead.current[key] = {
      aim: aimKey(mode, aim),
      pick: rollPool(MODE_ORIGIN[mode], {
        avoid,
        kind: aim.kind,
        topic: aim.topic,
      }).then(
        pick => {
          warm(pick)
          return pick
        },
        () => null,
      ),
    }
  }

  // The list's next item resolved and dropped, which leaves its bytes in the
  // caches the real show will read from.
  const warmNext = (list: FeedList) => {
    const item = list.items[list.next]
    if (item !== undefined && item.at === 'ref')
      void resolvePool(item.ref).then(
        pick => {
          warm(pick)
          releasePick(pick)
        },
        () => null,
      )
  }

  const patch = (key: StashSlot, f: (d: DeckFeed) => DeckFeed) =>
    setFeeds(s => (key === 'a' ? { ...s, a: f(s.a) } : { ...s, b: f(s.b) }))

  // One advance in flight. `busy` is what the timer waits on and what greys
  // the buttons; `onShown` moves the trail once the item is actually up.
  const run = (
    key: StashSlot,
    job: Promise<FeedItem | null>,
    onShown: (trail: FeedTrail, item: FeedItem) => FeedTrail,
  ) => {
    patch(key, d => ({ ...d, busy: true }))
    job.then(
      item =>
        patch(key, d => ({
          ...d,
          busy: false,
          trail: item === null ? d.trail : onShown(d.trail, item),
        })),
      (e: unknown) => {
        patch(key, d => ({ ...d, busy: false }))
        deps.fail(String(e))
      },
    )
  }

  const rollTopic = (key: StashSlot, mode: PoolMode, aim: RollAim) => {
    const held = takeAhead(key, aimKey(mode, aim))
    const landed =
      held === null
        ? deps.roll(key, mode, aim)
        : held.then(pick =>
            pick === null
              ? deps.roll(key, mode, aim)
              : deps.land(key, pick)
                ? { origin: pick.origin, title: pick.title, kind: pick.kind }
                : null,
          )
    run(
      key,
      landed.then(ref => {
        if (ref !== null && feeds[key].settings.auto)
          rollAhead(key, mode, aim, ref.title)
        return ref === null ? null : { at: 'ref' as const, ref }
      }),
      pushTrail,
    )
  }

  const playList = (key: StashSlot, list: FeedList) => {
    const drawn = drawList(list)
    patch(key, d => ({ ...d, list: drawn.list }))
    run(
      key,
      deps.show(key, drawn.item, list.mode).then(ok => {
        if (ok && feeds[key].settings.auto) warmNext(drawn.list)
        return ok ? drawn.item : null
      }),
      pushTrail,
    )
  }

  // Something new off the feed: the list's next item, or a fresh roll.
  const draw = (key: StashSlot) => {
    const mode = deps.modeOf(key)
    const { list, settings } = feeds[key]
    if (list !== null && list.mode === mode) playList(key, list)
    else if (isPoolMode(mode))
      rollTopic(key, mode, settings.topic[MODE_ORIGIN[mode]].aim)
  }

  // Step along the trail to an item already shown.
  const revisit = (key: StashSlot, step: 1 | -1) => {
    const { trail } = feeds[key]
    const item = trail.items[trail.at + step]
    const mode = listModeOf(deps.modeOf(key))
    if (item !== undefined && mode !== null)
      run(
        key,
        deps.show(key, item, mode).then(ok => (ok ? item : null)),
        t => ({ ...t, at: t.at + step }),
      )
  }

  const next = (key: StashSlot) =>
    hasAhead(feeds[key].trail) ? revisit(key, 1) : draw(key)

  const back = (key: StashSlot) => {
    if (canStepBack(feeds[key].trail)) revisit(key, -1)
  }

  // The picker putting a deck on an archive. A fresh trail, since what the
  // deck showed before was some other source.
  const begin = (key: StashSlot, mode: PoolMode) => {
    dropAhead(key)
    patch(key, d => ({ ...d, list: null, trail: EMPTY_TRAIL }))
    rollTopic(key, mode, feeds[key].settings.topic[MODE_ORIGIN[mode]].aim)
  }

  // A new topic takes effect at once: the file on the deck came from the old
  // one, so it is replaced rather than left up until the next advance.
  const chooseTopic = (
    key: StashSlot,
    origin: PoolOrigin,
    topic: RollTopic,
  ) => {
    patch(key, d => ({
      ...d,
      list: null,
      settings: {
        ...d.settings,
        topic: { ...d.settings.topic, [origin]: topic },
      },
    }))
    const mode = deps.modeOf(key)
    if (isPoolMode(mode) && MODE_ORIGIN[mode] === origin)
      rollTopic(key, mode, topic.aim)
  }

  // Start walking a list of items, from the browser or the shelf.
  const startFeed = (
    key: StashSlot,
    label: string,
    mode: ListMode,
    items: readonly FeedItem[],
  ) => {
    if (items.length > 0) {
      dropAhead(key)
      patch(key, d => ({ ...d, trail: EMPTY_TRAIL }))
      playList(key, startList(label, mode, items))
    }
  }

  // A typed search as the topic: the ranked results, walked in shuffled order.
  // Ranked first because a random-sorted free-text search on Commons answers
  // with whatever matched a word anywhere (sources/commons.ts).
  const searchTopic = (key: StashSlot, query: string) => {
    const mode = deps.modeOf(key)
    const words = query.trim()
    if (isPoolMode(mode) && words !== '') {
      patch(key, d => ({ ...d, busy: true }))
      browsePool(MODE_ORIGIN[mode], words, FEED_SEARCH_LIMIT).then(
        hits => {
          patch(key, d => ({ ...d, busy: false }))
          if (hits.length === 0) deps.fail(`nothing found for “${words}”`)
          else
            startFeed(
              key,
              `“${words}”`,
              mode,
              hits.map(ref => ({ at: 'ref' as const, ref })),
            )
        },
        (e: unknown) => {
          patch(key, d => ({ ...d, busy: false }))
          deps.fail(`search: ${String(e)}`)
        },
      )
    }
  }

  const endFeed = (key: StashSlot) => {
    dropAhead(key)
    patch(key, d => ({ ...d, list: null }))
  }

  const retime = (key: StashSlot, change: Partial<FeedSettings>) =>
    patch(key, d => ({ ...d, settings: { ...d.settings, ...change } }))

  useFeedTimer({
    on: feeds.a.settings.auto && feedShowing(feeds.a, deps.modeOf('a')),
    every: feeds.a.settings.every,
    busy: feeds.a.busy,
    advance: () => next('a'),
  })
  useFeedTimer({
    on: feeds.b.settings.auto && feedShowing(feeds.b, deps.modeOf('b')),
    every: feeds.b.settings.every,
    busy: feeds.b.busy,
    advance: () => next('b'),
  })

  return {
    feeds,
    next,
    back,
    begin,
    chooseTopic,
    startFeed,
    searchTopic,
    endFeed,
    retime,
  }
}

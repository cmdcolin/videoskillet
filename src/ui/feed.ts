import { useEffect, useEffectEvent } from 'react'

import { ANY_TOPIC } from '../sources/pools'

import type { PoolOrigin, RollTopic } from '../sources/pools'

// A deck on a public archive is a *feed*: a stream of files drawn from a topic,
// advanced by hand or on a timer. These are the settings a deck keeps for it.
//
// The topic is kept per origin, so moving a deck from Commons to archive.org and
// back finds the topic it had there.
export interface FeedSettings {
  topic: Record<PoolOrigin, RollTopic>
  // Seconds between advances while `auto` is on.
  every: number
  auto: boolean
}

export const FEED_EVERY_MIN = 2
export const FEED_EVERY_MAX = 600

export const FEED_DEFAULT: FeedSettings = {
  topic: { commons: ANY_TOPIC, archive: ANY_TOPIC },
  every: 10,
  auto: false,
}

export const clampEvery = (seconds: number) =>
  Math.min(FEED_EVERY_MAX, Math.max(FEED_EVERY_MIN, Math.round(seconds)))

// Advance a feed `every` seconds after the last file landed. The count starts
// when a roll settles, so an archive.org download that takes twenty seconds is
// never cut short by the next tick, and a failed roll is retried one interval
// later.
export function useFeedTimer(opts: {
  on: boolean
  every: number
  rolling: boolean
  advance: () => void
}) {
  const { on, every, rolling } = opts
  const fire = useEffectEvent(() => opts.advance())
  useEffect(() => {
    const timer =
      on && !rolling ? setTimeout(() => fire(), every * 1000) : undefined
    return () => clearTimeout(timer)
  }, [on, every, rolling])
}

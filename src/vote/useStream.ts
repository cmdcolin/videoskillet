import { useEffect, useRef, useState } from 'react'

import { randomSeed } from '../core/rng'
import { useLookLabels } from '../ui/useLookLabels'
import { anchorName, sampleOne } from './candidates'
import {
  DEVELOP_MS,
  FLUSH_MS,
  VOTE_SOURCES,
  flushEngines,
  show,
} from './prepare'
import { candidateRecord } from './votes'

import type { EngineApi } from '../core/gpu/engineapi'
import type { LookContext } from '../ui/useLookLabels'
import type { Recipe } from './candidates'
import type { VoteSource } from './prepare'

// The stream: one look at a time, rated on the app's own 1-5 scale, next.
//
// Pairwise voting is the calibrated instrument; this is the volume one. A pair
// costs two engines and a choice between them, and yields one comparison. A
// single look on one engine yields one row of the same `ratings` dataset the
// app's tags menu writes — same scale, same tags, same key space — at whatever
// rate the labeller can press a key. `affinity.mjs simulate` puts `cool` at
// ~200 rows for a usable fit, which is a quarter of an hour here.
//
// What the stream has to keep, that the app does not: the rows have to be
// honest about attention. A rating is a claim somebody looked; a look that sat
// on screen with nobody there is not a 1, it is nothing. So the stream never
// files silence. It waits `HOLD_MS` after the look is ready, moves on, and after
// `IDLE_AFTER` unanswered looks in a row it stops and says so — a page left
// running is a page nobody is rating.
//
// The other half of the same rule, from VOTING.md: rating must be cheaper than
// moving on. A key advances the stream at once; waiting advances it in
// `HOLD_MS`. So the fastest way through is to rate everything, and the 1s and 2s
// come in at the same cost as the 5s — the shape a preference model needs.

// How long a ready look stays before the stream moves on unanswered.
export const HOLD_MS = 5000
// Unanswered looks in a row before the stream stops itself.
export const IDLE_AFTER = 3

//   'flushing'   — stock signal, clearing the last look out of the feedback loops
//   'developing' — the look is up and blooming; rating is held off
//   'ready'      — old enough to judge; the hold clock is running
//   'held'       — ready, and the labeller pressed space: no auto-advance
//   'idle'       — nobody answered IDLE_AFTER in a row; waiting for a key
export type StreamPhase = 'flushing' | 'developing' | 'ready' | 'held' | 'idle'

export function lookContext(recipe: Recipe, source: VoteSource): LookContext {
  return {
    query: candidateRecord(recipe).query,
    weights: recipe.weights,
    preset: anchorName(recipe),
    provenance: 'stream',
    source,
  }
}

export function useStream(args: {
  engine: EngineApi | null
  source: VoteSource
  uid: string | null
}) {
  const { engine, source, uid } = args
  const labels = useLookLabels(uid)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [phase, setPhase] = useState<StreamPhase>('flushing')
  const [round, setRound] = useState(0)
  const [seen, setSeen] = useState(0)
  const unanswered = useRef(0)
  // The hold timer is separate from the flush/develop pair so that `hold` can
  // cancel it without restarting the look.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHold = () => {
    if (holdTimer.current !== null) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  useEffect(() => {
    if (engine === null) return undefined
    setPhase('flushing')
    setRecipe(null)
    flushEngines([engine])
    const seed = randomSeed()
    const toShow = setTimeout(() => {
      engine.setImageSource(VOTE_SOURCES[source]())
      const next = sampleOne(seed)
      show(engine, next)
      setRecipe(next)
      setPhase('developing')
      // The rating's `ms` counts from here — the same clock the app's menu
      // starts when it opens.
      labels.reset()
    }, FLUSH_MS)
    const toArm = setTimeout(() => {
      setPhase('ready')
      holdTimer.current = setTimeout(() => {
        unanswered.current += 1
        if (unanswered.current >= IDLE_AFTER) {
          setPhase('idle')
        } else {
          setRound(n => n + 1)
        }
      }, HOLD_MS)
    }, FLUSH_MS + DEVELOP_MS)
    return () => {
      clearTimeout(toShow)
      clearTimeout(toArm)
      clearHold()
    }
    // `labels.reset` is recreated every render and reads nothing that changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, source, round])

  const judgeable = recipe !== null && (phase === 'ready' || phase === 'held')

  const rate = (cool: number) => {
    if (!judgeable || recipe === null || uid === null) return
    labels.rate(cool, lookContext(recipe, source))
    unanswered.current = 0
    setSeen(n => n + 1)
    clearHold()
    setRound(n => n + 1)
  }

  // Keep this one on screen: no auto-advance until a key says otherwise.
  const hold = () => {
    if (phase !== 'ready') return
    clearHold()
    setPhase('held')
  }

  // Move on without an opinion. Counts as unanswered, so a run of these idles
  // the stream the same way silence does.
  const skip = () => {
    if (!judgeable) return
    unanswered.current += 1
    clearHold()
    setRound(n => n + 1)
  }

  const resume = () => {
    unanswered.current = 0
    setRound(n => n + 1)
  }

  return {
    recipe,
    phase,
    judgeable,
    rate,
    hold,
    skip,
    resume,
    seen,
    tags: labels.tags,
    toggle: labels.toggle,
    pending: labels.pending,
    vocabulary: labels.vocabulary,
  }
}

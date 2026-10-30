import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEVELOP_MS, FLUSH_MS, showPair } from './prepare'
import { useVoting } from './useVoting'
import { queueVote } from './votes'

import type { EngineApi } from '../core/gpu/engineapi'

vi.mock('../ui/cloud', () => ({
  putCandidate: vi.fn(() => Promise.resolve()),
  putVotes: vi.fn(() => Promise.resolve([])),
}))
vi.mock('./prepare', () => ({
  DEVELOP_MS: 3000,
  FLUSH_MS: 600,
  flushEngines: vi.fn(),
  showPair: vi.fn((_engines: unknown, seed: number, source: string) => ({
    seed,
    source,
    left: {},
    right: {},
  })),
}))
vi.mock('./votes', () => ({
  candidateRecord: vi.fn(() => ({})),
  clearQueued: vi.fn(),
  queueVote: vi.fn(),
  readPendingVotes: vi.fn(() => []),
  voteRecord: vi.fn(() => ({})),
}))

type Pair = readonly [EngineApi, EngineApi]

const pair = () => [{}, {}] as unknown as Pair

// Every render, so a test can see the one between an engine going down and
// the effect that clears the phase.
let renders: { down: boolean; judgeable: boolean; vote: () => void }[]

const mount = (engines: Pair | null) =>
  renderHook(
    (p: { engines: Pair | null }) => {
      const voting = useVoting({
        engines: p.engines,
        source: 'bars',
        uid: 'u1',
      })
      renders.push({
        down: p.engines === null,
        judgeable: voting.judgeable,
        vote: () => voting.vote('a'),
      })
      return voting
    },
    { initialProps: { engines } },
  )

const develop = () =>
  act(() => {
    vi.advanceTimersByTime(FLUSH_MS + DEVELOP_MS)
  })

beforeEach(() => {
  renders = []
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useVoting', () => {
  it('records a vote once the pair has developed', () => {
    const { result } = mount(pair())
    develop()
    expect(result.current.judgeable).toBe(true)
    act(() => result.current.vote('a'))
    expect(queueVote).toHaveBeenCalledOnce()
  })

  it('refuses a vote from every render where the engines are down', () => {
    const { result, rerender } = mount(pair())
    develop()
    renders = []
    rerender({ engines: null })
    expect(result.current.phase).not.toBe('ready')
    expect(renders.length).toBeGreaterThan(1)
    expect(renders.every(r => r.down && !r.judgeable)).toBe(true)
    act(() => {
      for (const r of renders) r.vote()
    })
    expect(queueVote).not.toHaveBeenCalled()
  })

  it('never arms while the engines are down, however long it waits', () => {
    const { result } = mount(null)
    act(() => {
      vi.advanceTimersByTime(10 * (FLUSH_MS + DEVELOP_MS))
    })
    expect(result.current.phase).toBe('flushing')
    expect(result.current.pair).toBeNull()
    expect(showPair).not.toHaveBeenCalled()
  })

  it('rolls a fresh pair onto engines that come back', () => {
    const { result, rerender } = mount(pair())
    develop()
    rerender({ engines: null })
    const back = pair()
    rerender({ engines: back })
    expect(result.current.judgeable).toBe(false)
    develop()
    expect(showPair).toHaveBeenCalledTimes(2)
    expect(showPair).toHaveBeenLastCalledWith(back, expect.any(Number), 'bars')
    expect(result.current.judgeable).toBe(true)
  })
})

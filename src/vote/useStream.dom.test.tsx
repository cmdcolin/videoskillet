import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEVELOP_MS, FLUSH_MS, show } from './prepare'
import { useStream } from './useStream'

import type { EngineApi } from '../core/gpu/engineapi'

const labels = vi.hoisted(() => ({
  rate: vi.fn(),
  reset: vi.fn(),
  toggle: vi.fn(),
  tags: [],
  pending: 0,
  vocabulary: [],
}))

vi.mock('../ui/useLookLabels', () => ({ useLookLabels: () => labels }))
vi.mock('./candidates', () => ({
  anchorName: () => null,
  sampleOne: (seed: number) => ({ seed }),
}))
vi.mock('./votes', () => ({
  candidateRecord: () => ({ query: '' }),
}))
vi.mock('./prepare', () => ({
  DEVELOP_MS: 3000,
  FLUSH_MS: 600,
  VOTE_SOURCES: { bars: () => ({}) },
  flushEngines: vi.fn(),
  show: vi.fn(),
}))

const engine = () => ({ setImageSource: vi.fn() }) as unknown as EngineApi

// Every render, so a test can see the one between the engine going down and
// the effect that clears the phase.
let renders: { down: boolean; judgeable: boolean; act: () => void }[]

const mount = (first: EngineApi | null) =>
  renderHook(
    (p: { engine: EngineApi | null }) => {
      const stream = useStream({ engine: p.engine, source: 'bars', uid: 'u1' })
      renders.push({
        down: p.engine === null,
        judgeable: stream.judgeable,
        act: () => {
          stream.hold()
          stream.rate(4)
        },
      })
      return stream
    },
    { initialProps: { engine: first } },
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

describe('useStream', () => {
  it('records a rating once the look has developed', () => {
    const { result } = mount(engine())
    develop()
    expect(result.current.judgeable).toBe(true)
    act(() => result.current.rate(4))
    expect(labels.rate).toHaveBeenCalledOnce()
  })

  it('refuses a rating and a hold from every render where the engine is down', () => {
    const { result, rerender } = mount(engine())
    develop()
    renders = []
    rerender({ engine: null })
    expect(result.current.phase).toBe('flushing')
    expect(renders.length).toBeGreaterThan(1)
    expect(renders.every(r => r.down && !r.judgeable)).toBe(true)
    act(() => {
      for (const r of renders) r.act()
    })
    expect(labels.rate).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('flushing')
  })

  it('does not move on by itself while the engine is down', () => {
    const { result, rerender } = mount(engine())
    develop()
    rerender({ engine: null })
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.phase).toBe('flushing')
    expect(result.current.recipe).toBeNull()
  })

  it('puts a fresh look on an engine that replaces a lost one', () => {
    const { result, rerender } = mount(engine())
    develop()
    rerender({ engine: null })
    const next = engine()
    rerender({ engine: next })
    develop()
    expect(show).toHaveBeenLastCalledWith(next, expect.anything())
    expect(result.current.judgeable).toBe(true)
  })
})

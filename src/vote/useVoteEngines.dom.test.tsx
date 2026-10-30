import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { superviseEngine } from '../ui/engineSupervisor'
import { oneAtATime, useVoteEngines } from './useVoteEngines'

import type { Engine } from '../core/gpu/pipeline'
import type { AudioState } from '../core/signal/audiostate'
import type { Supervision } from '../ui/engineSupervisor'

const create = vi.hoisted(() =>
  vi.fn<
    (canvas: HTMLCanvasElement, opts: { audio?: AudioState }) => Promise<Engine>
  >(),
)

vi.mock('../core/gpu/pipeline', () => ({
  Engine: { create },
}))
vi.mock('../core/signal/audiostate', () => ({
  AudioState: class {
    readonly shared = true
  },
}))
vi.mock('../ui/engineSupervisor', () => ({
  superviseEngine: vi.fn(),
}))

const supervise = vi.mocked(superviseEngine)

// Stand-ins for engines, told apart by name. The hook only stores and compares
// them.
const engine = (name: string) => ({ name }) as unknown as Engine

const canvasRef = () => ({ current: document.createElement('canvas') })

const flush = () => new Promise(r => setTimeout(r, 0))

let supervisions: Supervision[]
let stops: ReturnType<typeof vi.fn>[]

beforeEach(() => {
  supervisions = []
  stops = []
  supervise.mockImplementation((_canvas, s) => {
    supervisions.push(s)
    const stop = vi.fn()
    stops.push(stop)
    return stop
  })
})
afterEach(() => {
  vi.clearAllMocks()
  window.vf = undefined
  window.vfs = undefined
})

const mount = () => {
  const refs = [canvasRef(), canvasRef()] as const
  const hook = renderHook(() => useVoteEngines(refs))
  const [left, right] = supervisions
  if (left === undefined || right === undefined) throw new Error('unsupervised')
  return { ...hook, refs, left, right }
}

describe('useVoteEngines', () => {
  it('supervises every canvas at the fixed stimulus size', () => {
    const { refs } = mount()
    expect(supervise).toHaveBeenCalledTimes(2)
    expect(supervise.mock.calls.map(([c]) => c)).toEqual(
      refs.map(r => r.current),
    )
    expect(refs[0].current.width).toBe(640)
    expect(refs[0].current.height).toBe(480)
  })

  it('has no engines until every side has gone live', () => {
    const { result, left, right } = mount()
    const a = engine('a')
    const b = engine('b')
    act(() => left.adopt(a, null))
    expect(result.current.engines).toBeNull()
    act(() => right.adopt(b, null))
    expect(result.current.engines).toEqual([a, b])
    expect(result.current.halt).toBeUndefined()
    expect(window.vf).toBe(a)
    expect(window.vfs).toEqual([a, b])
  })

  it('takes the engines away while a side rebuilds, and hands back a new tuple', () => {
    const { result, left, right } = mount()
    const a = engine('a')
    const b = engine('b')
    act(() => {
      left.adopt(a, null)
      right.adopt(b, null)
    })
    const before = result.current.engines
    act(() => right.onRebuilding('lost'))
    expect(result.current.engines).toBeNull()
    expect(result.current.halt).toEqual({ kind: 'rebuilding', fault: 'lost' })
    const b2 = engine('b2')
    act(() => {
      right.onRebuilding(null)
      right.adopt(b2, b)
      right.onFrozen(null)
    })
    expect(result.current.engines).toEqual([a, b2])
    expect(result.current.engines).not.toBe(before)
    expect(window.vfs).toEqual([a, b2])
  })

  it('holds the engines while a side is frozen, and rolls a new tuple when it moves again', () => {
    const { result, left, right } = mount()
    act(() => {
      left.adopt(engine('a'), null)
      right.adopt(engine('b'), null)
    })
    const before = result.current.engines
    act(() => left.onFrozen('stalled'))
    expect(result.current.engines).toBeNull()
    expect(result.current.halt).toEqual({ kind: 'frozen', frozen: 'stalled' })
    act(() => left.onFrozen(null))
    expect(result.current.engines).toEqual(before)
    expect(result.current.engines).not.toBe(before)
  })

  it('keeps the same tuple across a report that changes nothing', () => {
    const { result, left, right } = mount()
    act(() => {
      left.adopt(engine('a'), null)
      right.adopt(engine('b'), null)
    })
    const before = result.current.engines
    act(() => right.onFrozen(null))
    expect(result.current.engines).toBe(before)
  })

  it('stays down for good once a side is fatal', () => {
    const { result, left, right } = mount()
    act(() => {
      left.adopt(engine('a'), null)
      right.adopt(engine('b'), null)
    })
    const fatal = {
      title: 'WebGPU device lost',
      body: 'gone',
      kind: 'lost',
    } as const
    act(() => left.onFatal(fatal))
    expect(result.current.engines).toBeNull()
    expect(result.current.halt).toEqual({ kind: 'fatal', fatal })
  })

  it('stops every supervisor on unmount', () => {
    const { unmount } = mount()
    unmount()
    expect(stops).toHaveLength(2)
    for (const stop of stops) expect(stop).toHaveBeenCalledOnce()
  })

  it('creates the engines one after another on one shared audio graph', async () => {
    const { left, right, refs } = mount()
    let finish: (made: Engine) => void = () => undefined
    create.mockImplementationOnce(
      () => new Promise<Engine>(resolve => (finish = resolve)),
    )
    create.mockResolvedValueOnce(engine('b'))
    const first = left.create?.(refs[0].current)
    const second = right.create?.(refs[1].current)
    await flush()
    expect(create).toHaveBeenCalledOnce()
    finish(engine('a'))
    await Promise.all([first, second])
    expect(create).toHaveBeenCalledTimes(2)
    const [audioA, audioB] = create.mock.calls.map(([, opts]) => opts.audio)
    expect(audioA).toBeDefined()
    expect(audioB).toBe(audioA)
  })
})

describe('oneAtATime', () => {
  it('starts the next call only after the last has settled, even a rejection', async () => {
    const started: number[] = []
    let fail: (e: Error) => void = () => undefined
    const make = vi.fn((n: number) => {
      started.push(n)
      return n === 1
        ? new Promise<number>((_, reject) => (fail = reject))
        : Promise.resolve(n)
    })
    const serial = oneAtATime(make)
    const one = serial(1)
    const two = serial(2)
    await flush()
    expect(started).toEqual([1])
    fail(new Error('no adapter'))
    await expect(one).rejects.toThrow('no adapter')
    await expect(two).resolves.toBe(2)
    expect(started).toEqual([1, 2])
  })
})

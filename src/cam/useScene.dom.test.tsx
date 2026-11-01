import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { rngFor } from '../core/rng'
import { SHELVES, rollPool } from './looks'
import { CLEAN } from './scene'
import { STEP_GAP_MS } from './undo'
import { useScene } from './useScene'

import type { Scene } from './scene'
import type { Board } from './useCamEngine'

const FIRST: Scene = {
  ...CLEAN,
  look: { name: 'pictureSearch', strength: 1, rolled: false },
  mix: null,
  keyHue: null,
}

let clock = 0
const later = (ms: number) => {
  clock += ms
}

const mount = (seed = 1) => {
  const boards: Board[] = []
  const holdA = vi.fn<(on: boolean) => void>()
  const hook = renderHook(() =>
    useScene(
      () => FIRST,
      { showBoard: b => boards.push(b), slice: () => 1, holdA },
      rngFor(seed),
    ),
  )
  return { hook, boards, holdA }
}

beforeEach(() => {
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the camera scene', () => {
  it('undoes back to the look that was up, and lands it on the engine', () => {
    const { hook, boards } = mount()
    act(() => hook.result.current.pick('trackingBand'))
    later(STEP_GAP_MS + 1)
    act(() => hook.result.current.pick('wornTape'))
    expect(hook.result.current.canUndo).toBe(true)
    act(() => {
      hook.result.current.undo()
    })
    expect(hook.result.current.scene.look?.name).toBe('trackingBand')
    expect(hook.result.current.now().look?.name).toBe('trackingBand')
    expect(boards).toHaveLength(3)
  })

  it('undoes a drag whole', () => {
    const { hook } = mount()
    later(STEP_GAP_MS + 1)
    for (const w of [0.2, 0.4, 0.6]) {
      act(() => hook.result.current.weigh('trackingBand', w))
      later(50)
    }
    expect(hook.result.current.scene.layers).toEqual({ trackingBand: 0.6 })
    act(() => {
      hook.result.current.undo()
    })
    expect(hook.result.current.scene.layers).toEqual({})
    expect(hook.result.current.canUndo).toBe(false)
  })

  it('takes a chip dragged to zero off the stack, and keeps a tuned one', () => {
    const { hook } = mount()
    act(() => hook.result.current.weigh('trackingBand', 0.5))
    act(() => hook.result.current.weigh('trackingBand', 0))
    expect(hook.result.current.scene.layers).toEqual({})
    act(() => hook.result.current.layer('trackingBand', 0))
    expect(hook.result.current.scene.layers).toEqual({ trackingBand: 0 })
  })

  it('rolls the same scene from the same seed', () => {
    const pool = rollPool(SHELVES[0]!)
    const rolled = (seed: number) => {
      const { hook } = mount(seed)
      for (let i = 0; i < 4; i++) act(() => hook.result.current.roll(pool))
      return hook.result.current.now()
    }
    expect(rolled(3)).toEqual(rolled(3))
  })

  it('holds A while the chroma keyer is on', () => {
    const { hook, holdA } = mount()
    act(() => hook.result.current.paint({ keyHue: 120 }))
    act(() => hook.result.current.paint({ keyHue: 200 }))
    act(() => hook.result.current.mixWith(null))
    expect(holdA.mock.calls).toEqual([[true], [false]])
  })
})

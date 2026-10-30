import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useZoom } from './useZoom'

import type { Lens } from './zoom'

// A camera with a 1× to 5× lens, whose first zoom is answered by hand.
const camera = () => {
  let answer = () => {}
  const applyConstraints = vi.fn<Lens['applyConstraints']>(
    () =>
      new Promise<void>(resolve => {
        answer = resolve
      }),
  )
  const capabilities: MediaTrackCapabilities = {}
  Reflect.set(capabilities, 'zoom', { min: 1, max: 5 })
  const lens: Lens = { applyConstraints, getCapabilities: () => capabilities }
  return { lens, applyConstraints, answer: () => answer() }
}

const zoomOf = (c: MediaTrackConstraints | undefined) =>
  Reflect.get(c?.advanced?.[0] ?? {}, 'zoom')

describe('the lens zoom across a flip', () => {
  it('sends a zoom asked after the flip to the new camera', async () => {
    const before = camera()
    const after = camera()
    let on = before
    const { result } = renderHook(() =>
      useZoom(() => on.lens, vi.fn(), vi.fn()),
    )
    act(() => result.current.reset())
    act(() => result.current.set(2))
    act(() => result.current.set(4))
    on = after
    act(() => result.current.reset())
    act(() => result.current.set(3))
    await act(async () => before.answer())

    expect(before.applyConstraints).toHaveBeenCalledTimes(1)
    expect(after.applyConstraints).toHaveBeenCalledTimes(1)
    expect(zoomOf(after.applyConstraints.mock.calls[0]![0])).toBe(3)
  })

  it('drops a zoom the camera before the flip was still waiting on', async () => {
    const before = camera()
    const after = camera()
    let on = before
    const { result } = renderHook(() =>
      useZoom(() => on.lens, vi.fn(), vi.fn()),
    )
    act(() => result.current.reset())
    act(() => result.current.set(2))
    act(() => result.current.set(4))
    on = after
    act(() => result.current.reset())
    await act(async () => before.answer())

    expect(after.applyConstraints).not.toHaveBeenCalled()
    expect(result.current.zoom).toBe(1)
  })
})

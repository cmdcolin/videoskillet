import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dropLoop, playLoop } from './tape'
import { useSourceA } from './useSourceA'

vi.mock('./tape', () => ({ dropLoop: vi.fn(), playLoop: vi.fn() }))

// A promise the test settles by hand.
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
})

const mount = () => {
  const showVideo = vi.fn()
  const showPattern = vi.fn()
  const { result } = renderHook(() =>
    useSourceA({ showVideo, showPattern }, vi.fn()),
  )
  return { showVideo, srcA: () => result.current }
}

const slowClip = () => {
  const video = deferred<HTMLVideoElement>()
  vi.mocked(playLoop).mockReturnValueOnce(video.promise)
  return () => video.resolve(document.createElement('video'))
}

describe('picks on A that overlap', () => {
  it('shows a clip picked last', async () => {
    const arrive = slowClip()
    const { showVideo, srcA } = mount()
    const clip = srcA().toClip(new File([''], 'a.mp4'))
    arrive()
    expect(await act(() => clip)).toBe(true)
    expect(showVideo).toHaveBeenCalled()
    expect(srcA().on).toBe('clip')
  })

  it('lets go of a clip that loads after the camera was picked', async () => {
    const arrive = slowClip()
    const { showVideo, srcA } = mount()
    const clip = srcA().toClip(new File([''], 'a.mp4'))
    srcA().cameraPicked()
    arrive()
    expect(await act(() => clip)).toBe(false)
    expect(showVideo).not.toHaveBeenCalled()
    expect(dropLoop).toHaveBeenCalled()
    expect(srcA().on).toBe('camera')
  })

  it('lets go of a clip that loads after a pattern was picked', async () => {
    const arrive = slowClip()
    const { showVideo, srcA } = mount()
    const clip = srcA().toClip(new File([''], 'a.mp4'))
    act(() => srcA().toPattern('bars'))
    arrive()
    expect(await act(() => clip)).toBe(false)
    expect(showVideo).not.toHaveBeenCalled()
    expect(srcA().on).toBe('bars')
  })

  // The file picker sends the page to the background, and the camera may be
  // reopened on the way back while the clip is still loading.
  it('shows a clip whose load a camera coming back overlapped', async () => {
    const arrive = slowClip()
    const { showVideo, srcA } = mount()
    const clip = srcA().toClip(new File([''], 'a.mp4'))
    act(() => srcA().cameraShown())
    arrive()
    expect(await act(() => clip)).toBe(true)
    expect(showVideo).toHaveBeenCalled()
    expect(srcA().on).toBe('clip')
  })
})

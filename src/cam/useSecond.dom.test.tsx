import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dropLoop, playLoop, relayCamera } from './tape'
import { useSecond } from './useSecond'

import type { OtherAnswer } from './dual'
import type { Relay } from './tape'
import type { Opened } from './useCamera'

vi.mock('./tape', () => ({
  TAPE_SECONDS: 4,
  dropLoop: vi.fn(),
  playLoop: vi.fn(),
  recordTape: vi.fn(),
  relayCamera: vi.fn(),
}))

const DUAL_STORE = 'videoskillet_cam_dual'

const relay = (): Relay => ({
  video: document.createElement('video'),
  stop: vi.fn(),
})

const file = () => new File([''], 'clip.mp4')

const mount = (answer: OtherAnswer<Opened> = { kind: 'refused' }) => {
  const openOther = vi.fn(() => Promise.resolve(answer))
  const onError = vi.fn()
  const camera = {
    video: document.createElement('video'),
    mirror: false,
    crop: 1,
  }
  const { result } = renderHook(() =>
    useSecond(
      {
        camera: () => camera,
        showSecond: vi.fn(),
        layoutNow: () => 'whole',
      },
      { openOther, adopt: () => null },
      onError,
      null,
    ),
  )
  return { openOther, onError, second: () => result.current }
}

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

describe('the second camera on B', () => {
  it('asks again after a refusal that left the first camera running', async () => {
    const { openOther, second } = mount({ kind: 'refused' })
    await act(() => second().load())
    await act(() => second().load())
    expect(openOther).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(DUAL_STORE)).toBeNull()
  })

  it('asks again after an ask a newer one superseded', async () => {
    const { openOther, second } = mount({ kind: 'superseded' })
    await act(() => second().load())
    await act(() => second().load())
    expect(openOther).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(DUAL_STORE)).toBeNull()
  })

  it('stops asking a phone that runs one camera at a time', async () => {
    const { openOther, second } = mount({ kind: 'oneAtATime' })
    await act(() => second().load())
    await act(() => second().load())
    expect(openOther).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(DUAL_STORE)).toBe('no')
  })
})

describe('picks on B that overlap', () => {
  it('lets go of a clip that loads after the camera went on B', async () => {
    const video = deferred<HTMLVideoElement>()
    const clipRelay = relay()
    const sameRelay = relay()
    vi.mocked(playLoop).mockReturnValueOnce(video.promise)
    vi.mocked(relayCamera)
      .mockResolvedValueOnce(sameRelay)
      .mockResolvedValueOnce(clipRelay)
    const { second } = mount()

    const clip = second().loadClip(file())
    expect(await act(() => second().loadSame())).toBe('shown')
    video.resolve(document.createElement('video'))
    expect(await act(() => clip)).toBe('superseded')

    expect(second().kind).toBe('same')
    expect(clipRelay.stop).toHaveBeenCalled()
    expect(dropLoop).toHaveBeenCalled()
    expect(sameRelay.stop).not.toHaveBeenCalled()
  })

  it('keeps a pattern picked while a clip was loading', async () => {
    const video = deferred<HTMLVideoElement>()
    const clipRelay = relay()
    vi.mocked(playLoop).mockReturnValueOnce(video.promise)
    vi.mocked(relayCamera).mockResolvedValueOnce(clipRelay)
    const { second } = mount()

    const clip = second().loadClip(file())
    act(() => second().loadPattern('bars'))
    video.resolve(document.createElement('video'))
    expect(await act(() => clip)).toBe('superseded')

    expect(second().pattern).toBe('bars')
    expect(clipRelay.stop).toHaveBeenCalled()
  })

  it('says nothing of a superseded clip that fails', async () => {
    const video = deferred<HTMLVideoElement>()
    vi.mocked(playLoop).mockReturnValueOnce(video.promise)
    const { second, onError } = mount()

    const clip = second().loadClip(file())
    act(() => second().loadPattern('bars'))
    video.reject(new Error('unplayable'))
    expect(await act(() => clip)).toBe('superseded')

    expect(onError).not.toHaveBeenCalled()
    expect(second().pattern).toBe('bars')
  })

  it('turns away a second press while the camera is being laid', async () => {
    const laid = deferred<Relay>()
    const first = relay()
    vi.mocked(relayCamera).mockReturnValueOnce(laid.promise)
    const { second } = mount()

    const press = second().loadSame()
    expect(await act(() => second().loadSame())).toBe('superseded')
    laid.resolve(first)
    expect(await act(() => press)).toBe('shown')
    expect(second().kind).toBe('same')
    expect(first.stop).not.toHaveBeenCalled()
  })
})

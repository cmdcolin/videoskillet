import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { useSharedMedia } from './useSharedMedia'

// A file the share sheet parked is loaded once, however the hook's arguments
// change while the take is in flight. Each cache call yields, as the real Cache
// API does, so two takes can both find the file before either deletes it.
function parkOne() {
  const entries = new Map([
    [
      'shared-media',
      new Response('clip', { headers: { 'x-share-name': 'a.mp4' } }),
    ],
  ])
  const yieldThen = <T,>(v: () => T) =>
    new Promise<T>(resolve => setTimeout(() => resolve(v()), 0))
  const key = (url: string) => url.slice(url.lastIndexOf('/') + 1)
  vi.stubGlobal('caches', {
    open: () =>
      yieldThen(() => ({
        match: (url: string) => yieldThen(() => entries.get(key(url))?.clone()),
        delete: (url: string) => yieldThen(() => entries.delete(key(url))),
      })),
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})

const settle = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 20))
  })

test('a new onFile while the take is in flight does not load the file twice', async () => {
  parkOne()
  history.replaceState(null, '', '/?shared')
  const got: string[] = []
  const onError = vi.fn()
  const { rerender } = renderHook(
    ({ ready, onFile }) => useSharedMedia(ready, onFile, onError),
    {
      initialProps: { ready: true, onFile: (f: File) => void got.push(f.name) },
    },
  )
  rerender({ ready: true, onFile: f => void got.push(f.name) })
  rerender({ ready: false, onFile: f => void got.push(f.name) })
  rerender({ ready: true, onFile: f => void got.push(f.name) })
  await settle()
  expect(got).toEqual(['a.mp4'])
  expect(onError).not.toHaveBeenCalled()
  expect(location.search).toBe('')
})

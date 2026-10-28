import { afterEach, expect, test, vi } from 'vitest'

import { timed } from './pool'

const hangUntilAborted = (_url: string, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(init.signal!.reason as Error)
    })
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a stalled request rejects naming what timed out', async () => {
  vi.stubGlobal('fetch', vi.fn(hangUntilAborted))
  await expect(timed('https://x.test/', 20, 'Wikipedia')).rejects.toThrow(
    'Wikipedia timed out after 0s',
  )
})

test("the caller's signal cancels the request before the deadline", async () => {
  vi.stubGlobal('fetch', vi.fn(hangUntilAborted))
  const ctl = new AbortController()
  const pending = timed('https://x.test/', 60_000, 'Wikipedia', ctl.signal)
  ctl.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})

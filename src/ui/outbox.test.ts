import { describe, expect, it } from 'vitest'

import { singleFlight } from './outbox'

describe('singleFlight', () => {
  it('sends once at a time, and once more for what arrived mid-flight', async () => {
    const calls: string[] = []
    let running = 0
    let overlapped = false
    let release = () => {}
    const send = singleFlight(async who => {
      calls.push(who)
      running++
      if (running > 1) overlapped = true
      await new Promise<void>(r => {
        release = r
      })
      running--
    })
    const first = send('me')
    void send('me')
    void send('you')
    expect(calls).toEqual(['me'])
    release()
    await new Promise(r => setTimeout(r, 0))
    expect(calls).toEqual(['me', 'you'])
    release()
    await first
    expect(calls).toEqual(['me', 'you'])
    expect(overlapped).toBe(false)
  })

  it('keeps sending after a send that failed', async () => {
    let calls = 0
    const send = singleFlight(() => {
      calls++
      return Promise.reject(new Error('offline'))
    })
    await send('me')
    await send('me')
    expect(calls).toBe(2)
  })
})

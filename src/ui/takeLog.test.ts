import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearTake,
  noteTake,
  reportLostTake,
  reportTakeFailed,
} from './takeLog'

import type { TakeNote } from './takeLog'

const NOTE: TakeNote = {
  page: '/cam/',
  width: 822,
  height: 1096,
  fps: 30,
  codec: 'avc1.64001f',
  hardware: 'no',
  seconds: 7,
  frames: 210,
  held: 40,
  deepest: 3,
  stage: 'recording',
  hidden: false,
}

const settle = () => new Promise(r => setTimeout(r, 0))

describe('takeLog', () => {
  const gtag = vi.fn()

  beforeEach(() => {
    gtag.mockReset()
    vi.stubGlobal('window', { gtag })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports nothing when no take was left behind', async () => {
    reportLostTake()
    await settle()
    expect(gtag).not.toHaveBeenCalled()
  })

  it('reports a take a crashed page left, once', async () => {
    noteTake(NOTE)
    reportLostTake()
    reportLostTake()
    await settle()
    expect(gtag).toHaveBeenCalledTimes(1)
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'take_lost',
      expect.objectContaining({ codec: 'avc1.64001f', frames: 210 }),
    )
  })

  it('forgets a take that finished', async () => {
    noteTake(NOTE)
    clearTake()
    reportLostTake()
    await settle()
    expect(gtag).not.toHaveBeenCalled()
  })

  it('clears a lost take without analytics, and sends nothing', async () => {
    vi.stubGlobal('window', {})
    noteTake(NOTE)
    reportLostTake()
    vi.stubGlobal('window', { gtag })
    reportLostTake()
    await settle()
    expect(gtag).not.toHaveBeenCalled()
  })

  it('cuts a failure message to what GA keeps', async () => {
    reportTakeFailed('x'.repeat(300), NOTE)
    await settle()
    const [, event, params] = gtag.mock.calls[0]
    expect(event).toBe('take_failed')
    expect(params.message).toHaveLength(100)
    expect(params.stage).toBe('recording')
  })
})

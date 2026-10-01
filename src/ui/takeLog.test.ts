import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const putTakeReport = vi.hoisted(() => vi.fn())
vi.mock('./cloud', () => ({ putTakeReport }))

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
    putTakeReport.mockReset()
    vi.stubGlobal('window', { gtag })
    localStorage.setItem('videoskillet_analytics', 'yes')
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
    expect(putTakeReport).toHaveBeenCalledTimes(1)
    expect(putTakeReport).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'lost', frames: 210, hidden: false }),
    )
  })

  it('sends only the fields the rule admits', async () => {
    localStorage.setItem(
      'videoskillet_take',
      JSON.stringify({ ...NOTE, extra: 1, frames: 'many' }),
    )
    reportLostTake()
    await settle()
    const [sent] = putTakeReport.mock.calls[0]
    expect(sent).not.toHaveProperty('extra')
    expect(sent).not.toHaveProperty('frames')
    expect(sent.codec).toBe('avc1.64001f')
  })

  it('forgets a take that finished', async () => {
    noteTake(NOTE)
    clearTake()
    reportLostTake()
    await settle()
    expect(gtag).not.toHaveBeenCalled()
  })

  it('clears a lost take without analytics, and sends nothing', async () => {
    localStorage.setItem('videoskillet_analytics', 'no')
    noteTake(NOTE)
    reportLostTake()
    localStorage.setItem('videoskillet_analytics', 'yes')
    reportLostTake()
    await settle()
    expect(gtag).not.toHaveBeenCalled()
    expect(putTakeReport).not.toHaveBeenCalled()
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

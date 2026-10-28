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
  encoded: 170,
  chunks: 168,
  bytes: 2_100_000,
  streamed: true,
  coded: '816x1088',
  canvas: '822x1096',
  configs: 1,
  stage: 'recording',
  hidden: false,
}

const settle = () => new Promise(r => setTimeout(r, 0))

describe('takeLog', () => {
  beforeEach(() => {
    putTakeReport.mockReset()
    localStorage.clear()
  })
  afterEach(() => {
    clearTake()
    vi.unstubAllGlobals()
  })

  const sent = () => putTakeReport.mock.calls[0]![0]

  it('reports nothing when no take was left behind', async () => {
    reportLostTake()
    await settle()
    expect(putTakeReport).not.toHaveBeenCalled()
  })

  // A crashed page leaves its note and lets go of its lock.
  it('reports a take a crashed page left, once', async () => {
    localStorage.setItem('videoskillet_take', JSON.stringify(NOTE))
    reportLostTake()
    reportLostTake()
    await settle()
    expect(putTakeReport).toHaveBeenCalledTimes(1)
    expect(putTakeReport).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'lost',
        codec: 'avc1.64001f',
        frames: 210,
        hidden: false,
      }),
    )
  })

  it('sends only the fields the rule admits', async () => {
    localStorage.setItem(
      'videoskillet_take',
      JSON.stringify({ ...NOTE, extra: 1, frames: 'many' }),
    )
    reportLostTake()
    await settle()
    expect(sent()).not.toHaveProperty('extra')
    expect(sent()).not.toHaveProperty('frames')
    expect(sent().codec).toBe('avc1.64001f')
  })

  it('forgets a take that finished', async () => {
    noteTake(NOTE)
    clearTake()
    reportLostTake()
    await settle()
    expect(putTakeReport).not.toHaveBeenCalled()
  })

  describe('with another tab recording', () => {
    const locks = (names: string[]) => {
      const requested: { name: string; mode?: string; done: Promise<void> }[] =
        []
      vi.stubGlobal('navigator', {
        locks: {
          request: (
            name: string,
            opts: { mode?: string },
            body: () => Promise<void>,
          ) => {
            const done = body()
            requested.push({ name, mode: opts.mode, done })
            return done
          },
          query: () => Promise.resolve({ held: names.map(name => ({ name })) }),
        },
      })
      return requested
    }

    it('leaves the note that tab is writing', async () => {
      locks(['videoskillet_take'])
      noteTake(NOTE)
      reportLostTake()
      await settle()
      expect(putTakeReport).not.toHaveBeenCalled()
      expect(localStorage.getItem('videoskillet_take')).not.toBeNull()
    })

    it('holds a shared lock while recording and lets go when done', async () => {
      const requested = locks([])
      noteTake(NOTE)
      noteTake(NOTE)
      expect(requested).toHaveLength(1)
      expect(requested[0]).toMatchObject({
        name: 'videoskillet_take',
        mode: 'shared',
      })
      let released = false
      void requested[0]!.done.then(() => {
        released = true
      })
      clearTake()
      await settle()
      expect(released).toBe(true)
    })
  })

  it('cuts a failure message to what the rule admits', async () => {
    reportTakeFailed('x'.repeat(300), NOTE)
    await settle()
    expect(sent().kind).toBe('failed')
    expect(sent().message).toHaveLength(100)
    expect(sent().stage).toBe('recording')
  })

  it('carries what the encoder got through and its error name', async () => {
    reportTakeFailed('Encoding error.', { ...NOTE, error: 'OperationError' })
    await settle()
    expect(sent()).toMatchObject({
      encoded: 170,
      chunks: 168,
      coded: '816x1088',
      canvas: '822x1096',
      configs: 1,
      error: 'OperationError',
    })
  })
})

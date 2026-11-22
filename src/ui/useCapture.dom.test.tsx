// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FrameSink } from '../core/gpu/frameread'
import type { Recorder } from './record'
import type { TakeNote } from './takeLog'

const log = vi.hoisted(() => ({
  noteTake: vi.fn<(note: TakeNote) => void>(),
  clearTake: vi.fn(),
  reportLostTake: vi.fn(),
  reportTakeFailed: vi.fn(),
  reportTakeRescued: vi.fn<(note: TakeNote) => void>(),
  takeLive: vi.fn(() => Promise.resolve(false)),
}))
vi.mock('./takeLog', () => log)
vi.mock('./takeSink', () => ({ sweepTakes: () => Promise.resolve(0) }))

const recorder = vi.hoisted(() => ({ current: null as Recorder | null }))
vi.mock('./record', () => ({
  isSupported: () => true,
  startRecording: () => Promise.resolve(recorder.current),
}))

import { useCapture } from './useCapture'

function fakeRecorder() {
  let frames = 0
  let encoded = 0
  let placed = 0
  const rec: Recorder = {
    codec: 'avc1.640032',
    hardware: false,
    clock: 'audio',
    frame: () => {
      frames++
      encoded++
    },
    place: frame => {
      placed++
      encoded++
      frames++
      frame.close()
    },
    full: () => false,
    busy: () => false,
    hold: () => {
      frames++
    },
    finish: () => Promise.resolve(new Blob()),
    abort: () => {},
    frames: () => frames,
    placed: () => placed,
    held: () => 0,
    deepest: () => 0,
    encoded: () => encoded,
    chunks: () => encoded,
    bytes: () => 0,
    streamed: () => true,
    coded: () => '',
    configs: () => 0,
    error: () => '',
    errorName: () => '',
    fallback: () => null,
  }
  return rec
}

// An engine that renders a frame per refresh and, when `feeds`, hands each to
// the take.
// `throws` makes each render fail before it counts the frame, as a render
// that throws under the loop does.
function fakeEngine(feeds: boolean, attachFails = false, throws = false) {
  let frame = 0
  let errors = 0
  let sink: FrameSink | null = null
  return {
    setFrameSink: vi.fn((next: FrameSink | null) => {
      if (attachFails && next !== null) throw new Error('usage refused')
      sink = next
    }),
    frameNo: () => frame,
    getStats: () => ({ fps: 59.7, lock: 1 }),
    renderHealth: () => ({
      throttled: false,
      errors,
      error: errors === 0 ? '' : 'getCurrentTexture refused',
    }),
    render: () => {
      if (throws) {
        errors++
      } else {
        frame++
        if (feeds && sink !== null)
          sink.frame(
            new VideoFrame(new Uint8Array(4), {
              format: 'RGBX',
              codedWidth: 1,
              codedHeight: 1,
              timestamp: 0,
            }),
            0,
          )
      }
    },
  }
}

const canvas = () => {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 360
  return c
}

const take = (engine: () => ReturnType<typeof fakeEngine> | null) =>
  renderHook(() =>
    useCapture({ current: canvas() }, 'test', () => {}, undefined, {
      engine,
    }),
  )

// Advance by whole refreshes, rendering the engine on each.
const refreshes = async (
  n: number,
  engine: ReturnType<typeof fakeEngine> | null = null,
) => {
  for (let i = 0; i < n; i++) {
    engine?.render()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16)
    })
  }
}

const start = async (result: { current: { toggleRecord: () => void } }) => {
  await act(async () => {
    result.current.toggleRecord()
    await Promise.resolve()
  })
}

describe('useCapture, a live take', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
      ],
    })
    vi.stubGlobal(
      'VideoFrame',
      class {
        closed = false
        close() {
          this.closed = true
        }
      },
    )
    recorder.current = fakeRecorder()
    for (const f of Object.values(log)) f.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const rescued = () => log.reportTakeRescued.mock.calls[0]?.[0]

  it('keeps reading the engine while it delivers', async () => {
    const engine = fakeEngine(true)
    const { result } = take(() => engine)
    await start(result)
    await refreshes(90, engine)
    expect(log.reportTakeRescued).not.toHaveBeenCalled()
    expect(recorder.current?.placed()).toBeGreaterThan(80)
  })

  it('reads the canvas when an attached engine sends nothing', async () => {
    const engine = fakeEngine(false)
    const { result } = take(() => engine)
    await start(result)
    await refreshes(90, engine)
    expect(rescued()).toMatchObject({
      readback: 'canvas',
      attached: 1,
      placed: 0,
    })
    expect(rescued()?.rendered).toBeGreaterThan(50)
    expect(rescued()).toMatchObject({
      engineFps: 60,
      throttled: false,
      renderErrors: 0,
    })
    expect(rescued()?.renderError).toBeUndefined()
    expect(engine.setFrameSink).toHaveBeenLastCalledWith(
      null,
      expect.anything(),
    )
    expect(recorder.current?.encoded()).toBeGreaterThan(0)
  })

  it('says when the engine rendered nothing because its renders threw', async () => {
    const engine = fakeEngine(true, false, true)
    const { result } = take(() => engine)
    await start(result)
    await refreshes(90, engine)
    expect(rescued()).toMatchObject({
      readback: 'canvas',
      attached: 1,
      rendered: 0,
      placed: 0,
      renderError: 'getCurrentTexture refused',
    })
    expect(rescued()?.renderErrors).toBeGreaterThan(50)
  })

  it('reads the canvas when no engine is there to attach', async () => {
    const { result } = take(() => null)
    await start(result)
    await refreshes(90)
    expect(rescued()).toMatchObject({ readback: 'canvas', attached: 0 })
    expect(recorder.current?.encoded()).toBeGreaterThan(0)
  })

  it('reads the canvas at once, and keeps pumping, when attaching throws', async () => {
    const engine = fakeEngine(true, true)
    const { result } = take(() => engine)
    await start(result)
    expect(rescued()).toMatchObject({
      readback: 'canvas',
      attached: 0,
      readError: 'attach: usage refused',
    })
    await refreshes(30, engine)
    expect(recorder.current?.encoded()).toBeGreaterThan(20)
    expect(result.current.recording).toBe(true)
  })
  it('carries on from the frames it has when a replacement engine will not attach', async () => {
    const first = fakeEngine(true)
    const second = fakeEngine(true, true)
    let current = first
    const { result } = take(() => current)
    await start(result)
    await refreshes(60, first)
    const before = recorder.current?.encoded() ?? 0
    current = second
    await refreshes(10, second)
    expect(rescued()).toMatchObject({
      readback: 'canvas',
      attached: 1,
      readError: 'attach: usage refused',
    })
    expect((recorder.current?.encoded() ?? 0) - before).toBeGreaterThan(5)
  })
})

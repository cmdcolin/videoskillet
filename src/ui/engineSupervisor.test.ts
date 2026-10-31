import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EngineBuildError } from '../core/gpu/pipeline'
import {
  CREATE_RETRY_MS,
  CREATE_TRIES,
  superviseEngine,
} from './engineSupervisor'
import { MAX_REBUILDS } from './rebuildPolicy'

import type { Engine } from '../core/gpu/pipeline'
import type { Supervision } from './engineSupervisor'

vi.mock('../core/gpu/pipeline', () => ({
  Engine: { create: vi.fn() },
  EngineBuildError: class extends Error {},
}))
vi.mock('../core/gpu/trace', () => ({
  trace: { add: () => {}, flush: () => {} },
}))

interface Fake {
  onDeviceLost: (m: string) => void
  onHang: () => void
  onFrozen: (f: unknown) => void
  gpuConfirmed: boolean
  audioState: { close: ReturnType<typeof vi.fn> }
  destroy: ReturnType<typeof vi.fn>
}

const fake = (gpuConfirmed = true): Fake => ({
  onDeviceLost: () => {},
  onHang: () => {},
  onFrozen: () => {},
  gpuConfirmed,
  audioState: { close: vi.fn() },
  destroy: vi.fn(),
})

const flush = () => new Promise(r => setTimeout(r, 0))

function harness(made: (Fake | Error)[]) {
  const live: Fake[] = []
  const s = {
    adopt: vi.fn((created: Engine) => live.push(created as unknown as Fake)),
    onRebuilding: vi.fn(),
    onFrozen: vi.fn(),
    onFatal: vi.fn(),
    create: vi.fn(() => {
      const next = made.shift() ?? fake()
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next as unknown as Engine)
    }),
  } satisfies Supervision
  const stop = superviseEngine({} as HTMLCanvasElement, s)
  return { s, live, stop }
}

beforeEach(() => {
  vi.stubGlobal('window', new EventTarget())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('superviseEngine', () => {
  it('replaces a lost engine and clears a stale freeze', async () => {
    const { s, live } = harness([])
    await flush()
    live[0]!.onDeviceLost('reset')
    expect(live[0]!.destroy).toHaveBeenCalledWith({ keepAudio: true })
    expect(s.onRebuilding).toHaveBeenLastCalledWith('lost')
    await flush()
    expect(s.adopt).toHaveBeenLastCalledWith(live[1], live[0])
    expect(s.onRebuilding).toHaveBeenLastCalledWith(null)
    expect(s.onFrozen).toHaveBeenLastCalledWith(null)
    expect(live[0]!.audioState.close).not.toHaveBeenCalled()
  })

  it('ignores a late fault from an engine already replaced', async () => {
    const { s, live } = harness([])
    await flush()
    live[0]!.onDeviceLost('reset')
    await flush()
    live[0]!.onHang()
    expect(s.onRebuilding).toHaveBeenCalledTimes(2)
  })

  it('keeps forgiving hangs on devices that had worked', async () => {
    const { s, live } = harness([])
    await flush()
    for (let i = 0; i <= MAX_REBUILDS + 1; i++) {
      live.at(-1)!.onHang()
      await flush()
    }
    expect(s.onFatal).not.toHaveBeenCalled()
  })

  it('gives up on hangs from devices that never completed work', async () => {
    const made = Array.from({ length: MAX_REBUILDS + 2 }, () => fake(false))
    const { s, live } = harness(made)
    await flush()
    for (let i = 0; i <= MAX_REBUILDS; i++) {
      live.at(-1)!.onHang()
      await flush()
    }
    expect(s.onFatal).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'hung' }),
    )
    expect(live.at(-1)!.audioState.close).toHaveBeenCalled()
  })

  it('starts no rebuild behind the fatal screen', async () => {
    const made = Array.from({ length: MAX_REBUILDS + 2 }, () => fake(false))
    const { s, live } = harness(made)
    await flush()
    for (let i = 0; i <= MAX_REBUILDS; i++) {
      live.at(-1)!.onHang()
      await flush()
    }
    const builds = s.create.mock.calls.length
    live.at(-1)!.onDeviceLost('gone')
    await flush()
    expect(s.create).toHaveBeenCalledTimes(builds)
    expect(live.at(-1)!.destroy).not.toHaveBeenCalled()
  })

  it('retries a failed create before giving up', async () => {
    vi.useFakeTimers()
    const fails = Array.from(
      { length: CREATE_TRIES },
      () => new Error('no adapter'),
    )
    const { s, live } = harness([fake(), ...fails])
    await vi.advanceTimersByTimeAsync(0)
    live[0]!.onDeviceLost('')
    await vi.advanceTimersByTimeAsync(CREATE_RETRY_MS * CREATE_TRIES)
    expect(s.create).toHaveBeenCalledTimes(1 + CREATE_TRIES)
    expect(s.onFatal).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'lost' }),
    )
    expect(live[0]!.audioState.close).toHaveBeenCalled()
  })

  it('closes the kept audio graph when torn down mid-rebuild', async () => {
    vi.useFakeTimers()
    const { s, live, stop } = harness([fake(), new Error('no adapter')])
    await vi.advanceTimersByTimeAsync(0)
    live[0]!.onDeviceLost('')
    await vi.advanceTimersByTimeAsync(0)
    expect(live[0]!.audioState.close).not.toHaveBeenCalled()
    stop()
    expect(live[0]!.audioState.close).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(CREATE_RETRY_MS * CREATE_TRIES)
    expect(s.create).toHaveBeenCalledTimes(2)
  })

  it('names a pipeline the browser rejects', async () => {
    const { s } = harness([new EngineBuildError('bad shader')])
    await flush()
    expect(s.onFatal).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'build' }),
    )
  })

  it('hands the device on at teardown and lets it go on pagehide', async () => {
    const a = harness([])
    await flush()
    a.stop()
    expect(a.live[0]!.destroy).toHaveBeenCalledWith({ keepDevice: true })

    const b = harness([])
    await flush()
    window.dispatchEvent(new Event('pagehide'))
    expect(b.live[0]!.destroy).toHaveBeenCalledWith()
  })

  it('hands on the device of an engine created after the teardown', async () => {
    const late = fake()
    const { stop } = harness([late])
    stop()
    await flush()
    expect(late.destroy).toHaveBeenCalledWith({ keepDevice: true })
  })

  it('lets go of the device of an engine created after pagehide', async () => {
    const late = fake()
    harness([late])
    window.dispatchEvent(new Event('pagehide'))
    await flush()
    expect(late.destroy).toHaveBeenCalledWith({ keepDevice: false })
  })
})

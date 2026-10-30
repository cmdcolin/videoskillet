import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useEngine } from './useEngine'

// A link's `?speeda=` and `?speedb=` have to reach the elements its `?vurl=`
// and `?vurlb=` load: a take reads the deck's speed off the element's
// playbackRate (videopump.ts), and so does the browser.

const deep = (): unknown =>
  new Proxy(() => undefined, {
    get: (_t, k) => (k === 'then' ? undefined : deep()),
  })

const engine = {
  getDbgView: () => 0,
  getStats: () => ({ fps: 0 }),
  subscribeStats: () => () => {},
}

vi.mock('../core/gpu/pipeline', () => ({
  EngineBuildError: class extends Error {},
  Engine: {
    create: () =>
      Promise.resolve(
        new Proxy(engine, {
          get: (t, k) =>
            k in t ? t[k as keyof typeof t] : k === 'then' ? undefined : deep(),
        }),
      ),
  },
}))

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = () => {}
    unobserve = () => {}
    disconnect = () => {}
  },
)
vi.stubGlobal(
  'OffscreenCanvas',
  class {
    getContext() {
      return deep()
    }
  },
)
vi.stubGlobal(
  'ImageData',
  class {
    constructor(readonly data: Uint8ClampedArray) {}
  },
)
vi.stubGlobal(
  'MediaStream',
  class {
    getTracks = () => []
  },
)
vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined)

function Harness() {
  const { canvasRef } = useEngine({ rand: Math.random })
  return <canvas ref={canvasRef} />
}

const clips: HTMLVideoElement[] = []
const make = document.createElement.bind(document)
vi.spyOn(document, 'createElement').mockImplementation(
  (tag: string, opts?: ElementCreationOptions) => {
    const el = make(tag, opts)
    if (el instanceof HTMLVideoElement) clips.push(el)
    return el
  },
)

async function boot(search: string) {
  clips.length = 0
  history.replaceState(null, '', `/app/${search}`)
  render(<Harness />)
  await act(async () => {
    await new Promise(r => setTimeout(r, 0))
  })
}

const clip = (name: string) => {
  const el = clips.find(v => v.src.endsWith(name))
  if (el === undefined) throw new Error(`no element loaded ${name}`)
  return el
}

afterEach(cleanup)

describe('a link with a clip and a speed', () => {
  test('plays each deck at the speed the link names', async () => {
    await boot('?vurl=a.mp4&speeda=0.39&vurlb=b.mp4&speedb=1.5')
    expect(clip('a.mp4').playbackRate).toBe(0.39)
    expect(clip('a.mp4').defaultPlaybackRate).toBe(0.39)
    expect(clip('b.mp4').playbackRate).toBe(1.5)
    expect(clip('b.mp4').defaultPlaybackRate).toBe(1.5)
  })

  test('plays at 1 when the link names no speed', async () => {
    await boot('?vurl=a.mp4')
    expect(clip('a.mp4').playbackRate).toBe(1)
  })
})

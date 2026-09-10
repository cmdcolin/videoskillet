import { afterEach, describe, expect, it, vi } from 'vitest'

import { hasBridge } from './bridge'

// The suite runs on bare node, so the document is a stand-in that answers the
// one question `hasBridge` asks: which `<meta name="videoskillet-bridge">` tags
// the page carries. Reading their content is the part under test.
const servedWith = (...contents: string[]): void => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      // `clips.ts` resolves the bundled clip against this on the way in.
      baseURI: 'http://localhost:8787/app/',
      querySelectorAll: (selector: string) =>
        selector.includes('videoskillet-bridge')
          ? contents.map(content => ({ getAttribute: () => content }))
          : [],
    },
  })
}

const servedWithout = (): void => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      baseURI: 'http://localhost:8787/app/',
      querySelectorAll: () => [],
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'document')
  vi.resetModules()
})

describe('hasBridge', () => {
  it('finds a bridge the server named', () => {
    servedWith('ytdlp')
    expect(hasBridge('ytdlp')).toBe(true)
  })

  it('reads the content as a list, so one tag can name several', () => {
    servedWith('ytdlp something-else')
    expect(hasBridge('ytdlp')).toBe(true)
    expect(hasBridge('something-else')).toBe(true)
  })

  it('does not match a name that merely contains the one asked for', () => {
    servedWith('ytdlp-proxy')
    expect(hasBridge('ytdlp')).toBe(false)
  })

  it('says no when the page carries no tag', () => {
    servedWithout()
    expect(hasBridge('ytdlp')).toBe(false)
  })

  // The docs generator imports the source lists through vite's SSR runner,
  // where there is no document at all — and what it wants is the shipped lists,
  // which is what an absent bridge produces.
  it('says no where there is no document', () => {
    expect(hasBridge('ytdlp')).toBe(false)
  })
})

// The gate this exists for: the video-URL source appears when a server says it
// can fetch one, and nowhere else. Re-imported per case because the option
// lists are built once, while the module evaluates.
describe('the source lists behind it', () => {
  it('offer the video-URL source when the server has yt-dlp', async () => {
    servedWith('ytdlp')
    vi.resetModules()
    const { A_OPTIONS, B_OPTIONS } = await import('./modes')
    expect(A_OPTIONS.map(o => o.value)).toContain('youtube')
    expect(B_OPTIONS.map(o => o.value)).toContain('youtube')
  })

  it('drop it when nothing behind the page can run one', async () => {
    servedWithout()
    vi.resetModules()
    const { A_OPTIONS, B_OPTIONS, SHIPPED_MODES } = await import('./modes')
    expect(A_OPTIONS.map(o => o.value)).not.toContain('youtube')
    expect(B_OPTIONS.map(o => o.value)).not.toContain('youtube')
    expect(A_OPTIONS.map(o => o.value)).toEqual([...SHIPPED_MODES])
  })
})

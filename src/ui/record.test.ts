import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { candidatesFor, codecFor, startRecording } from './record'

describe('H.264 level selection', () => {
  it('spells profile and level into the codec string', () => {
    expect(codecFor('6400', 0x32)).toBe('avc1.640032')
    expect(codecFor('4200', 0x2a)).toBe('avc1.42002a')
  })

  it('declines level 4.2 for the retina window that broke recording', () => {
    // 2560x1592 codes as 2560x1600 = 16000 macroblocks, against 4.2's 8704.
    const codecs = candidatesFor(2560, 1592)
    expect(codecs.some(c => c.endsWith('2a'))).toBe(false)
    expect(codecs[0]).toBe('avc1.640032')
  })

  it('asks for High first and keeps the lesser profiles as fallbacks', () => {
    const codecs = candidatesFor(1920, 1080)
    expect(codecs[0]).toBe('avc1.640028')
    expect(codecs).toContain('avc1.4d0028')
    expect(codecs).toContain('avc1.420028')
    expect(codecs.indexOf('avc1.640028')).toBeLessThan(
      codecs.indexOf('avc1.4d0028'),
    )
  })

  it('offers the smallest level that fits before the larger ones', () => {
    expect(candidatesFor(640, 480)[0]).toBe('avc1.64001e')
    expect(candidatesFor(3840, 2160)[0]).toBe('avc1.640033')
  })

  it('has nothing to offer a picture past the top level', () => {
    expect(candidatesFor(16384, 16384)).toEqual([])
  })
})

describe('a live take', () => {
  const encoded: number[] = []
  let refuse = 0
  beforeEach(() => {
    encoded.length = 0
    vi.stubGlobal('location', { search: '' })
    vi.stubGlobal(
      'VideoEncoder',
      class {
        static isConfigSupported = () => Promise.resolve({ supported: true })
        state = 'unconfigured'
        encodeQueueSize = 0
        configure() {
          this.state = 'configured'
        }
        encode(frame: { timestamp: number }) {
          encoded.push(frame.timestamp)
        }
        close() {
          this.state = 'closed'
        }
      },
    )
    vi.stubGlobal(
      'VideoFrame',
      class {
        timestamp: number
        constructor(_: unknown, init: { timestamp: number }) {
          if (refuse > 0) {
            refuse--
            throw new Error('refused')
          }
          this.timestamp = init.timestamp
        }
        closed = false
        close() {
          this.closed = true
        }
      },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const frame = () =>
    new VideoFrame(new Uint8Array(4), {
      format: 'RGBX',
      codedWidth: 1,
      codedHeight: 1,
      timestamp: 0,
    })

  it('starts at its first encoded frame, not at one that threw', async () => {
    const rec = await startRecording({
      width: 64,
      height: 64,
      fps: { num: 60, den: 1 },
      live: true,
    })
    const fresh = frame()
    refuse = 1
    expect(() => rec.place(fresh, 1000)).toThrow('refused')
    rec.place(frame(), 1500)
    rec.place(frame(), 1516.7)
    expect(rec.placed()).toBe(3)
    expect(encoded).toEqual([0, 16667])
    expect(rec.frames()).toBe(2)
    expect(rec.held()).toBe(0)
    rec.abort()
  })
})

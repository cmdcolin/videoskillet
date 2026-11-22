import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { candidatesFor, codecFor, settingsFor, startRecording } from './record'

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

describe('settings a take falls back to', () => {
  it('drops the floor, then variable bitrate, then the unaligned rows', () => {
    const settings = settingsFor(720, 540, 60)
    expect(settings.map(s => s.step)).toEqual([
      '',
      'bitrate',
      'constant',
      'aligned',
    ])
    expect(settings[0]?.bitrate).toBe(16_000_000)
    expect(settings[1]?.bitrate).toBeCloseTo(9_331_200)
    expect(settings[2]?.bitrateMode).toBe('constant')
    expect(settings[3]).toMatchObject({ width: 720, height: 528 })
  })

  it('skips a step that would change nothing', () => {
    expect(settingsFor(1920, 1080, 60).map(s => s.step)).toEqual([
      '',
      'constant',
      'aligned',
    ])
    expect(settingsFor(640, 480, 30).map(s => s.step)).toEqual([
      '',
      'bitrate',
      'constant',
    ])
  })
})

interface EncoderInit {
  output: (chunk: {
    byteLength: number
    type: string
    timestamp: number
    copyTo: () => void
  }) => void
  error: (e: Error) => void
}

describe('a live take', () => {
  const encoded: { timestamp: number; key: boolean; height?: number }[] = []
  let refuse = 0
  // How many encoders fail on their first frame, before any chunk.
  let failing = 0
  let opened = 0
  beforeEach(() => {
    encoded.length = 0
    failing = 0
    opened = 0
    vi.stubGlobal('location', { search: '' })
    vi.stubGlobal(
      'VideoEncoder',
      class {
        static isConfigSupported = () => Promise.resolve({ supported: true })
        state = 'unconfigured'
        encodeQueueSize = 0
        fails = false
        init: EncoderInit
        constructor(init: EncoderInit) {
          this.init = init
          this.fails = failing > 0
          if (failing > 0) failing--
          opened++
        }
        configure() {
          this.state = 'configured'
        }
        encode(
          frame: { timestamp: number; visibleRect?: { height: number } },
          opts: { keyFrame: boolean },
        ) {
          encoded.push({
            timestamp: frame.timestamp,
            key: opts.keyFrame,
            height: frame.visibleRect?.height,
          })
          if (this.fails)
            queueMicrotask(() => {
              this.state = 'closed'
              this.init.error(
                new DOMException('Encoding error.', 'OperationError'),
              )
            })
          else
            this.init.output({
              byteLength: 8,
              type: opts.keyFrame ? 'key' : 'delta',
              timestamp: frame.timestamp,
              copyTo: () => {},
            })
        }
        flush() {
          return Promise.resolve()
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
        visibleRect?: { height: number }
        constructor(
          _: unknown,
          init: { timestamp: number; visibleRect?: { height: number } },
        ) {
          if (refuse > 0) {
            refuse--
            throw new Error('refused')
          }
          this.timestamp = init.timestamp
          this.visibleRect = init.visibleRect
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

  const settle = () => new Promise(r => setTimeout(r, 0))

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
    expect(encoded.map(e => e.timestamp)).toEqual([0, 16667])
    expect(rec.frames()).toBe(2)
    expect(rec.held()).toBe(0)
    rec.abort()
  })

  const start = () =>
    startRecording({ width: 720, height: 540, fps: { num: 60, den: 1 } })

  it('keeps the first encoder while it hands back chunks', async () => {
    const rec = await start()
    rec.frame(frame())
    await settle()
    expect(rec.fallback()).toBeNull()
    expect(opened).toBe(1)
    expect(rec.chunks()).toBe(1)
    rec.abort()
  })

  it('falls back a setting at a time while no chunk has come back', async () => {
    failing = 2
    const rec = await start()
    rec.frame(frame())
    await settle()
    rec.frame(frame())
    await settle()
    rec.hold()
    rec.frame(frame())
    await settle()
    expect(opened).toBe(3)
    expect(rec.error()).toBe('')
    expect(rec.fallback()).toEqual({
      step: 'constant',
      error: 'OperationError: Encoding error.',
    })
    expect(encoded.at(-1)).toMatchObject({ timestamp: 50000, key: true })
    expect(rec.chunks()).toBe(1)
    rec.abort()
  })

  it('crops to a multiple of 16 at the last setting', async () => {
    failing = 3
    const rec = await start()
    for (let i = 0; i < 3; i++) {
      rec.frame(frame())
      await settle()
    }
    rec.frame(frame())
    expect(rec.fallback()?.step).toBe('aligned')
    expect(encoded.at(-1)?.height).toBe(528)
    rec.abort()
  })

  it('fails as before once every setting has failed', async () => {
    failing = 4
    const rec = await start()
    for (let i = 0; i < 4; i++) {
      rec.frame(frame())
      await settle()
    }
    expect(opened).toBe(4)
    expect(rec.error()).toBe('Encoding error.')
    expect(rec.errorName()).toBe('OperationError')
    rec.abort()
  })
})

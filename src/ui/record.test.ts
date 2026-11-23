import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { candidatesFor, codecFor, settingsFor, startRecording } from './record'

describe('H.264 level selection', () => {
  it('spells profile and level into the codec string', () => {
    expect(codecFor('6400', 0x32)).toBe('avc1.640032')
    expect(codecFor('4200', 0x2a)).toBe('avc1.42002a')
  })

  it('declines level 4.2 for the retina window that broke recording', () => {
    // 2560x1592 codes as 2560x1600 = 16000 macroblocks, against 4.2's 8704.
    const codecs = candidatesFor(2560, 1592, 30, 60_000_000)
    expect(codecs.some(c => c.endsWith('2a'))).toBe(false)
    expect(codecs[0]).toBe('avc1.640032')
  })

  it('asks for High first and keeps the lesser profiles as fallbacks', () => {
    const codecs = candidatesFor(1920, 1080, 30, 16_000_000)
    expect(codecs[0]).toBe('avc1.640028')
    expect(codecs).toContain('avc1.4d0028')
    expect(codecs).toContain('avc1.420028')
    expect(codecs.indexOf('avc1.640028')).toBeLessThan(
      codecs.indexOf('avc1.4d0028'),
    )
  })

  it('offers the smallest level that fits before the larger ones', () => {
    expect(candidatesFor(640, 480, 30, 9_000_000)[0]).toBe('avc1.64001e')
    expect(candidatesFor(3840, 2160, 30, 60_000_000)[0]).toBe('avc1.640033')
  })

  it('raises the level for the frame rate and the bitrate', () => {
    // 720x540 is 1530 macroblocks: 91800 a second at 60fps against 3.0's
    // 40500, and 16 Mbps against High 3.0's 12.5.
    expect(candidatesFor(720, 540, 60, 16_000_000)[0]).toBe('avc1.64001f')
    expect(candidatesFor(640, 480, 30, 16_000_000)[0]).toBe('avc1.64001f')
  })

  it('gives High more bitrate at a level than the other profiles', () => {
    const codecs = candidatesFor(1920, 1080, 30, 24_000_000)
    expect(codecs[0]).toBe('avc1.640028')
    expect(codecs).not.toContain('avc1.4d0028')
    expect(codecs).toContain('avc1.4d0029')
  })

  it('tries only the profiles it is given', () => {
    expect(
      candidatesFor(1920, 1080, 30, 16_000_000, ['4200']).every(c =>
        c.startsWith('avc1.4200'),
      ),
    ).toBe(true)
  })

  it('has nothing to offer a picture past the top level', () => {
    expect(candidatesFor(16384, 16384, 30, 16_000_000)).toEqual([])
  })
})

describe('settings a take falls back to', () => {
  it('copies frames to memory, then drops to Baseline, then crops', () => {
    const settings = settingsFor(720, 540)
    expect(settings.map(s => s.step)).toEqual([
      '',
      'memory',
      'baseline',
      'aligned',
    ])
    expect(settings[0]?.memory).toBe(false)
    expect(settings[1]?.memory).toBe(true)
    expect(settings[2]).toMatchObject({ memory: true, profiles: ['4200'] })
    expect(settings[3]).toMatchObject({ width: 720, height: 528 })
  })

  it('skips the crop for a picture already a multiple of 16', () => {
    expect(settingsFor(768, 1024).map(s => s.step)).toEqual([
      '',
      'memory',
      'baseline',
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
  const encoded: {
    timestamp: number
    key: boolean
    height?: number
    memory: boolean
  }[] = []
  const configured: string[] = []
  let refuse = 0
  // How many encoders fail on their first frame, before any chunk.
  let failing = 0
  let opened = 0
  beforeEach(() => {
    encoded.length = 0
    configured.length = 0
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
        configure(config: { codec: string }) {
          configured.push(config.codec)
          this.state = 'configured'
        }
        encode(
          frame: {
            timestamp: number
            visibleRect?: { height: number }
            codedHeight?: number
          },
          opts: { keyFrame: boolean },
        ) {
          encoded.push({
            timestamp: frame.timestamp,
            key: opts.keyFrame,
            height: frame.visibleRect?.height ?? frame.codedHeight,
            memory: frame.visibleRect === undefined,
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
        codedHeight?: number
        constructor(
          _: unknown,
          init: {
            timestamp: number
            visibleRect?: { height: number }
            codedHeight?: number
          },
        ) {
          if (refuse > 0) {
            refuse--
            throw new Error('refused')
          }
          this.timestamp = init.timestamp
          this.visibleRect = init.visibleRect
          this.codedHeight = init.codedHeight
        }
        closed = false
        close() {
          this.closed = true
        }
      },
    )
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width: number
        height: number
        constructor(width: number, height: number) {
          this.width = width
          this.height = height
        }
        getContext() {
          return {
            canvas: this,
            drawImage: () => {},
            getImageData: (_x: number, _y: number, w: number, h: number) => ({
              data: new Uint8ClampedArray(w * h * 4),
            }),
          }
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
      step: 'baseline',
      error: 'OperationError: Encoding error.',
    })
    expect(configured.map(c => c.slice(0, 9))).toEqual([
      'avc1.6400',
      'avc1.6400',
      'avc1.4200',
    ])
    expect(encoded.at(-1)).toMatchObject({
      timestamp: 50000,
      key: true,
      memory: true,
    })
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

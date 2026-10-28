import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { STREAM_HEAD } from './mp4'
import { blobForced, blobSink, fileSink } from './takeSink'

import type { Mp4Layout } from './mp4'

// The layout a sink is closed with. Recognisable bytes rather than real boxes:
// what a sink owes the muxer is the three runs in the right order, and a
// `mp4Layout` fixture here would only test `mp4.ts` again.
const layout = (): Mp4Layout => ({
  head: Uint8Array.from([0xff, 0xff, 0xff, 0xff]),
  tail: [Uint8Array.from([0xaa]), Uint8Array.from([0xbb, 0xbb])],
})

const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())

const picture = (n: number, fill: number) => new Uint8Array(n).fill(fill)

describe('the Blob sink', () => {
  it('lays the head, the picture and the tail out in that order', async () => {
    const sink = blobSink()
    sink.write(picture(2, 1))
    sink.write(picture(3, 2))
    const file = await sink.close(layout())
    expect(Array.from(await bytes(file))).toEqual([
      0xff, 0xff, 0xff, 0xff, 1, 1, 2, 2, 2, 0xaa, 0xbb, 0xbb,
    ])
  })

  // The take has to arrive as something a download accepts as a movie, and a
  // Blob with no type is a Blob a browser may save as anything.
  it('names the file a movie', async () => {
    const sink = blobSink()
    sink.write(picture(1, 7))
    expect((await sink.close(layout())).type).toBe('video/mp4')
  })

  it('takes nothing on and never falls behind', () => {
    const sink = blobSink()
    expect(sink.streamed).toBe(false)
    expect(sink.backlog()).toBe(0)
  })

  // The browser holds every byte of a Blob take until it ends, so the cap is
  // memory. It shrinks by what has been written, which is what `full()` reads.
  it('spends its room on the picture it is given', () => {
    const sink = blobSink()
    const before = sink.room()
    sink.write(picture(1000, 0))
    expect(before - sink.room()).toBe(1000)
    expect(before).toBeGreaterThan(3_000_000_000)
  })

  // What every browser without `createWritable` gets, and `?takesink=blob`
  // is the only way to reach it on one that has it.
  it('is what the flag asks for', () => {
    expect(blobForced('?takesink=blob')).toBe(true)
    expect(blobForced('?takesink=file')).toBe(false)
    expect(blobForced('')).toBe(false)
  })

  it('leaves nothing behind when the take is abandoned', async () => {
    const sink = blobSink()
    sink.write(picture(4, 9))
    sink.discard()
    expect((await sink.close(layout())).size).toBe(7)
  })
})

// The file sink against a stand-in for the origin-private file system: the
// head patched in at the end, a failed write, and a take given up on. What the
// browser's own file system does is `scripts/sinkcheck.mjs`'s to measure.
type Chunk =
  | Uint8Array<ArrayBuffer>
  | { type: 'write'; position: number; data: Uint8Array<ArrayBuffer> }

class FakeWritable {
  bytes = new Uint8Array(0)
  writes = 0
  state: 'open' | 'closed' | 'aborted' = 'open'

  constructor(
    private readonly onClose: (written: Uint8Array<ArrayBuffer>) => void,
    private readonly limit: number,
  ) {}

  write(chunk: Chunk): Promise<void> {
    if (this.state !== 'open') return Promise.reject(new TypeError('closed'))
    this.writes++
    const { position, data } =
      chunk instanceof Uint8Array
        ? { position: this.bytes.length, data: chunk }
        : chunk
    const end = Math.max(this.bytes.length, position + data.length)
    if (end > this.limit)
      return Promise.reject(
        new DOMException('the disk is full', 'QuotaExceededError'),
      )
    const next = new Uint8Array(end)
    next.set(this.bytes)
    next.set(data, position)
    this.bytes = next
    return Promise.resolve()
  }

  close(): Promise<void> {
    if (this.state !== 'open') return Promise.reject(new TypeError('closed'))
    this.state = 'closed'
    this.onClose(this.bytes)
    return Promise.resolve()
  }

  abort(): Promise<void> {
    this.state = 'aborted'
    return Promise.resolve()
  }
}

class FakeDisk {
  files = new Map<string, Uint8Array<ArrayBuffer>>()
  streams: FakeWritable[] = []
  limit = Infinity
  quota: number | undefined = 10 * 1024 * 1024 * 1024
  usage = 0

  directory() {
    const files = this.files
    const streams = this.streams
    const limit = () => this.limit
    return {
      getFileHandle: (name: string) => {
        if (!files.has(name)) files.set(name, new Uint8Array(0))
        return Promise.resolve({
          kind: 'file',
          createWritable: () => {
            const stream = new FakeWritable(
              written => files.set(name, written),
              limit(),
            )
            streams.push(stream)
            return Promise.resolve(stream)
          },
          getFile: () =>
            Promise.resolve(
              new File([files.get(name) ?? new Uint8Array()], name),
            ),
        })
      },
      removeEntry: (name: string) => {
        files.delete(name)
        return Promise.resolve()
      },
    }
  }

  install() {
    const dir = this.directory()
    vi.stubGlobal('location', { search: '' })
    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: () =>
          Promise.resolve({ getDirectoryHandle: () => Promise.resolve(dir) }),
        estimate: () =>
          Promise.resolve({ quota: this.quota, usage: this.usage }),
      },
    })
  }
}

const streamedLayout = (tail: Uint8Array<ArrayBuffer>[] = []): Mp4Layout => ({
  head: picture(STREAM_HEAD, 0xaa),
  tail,
})

const settle = () => new Promise(r => setTimeout(r, 0))

describe('the file sink', () => {
  let disk: FakeDisk

  beforeEach(() => {
    disk = new FakeDisk()
    disk.install()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('patches the head in front of the picture and the tail after it', async () => {
    const sink = await fileSink()
    expect(sink?.streamed).toBe(true)
    sink?.write(picture(3, 1))
    sink?.write(picture(2, 2))
    const blob = await sink?.close(streamedLayout([picture(4, 3)]))
    expect(blob?.type).toBe('video/mp4')
    expect(Array.from(blob === undefined ? [] : await bytes(blob))).toEqual([
      ...Array<number>(STREAM_HEAD).fill(0xaa),
      1,
      1,
      1,
      2,
      2,
      3,
      3,
      3,
      3,
    ])
  })

  it('gathers the tail into as few writes as the picture', async () => {
    const sink = await fileSink()
    sink?.write(picture(3, 1))
    const blob = await sink?.close(
      streamedLayout(Array.from({ length: 1000 }, () => picture(400, 3))),
    )
    expect(blob?.size).toBe(STREAM_HEAD + 3 + 400_000)
    // The head reserved at the start, the picture with the tail, the head.
    expect(disk.streams[0]?.writes).toBe(3)
  })

  it('refuses a layout whose head is not the size it reserved', async () => {
    const sink = await fileSink()
    await expect(
      sink?.close({ head: picture(8, 0), tail: [] }),
    ).rejects.toThrow(/reserved/)
  })

  it('leaves no file behind when the last write fails', async () => {
    disk.limit = STREAM_HEAD + 4
    const sink = await fileSink()
    sink?.write(picture(3, 1))
    await expect(sink?.close(streamedLayout([picture(4, 3)]))).rejects.toThrow(
      /full/,
    )
    expect(disk.files.size).toBe(0)
    expect(disk.streams[0]?.state).toBe('aborted')
  })

  it('says so as soon as a write fails', async () => {
    disk.limit = STREAM_HEAD
    const sink = await fileSink()
    expect(sink?.failure()).toBe('')
    sink?.write(picture(4 * 1024 * 1024, 1))
    await settle()
    expect(sink?.failure()).toMatch(
      /could not write the take: the disk is full/,
    )
  })

  it('leaves no file behind when given up on', async () => {
    const sink = await fileSink()
    sink?.write(picture(3, 1))
    sink?.discard()
    await settle()
    expect(disk.files.size).toBe(0)
    expect(disk.streams[0]?.state).toBe('aborted')
  })
})

import { describe, expect, it } from 'vitest'

import { blobForced, blobSink } from './takeSink'

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
  // is the only way to reach it on one that has it. The file sink itself is
  // browser semantics all the way down — `scripts/sinkcheck.mjs` has it.
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

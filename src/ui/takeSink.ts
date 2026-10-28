// Where a take's bytes go while it is being recorded.
//
// A take's payload is the file, and the file is large: 1398x1790 at 60fps
// bitrate-caps at 60 Mbps, so four and a half minutes of it is 2 GB. Two sinks
// take it, and `startRecording` prefers the first:
//
//   - **A file**, written as the picture is encoded. The take costs the tab a
//     piece at a time and nothing at the end, and what caps it is the storage
//     the browser will grant rather than anything about the page.
//   - **A Blob**, rolled from the arrays in pieces. The browser holds the file
//     somewhere for the whole take, so this one is capped well short of what
//     the format can carry.
//
// The file sink needs the origin-private file system and `createWritable`,
// which `scripts/fsacheck.mjs` measures. Nightly 151 has both; the picker that
// would let the user choose where the file lands is Chromium-only, and is not
// what this needs.

import { STREAM_HEAD } from './mp4'

import type { Mp4Layout } from './mp4'

export interface TakeSink {
  // Whether the file is written as it is produced, which is what decides
  // whether the layout leaves a large `mdat` header at the front for the size
  // nobody knows yet.
  streamed: boolean
  // Take more picture. Not awaited, because the encoder's `output` callback is
  // synchronous: a file sink queues the write and says how far behind it is.
  write: (data: Uint8Array<ArrayBuffer>) => void
  // Bytes handed over that have not landed yet.
  backlog: () => number
  // How many more bytes this sink will take.
  room: () => number
  // The finished file, with the layout's tail placed after the picture and its
  // head at the front.
  close: (layout: Mp4Layout) => Promise<Blob>
  // Give up, and leave nothing behind.
  discard: () => void
}

// How much encoded picture a Blob sink holds as arrays before it rolls them
// into a Blob. The heap then holds one piece of this size instead of the take.
const SPILL_BYTES = 64 * 1024 * 1024

// Where a Blob take stops itself. The browser holds every byte of it until the
// take ends, so this is a limit on memory: the sample tables carry 64-bit
// offsets now, and the format is no longer what caps a take.
const BLOB_MAX = 3_900_000_000

// What a file take leaves unspent of the storage it is granted, so that
// finishing one — which writes the sound and the movie box — does not fail for
// want of room, and so a take does not fill the quota the rest of the app
// shares.
const STREAM_RESERVE = 256 * 1024 * 1024

// What a file take may reach where the browser will not say what it is allowed
// to store. The same number the Blob sink stops at, for want of a better one.
const STREAM_UNKNOWN = BLOB_MAX

// How much picture a file sink gathers before it writes. One write per frame
// is one message to the browser's storage thread per frame, and at 60fps that
// measured 32.8 renders/s against 44.8 on the Blob path — a quarter of the
// engine's frames spent handing bytes over (`scripts/rectakecheck.mjs`, under
// `--flags=takesink%3Dblob` for the other arm). Gathered into pieces this
// size it is one write every half second at the bitrate cap, and the engine
// keeps its frames.
const WRITE_BYTES = 4 * 1024 * 1024

// Where a take's file lives while it is being written, under the origin's own
// directory. Its own folder, so `sweepTakes` can empty it without knowing what
// else the app might come to keep there.
const DIR = 'takes'

// How long a finished take's file is left alone. A download reads the file
// after `close` has handed it over, and nothing tells the page when it has
// finished reading — so the file outlives the take by long enough for that to
// have happened, and the next page load clears it.
const KEEP_MS = 10 * 60 * 1000

export function blobSink(): TakeSink {
  const pieces: Blob[] = []
  let pending: Uint8Array<ArrayBuffer>[] = []
  let pendingBytes = 0
  let written = 0

  const roll = () => {
    if (pendingBytes === 0) return
    pieces.push(new Blob(pending))
    pending = []
    pendingBytes = 0
  }

  return {
    streamed: false,
    backlog: () => 0,
    room: () => BLOB_MAX - written,
    write: data => {
      written += data.length
      pending.push(data)
      pendingBytes += data.length
      if (pendingBytes >= SPILL_BYTES) roll()
    },
    close: ({ head, tail }) => {
      roll()
      return Promise.resolve(
        new Blob([head, ...pieces, ...tail], { type: 'video/mp4' }),
      )
    },
    discard: () => {
      pieces.length = 0
      pending = []
      pendingBytes = 0
    },
  }
}

const messageOf = (e: unknown): string =>
  e instanceof Error ? e.message : String(e)

// The origin's own directory, or null in a browser that has none and in a
// private window, where asking for one throws.
const root = (): Promise<FileSystemDirectoryHandle | null> =>
  typeof navigator.storage?.getDirectory === 'function'
    ? navigator.storage.getDirectory().catch(() => null)
    : Promise.resolve(null)

// What the browser will let this origin store beyond what it already has.
async function granted(): Promise<number> {
  if (typeof navigator.storage?.estimate !== 'function') return STREAM_UNKNOWN
  const { quota, usage } = await navigator.storage
    .estimate()
    .catch(() => ({ quota: undefined, usage: undefined }))
  if (quota === undefined) return STREAM_UNKNOWN
  return Math.max(0, quota - (usage ?? 0) - STREAM_RESERVE)
}

// A sink that writes the take to a file as it is encoded, or null where this
// browser has no file to write it to.
//
// The head is reserved rather than written: the `mdat` size it carries is only
// known when the take is over, so `close` seeks back and patches it in. That
// one positional write is the whole reason this needs `createWritable` and not
// just the origin-private file system.
// `?takesink=blob` holds a take in memory on a browser that has a file to
// write it to. The fallback path is what every browser without
// `createWritable` gets, and this is the only way to exercise it on one where
// the streamed path works.
export const blobForced = (search = location.search): boolean =>
  new URLSearchParams(search).get('takesink') === 'blob'

export async function fileSink(): Promise<TakeSink | null> {
  if (blobForced()) return null
  const base = await root()
  if (base === null) return null
  const name = `take-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
  let dir: FileSystemDirectoryHandle
  let entry: FileSystemFileHandle
  let stream: FileSystemWritableFileStream
  try {
    dir = await base.getDirectoryHandle(DIR, { create: true })
    entry = await dir.getFileHandle(name, { create: true })
    // Safari has had the origin-private file system since well before it had
    // this, and without it the head cannot be patched in at the end.
    if (typeof entry.createWritable !== 'function') return null
    stream = await entry.createWritable()
    await stream.write(new Uint8Array(STREAM_HEAD))
  } catch {
    return null
  }

  const free = await granted()
  let written = 0
  let backlog = 0
  let failure = ''
  // The picture gathered but not yet handed to the browser.
  let pending: Uint8Array<ArrayBuffer>[] = []
  let pendingBytes = 0
  // Writes land in the order they were handed over, and the encoder hands them
  // over from a synchronous callback — so they queue here rather than at the
  // call site.
  let chain: Promise<void> = Promise.resolve()

  const queue = (data: Uint8Array<ArrayBuffer>) => {
    backlog += data.length
    chain = chain.then(async () => {
      try {
        await stream.write(data)
      } catch (e) {
        if (failure === '') failure = messageOf(e)
      }
      backlog -= data.length
    })
  }

  // One write for everything gathered so far. Joined rather than written one
  // piece at a time, because the per-write cost is what this exists to avoid.
  const flush = () => {
    if (pendingBytes === 0) return
    const batch = new Uint8Array(pendingBytes)
    let at = 0
    for (const piece of pending) {
      batch.set(piece, at)
      at += piece.length
    }
    pending = []
    pendingBytes = 0
    queue(batch)
  }

  return {
    streamed: true,
    backlog: () => backlog + pendingBytes,
    room: () => free - written,
    write: data => {
      if (failure !== '') return
      written += data.length
      pending.push(data)
      pendingBytes += data.length
      if (pendingBytes >= WRITE_BYTES) flush()
    },
    close: async ({ head, tail }) => {
      if (head.length !== STREAM_HEAD) {
        throw new Error(
          `a streamed take reserved ${STREAM_HEAD} bytes and its layout wants ${head.length}`,
        )
      }
      flush()
      for (const piece of tail) queue(piece)
      await chain
      if (failure === '') {
        try {
          await stream.write({ type: 'write', position: 0, data: head })
        } catch (e) {
          failure = messageOf(e)
        }
      }
      if (failure === '') {
        try {
          await stream.close()
        } catch (e) {
          failure = messageOf(e)
        }
      }
      if (failure !== '') {
        await stream.abort().catch(() => {})
        await dir.removeEntry(name).catch(() => {})
        throw new Error(failure)
      }
      const file = await entry.getFile()
      // Sliced rather than wrapped: it names the type without copying a
      // gigabyte, which `new Blob([file])` would.
      return file.slice(0, file.size, 'video/mp4')
    },
    discard: () => {
      failure = 'the take was abandoned'
      pending = []
      pendingBytes = 0
      void chain
        .then(() => stream.abort())
        .catch(() => {})
        .then(() => dir.removeEntry(name))
        .catch(() => {})
    },
  }
}

// Takes left behind: by a tab that died mid-recording, and by one whose
// download has long since finished. A take's file is nobody's to delete while
// the page that made it is still open, so this runs at startup and clears what
// an earlier page left.
export async function sweepTakes(now = Date.now()): Promise<number> {
  const base = await root()
  if (base === null) return 0
  const stale: string[] = []
  try {
    const dir = await base.getDirectoryHandle(DIR, { create: false })
    // Collected before anything is removed: a directory being iterated is not
    // a directory to delete out of.
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== 'file') continue
      const file = await handle.getFile()
      if (now - file.lastModified > KEEP_MS) stale.push(name)
    }
    for (const name of stale) await dir.removeEntry(name)
  } catch {
    // No directory, or a browser that will not iterate one. Either way there
    // is nothing here this can clear.
    return 0
  }
  return stale.length
}

// Reading a WebM back into the samples a `VideoDecoder` will take: the same job
// `mp4demux.ts` does for MP4, for the files most of this app's footage arrives
// as. Wikimedia Commons serves its transcodes as VP9 WebM, and so does the clip
// bucket.
//
// **Why it exists.** Without it a WebM deck under a take fell back to seeking a
// `<video>` a frame at a time, and a seek on a file with sparse keyframes
// decodes from the last one: the chicken roll on Commons has four keyframes in
// 36 seconds, and the gallery recorder took two minutes a frame on it.
//
// WebM is Matroska with a short list of codecs, and Matroska is EBML: every
// element is an ID, a size and a payload, the IDs and sizes written as
// variable-length integers. Blocks are stored in decode order, and VP8, VP9 and
// AV1 never reorder frames at the container, so a block's timestamp is both its
// decode time and its presentation time.
//
// Like `mp4demux.ts` it is a reader, not a validator. Anything it cannot make
// sense of comes back null and the caller keeps the wall-rate `<video>`.
//
// What it does not do:
//
//   - **Laced blocks.** Lacing packs several frames into one block; video
//     tracks do not use it in practice, and a file that does comes back null.
//   - **Content encodings** (compression or encryption of the blocks). Null.
//   - **Audio.** The render's sound does not come from here.

import type { DemuxedTrack } from './mp4demux'

const SEGMENT = 0x18538067
const INFO = 0x1549a966
const TIMECODE_SCALE = 0x2ad7b1
const DURATION = 0x4489
const TRACKS = 0x1654ae6b
const TRACK_ENTRY = 0xae
const TRACK_NUMBER = 0xd7
const TRACK_TYPE = 0x83
const CODEC_ID = 0x86
const CODEC_PRIVATE = 0x63a2
const CONTENT_ENCODINGS = 0x6d80
const VIDEO = 0xe0
const PIXEL_WIDTH = 0xb0
const PIXEL_HEIGHT = 0xba
const DISPLAY_WIDTH = 0x54b0
const DISPLAY_HEIGHT = 0x54ba
const DEFAULT_DURATION = 0x23e383
const CLUSTER = 0x1f43b675
const CLUSTER_TIMECODE = 0xe7
const SIMPLE_BLOCK = 0xa3
const BLOCK_GROUP = 0xa0
const BLOCK = 0xa1
const REFERENCE_BLOCK = 0xfb

// The elements that can follow a cluster at the top of a segment, or start the
// next file in a concatenation. A cluster of unknown size, which a live
// recorder writes, ends where one of these begins.
const SEGMENT_CHILDREN = new Set([
  0x1a45dfa3, // EBML, the header of a recording appended after this one
  SEGMENT,
  CLUSTER,
  0x114d9b74, // SeekHead
  INFO,
  TRACKS,
  0x1c53bb6b, // Cues
  0x1941a469, // Attachments
  0x1043a770, // Chapters
  0x1254c367, // Tags
])

interface Element {
  id: number
  // Payload bounds. An unknown size runs to the end of its parent.
  start: number
  end: number
  unknown: boolean
}

// A variable-length integer at `at`: its length is one more than the number of
// leading zero bits in the first byte. `keepMarker` keeps the length bit, which
// is how element IDs are written down. Null past the end or for a length over 8.
function vint(
  bytes: Uint8Array,
  at: number,
  keepMarker: boolean,
): { value: number; length: number; allOnes: boolean } | null {
  if (at >= bytes.length) return null
  const first = bytes[at]!
  let length = 1
  while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length++
  if (length > 8 || at + length > bytes.length) return null
  let value = keepMarker ? first : first & (0xff >> length)
  let allOnes = value === 0xff >> length
  for (let i = 1; i < length; i++) {
    const b = bytes[at + i]!
    value = value * 256 + b
    allOnes &&= b === 0xff
  }
  return { value, length, allOnes }
}

// `clamp` cuts an element that runs past its parent back to the parent's end,
// for the segment of a file that was truncated.
function element(
  bytes: Uint8Array,
  at: number,
  parentEnd: number,
  clamp = false,
) {
  const id = vint(bytes, at, true)
  if (id === null) return null
  const size = vint(bytes, at + id.length, false)
  if (size === null) return null
  const start = at + id.length + size.length
  const unknown = size.allOnes
  let end = unknown ? parentEnd : start + size.value
  if (end > parentEnd) {
    if (!clamp || start > parentEnd) return null
    end = parentEnd
  }
  return { id: id.value, start, end, unknown }
}

// The elements directly under `[start, end)`. Stops on one that does not fit,
// the way `mp4demux.ts` stops on a box that does not: what parsed is still the
// truth about its part of the file.
function* children(
  bytes: Uint8Array,
  start: number,
  end: number,
): Generator<Element> {
  let at = start
  while (at < end) {
    const el = element(bytes, at, end)
    if (el === null) return
    yield el
    at = el.end
  }
}

function uint(bytes: Uint8Array, el: Element): number {
  let value = 0
  for (let i = el.start; i < el.end; i++) value = value * 256 + bytes[i]!
  return value
}

function float(bytes: Uint8Array, el: Element): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset + el.start)
  if (el.end - el.start === 4) return view.getFloat32(0)
  if (el.end - el.start === 8) return view.getFloat64(0)
  return 0
}

const text = (bytes: Uint8Array, el: Element): string =>
  new TextDecoder().decode(bytes.subarray(el.start, el.end)).replace(/\0+$/, '')

interface VideoTrack {
  number: number
  codecId: string
  codecPrivate: Uint8Array | null
  width: number
  height: number
  // The picture's shape on screen, when it is not square pixels. VP8 and VP9
  // carry no aspect in the stream, so the container is the only place it is.
  displayWidth: number
  displayHeight: number
  // Nanoseconds per frame, when the muxer wrote it.
  frameNs: number
}

function readTrack(bytes: Uint8Array, entry: Element): VideoTrack | null {
  let number = 0
  let type = 0
  let codecId = ''
  let codecPrivate: Uint8Array | null = null
  let width = 0
  let height = 0
  let displayWidth = 0
  let displayHeight = 0
  let frameNs = 0
  for (const el of children(bytes, entry.start, entry.end)) {
    if (el.id === TRACK_NUMBER) number = uint(bytes, el)
    else if (el.id === DEFAULT_DURATION) frameNs = uint(bytes, el)
    else if (el.id === TRACK_TYPE) type = uint(bytes, el)
    else if (el.id === CODEC_ID) codecId = text(bytes, el)
    else if (el.id === CODEC_PRIVATE)
      codecPrivate = bytes.slice(el.start, el.end)
    else if (el.id === CONTENT_ENCODINGS) return null
    else if (el.id === VIDEO) {
      for (const v of children(bytes, el.start, el.end)) {
        if (v.id === PIXEL_WIDTH) width = uint(bytes, v)
        else if (v.id === PIXEL_HEIGHT) height = uint(bytes, v)
        else if (v.id === DISPLAY_WIDTH) displayWidth = uint(bytes, v)
        else if (v.id === DISPLAY_HEIGHT) displayHeight = uint(bytes, v)
      }
    }
  }
  return type === 1
    ? {
        number,
        codecId,
        codecPrivate,
        width,
        height,
        displayWidth: displayWidth || width,
        displayHeight: displayHeight || height,
        frameNs,
      }
    : null
}

const two = (n: number) => String(n).padStart(2, '0')

// A VP9 keyframe's profile and bit depth, off its uncompressed header: the
// two-bit frame marker, the profile's low then high bit, a reserved bit in
// profile 3, four flags, the 24-bit sync code, and then, from profile 2, whether
// the samples are 10 or 12 bits.
function vp9Format(key: Uint8Array | null): { profile: number; depth: number } {
  if (key === null || key.length === 0) return { profile: 0, depth: 8 }
  let bit = 0
  const read = (n: number) => {
    let v = 0
    for (let i = 0; i < n; i++, bit++)
      v = (v << 1) | ((key[bit >> 3]! >> (7 - (bit & 7))) & 1)
    return v
  }
  read(2)
  const low = read(1)
  const profile = low | (read(1) << 1)
  if (profile === 3) read(1)
  if (profile < 2) return { profile, depth: 8 }
  if (key.length < 5) return { profile, depth: 10 }
  read(4 + 24)
  return { profile, depth: read(1) === 1 ? 12 : 10 }
}

// The codec string `VideoDecoder.configure` wants. WebCodecs takes `vp8` as it
// is, but VP9 and AV1 need their profile, level and bit depth spelled out. VP9
// keeps the first two in its keyframes; the level is not in the stream, so it is
// given as 4.1, which decoders read as a hint. AV1's are in its `av1C` record.
function codecString(track: VideoTrack, firstKey: Uint8Array | null) {
  if (track.codecId === 'V_VP8') return { codec: 'vp8', description: null }
  if (track.codecId === 'V_VP9') {
    const { profile, depth } = vp9Format(firstKey)
    return { codec: `vp09.${two(profile)}.41.${two(depth)}`, description: null }
  }
  if (track.codecId === 'V_AV1') {
    const c = track.codecPrivate
    if (c === null || c.length < 4) return null
    const profile = c[1]! >> 5
    const level = c[1]! & 0x1f
    const tier = (c[2]! & 0x80) !== 0 ? 'H' : 'M'
    const depth = (c[2]! & 0x40) === 0 ? 8 : (c[2]! & 0x20) === 0 ? 10 : 12
    return {
      codec: `av01.${profile}.${two(level)}${tier}.${two(depth)}`,
      description: c,
    }
  }
  return null
}

// A block's track, its time relative to its cluster, and whether it is laced.
// `SimpleBlock` also carries the keyframe flag in the same byte.
function blockHead(bytes: Uint8Array, el: Element) {
  const track = vint(bytes, el.start, false)
  if (track === null) return null
  const at = el.start + track.length
  if (at + 3 > el.end) return null
  const relative = new DataView(bytes.buffer, bytes.byteOffset + at).getInt16(0)
  const flags = bytes[at + 2]!
  return {
    track: track.value,
    relative,
    key: (flags & 0x80) !== 0,
    laced: (flags & 0x06) !== 0,
    data: at + 3,
  }
}

export function demuxWebm(bytes: Uint8Array): DemuxedTrack | null {
  const header = vint(bytes, 0, true)
  if (header === null || header.value !== 0x1a45dfa3) return null
  let segment: Element | null = null
  let at = 0
  while (segment === null && at < bytes.length) {
    const el = element(bytes, at, bytes.length, true)
    if (el === null) return null
    if (el.id === SEGMENT) segment = el
    at = el.end
  }
  if (segment === null) return null

  let scale = 1_000_000
  let duration = 0
  let track: VideoTrack | null = null
  const samples: DemuxedTrack['samples'] = []

  // Where the segment goes on after `cluster`, or null to decline the file.
  const readCluster = (cluster: Element): number | null => {
    let base = 0
    let pos = cluster.start
    while (pos < cluster.end) {
      const el = element(bytes, pos, cluster.end)
      if (el === null) return cluster.end
      if (cluster.unknown && SEGMENT_CHILDREN.has(el.id)) return pos
      pos = el.end
      if (el.id === CLUSTER_TIMECODE) base = uint(bytes, el)
      if (track === null) continue
      let block: Element | null = null
      let key = false
      if (el.id === SIMPLE_BLOCK) block = el
      else if (el.id === BLOCK_GROUP) {
        key = true
        for (const g of children(bytes, el.start, el.end)) {
          if (g.id === BLOCK) block = g
          else if (g.id === REFERENCE_BLOCK) key = false
        }
      }
      if (block === null) continue
      const head = blockHead(bytes, block)
      if (head === null || head.track !== track.number) continue
      if (head.laced) return null
      const time = base + head.relative
      samples.push({
        offset: head.data,
        size: block.end - head.data,
        dts: time,
        cts: time,
        key: el.id === SIMPLE_BLOCK ? head.key : key,
      })
    }
    return cluster.end
  }

  let pos = segment.start
  while (pos < segment.end) {
    const el = element(bytes, pos, segment.end)
    if (el === null) break
    if (el.id === INFO) {
      for (const i of children(bytes, el.start, el.end)) {
        if (i.id === TIMECODE_SCALE) scale = uint(bytes, i) || scale
        else if (i.id === DURATION) duration = float(bytes, i)
      }
    } else if (el.id === TRACKS && track === null) {
      for (const t of children(bytes, el.start, el.end)) {
        if (t.id !== TRACK_ENTRY) continue
        track = readTrack(bytes, t)
        if (track !== null) break
      }
    } else if (el.id === CLUSTER) {
      const next = readCluster(el)
      if (next === null) return null
      pos = next
      continue
    }
    pos = el.end
  }
  // A decoder has to start on a keyframe. Without one first, which a file whose
  // tracks come after its first cluster can give, the deck falls back.
  if (track === null || samples.length === 0 || !samples[0]!.key) return null

  const first = samples.find(s => s.key)
  const codec = codecString(
    track,
    first === undefined
      ? null
      : bytes.subarray(first.offset, first.offset + first.size),
  )
  if (codec === null) return null
  // Without a `Duration`, which a `MediaRecorder` does not write, the clip lasts
  // until its last frame ends: its start plus one frame, from the track's
  // default or the median gap between frames.
  const last = samples.reduce((m, s) => Math.max(m, s.cts), 0)
  const gaps = samples
    .slice(1)
    .map((s, i) => s.cts - samples[i]!.cts)
    .filter(g => g > 0)
    .toSorted((a, b) => a - b)
  const frame =
    track.frameNs > 0 ? track.frameNs / scale : (gaps[gaps.length >> 1] ?? 0)
  return {
    codec: codec.codec,
    description: codec.description,
    codedWidth: track.width,
    codedHeight: track.height,
    displayWidth: track.displayWidth,
    displayHeight: track.displayHeight,
    timescale: 1e9 / scale,
    duration: duration > 0 ? duration : last + frame,
    samples,
    unsupportedEdit: false,
  }
}

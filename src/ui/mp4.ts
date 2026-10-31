// A minimal MP4 (ISOBMFF) writer: one H.264 track at a constant frame rate,
// and an AAC or Opus track beside it when the take has sound.
//
// - **Layout**: `ftyp` / `mdat` / `moov`. Each track's samples form one chunk
//   in `mdat`, picture first, so `stsc` and `stco` (`co64` past 4 GiB) hold one
//   entry each.
// - **Streaming**: a take writes its picture to a file as it encodes.
//   `mp4Layout` builds the boxes either side of that payload from the sample
//   tables alone, and `takeSink.ts` patches the `mdat` header in at the end.
// - **Constant frame rate**: `stts` is one entry, N samples each `delta` long,
//   so an editor reads one frame rate off the header. A live take's held frame
//   is one longer sample, still a whole number of frames (docs/adr/0013).
// - **B-frames**: Firefox's H.264 encoder emits them in both latency modes, so
//   samples arrive in decode order and carry `ctts` offsets and an edit list.
// - **MP4**: DaVinci Resolve does not import WebM and Premiere needs a plugin
//   for it, while every editor opens H.264 in MP4 (docs/EDITOR.md).
// - **No dependency**: the general-purpose muxers exist for fragmented output
//   and many tracks, which this does without.

// Every box is a length, a four-character type, and a payload.
const box = (
  type: string,
  ...parts: Uint8Array<ArrayBuffer>[]
): Uint8Array<ArrayBuffer> => {
  const size = parts.reduce((n, p) => n + p.length, 8)
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  view.setUint32(0, size)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  let at = 8
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

// A box whose first payload byte is a version and three flag bytes.
const fullBox = (
  type: string,
  version: number,
  flags: number,
  ...parts: Uint8Array<ArrayBuffer>[]
): Uint8Array<ArrayBuffer> =>
  box(
    type,
    u8(version, (flags >> 16) & 0xff, (flags >> 8) & 0xff, flags & 0xff),
    ...parts,
  )

const u8 = (...bytes: number[]): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(bytes)

const u16 = (v: number): Uint8Array<ArrayBuffer> =>
  u8((v >> 8) & 0xff, v & 0xff)

const u32 = (v: number): Uint8Array<ArrayBuffer> =>
  u8((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff)

const str = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(s, c => c.charCodeAt(0) & 0xff)

// Split into two 32-bit halves rather than written through a BigInt, because
// every size in this writer is a byte count in a number and a take cannot
// reach 2^53 of them.
const u64 = (v: number): Uint8Array<ArrayBuffer> =>
  join([u32(Math.floor(v / 2 ** 32)), u32(v % 2 ** 32)])

// A piece of the sample payload. A `Blob` is there for a take long enough that
// holding its picture in the heap is what kills the tab: `blobSink` in
// `takeSink.ts` rolls the encoded bytes into Blobs as they arrive, so by the
// time the file is laid out the browser holds the payload already and this
// writer only places it. Everything the writer builds itself is bytes.
export type Payload = Uint8Array<ArrayBuffer> | Blob

const sizeOf = (p: Payload): number => (p instanceof Blob ? p.size : p.length)

const join = (parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

// The creation/modification stamp the three header boxes carry, in seconds
// since 1904. **Zero, meaning unset, rather than the wall clock**, and that is
// load-bearing rather than laziness: it is the last thing standing between a
// take and being a pure function of the frames in it.
//
// It was `Date.now()`, and `scripts/rendercheck.mjs` caught it the day the
// render started clearing its signal state — two renders of one take came back
// the same length to the byte and with different digests, and the whole of the
// difference was these six fields, twenty-four bytes of "when did you press the
// button". Nothing reads them (ffprobe reports no date either way), and a file
// that differs by when it was made is a file two takes can never be compared
// by.
const NO_DATE = u32(0)

// The unity matrix every writer emits, as 16.16 fixed point.
const MATRIX = join([
  u32(0x00010000),
  u32(0),
  u32(0),
  u32(0),
  u32(0x00010000),
  u32(0),
  u32(0),
  u32(0),
  u32(0x40000000),
])

// Parameter sets as avcC lists them, each behind its two-byte length.
const lengths = (list: { data: Uint8Array<ArrayBuffer> }[]) =>
  list.flatMap(s => [u16(s.data.length), s.data])

// The profiles ISO 14496-15 gives four more bytes after the PPS list: chroma
// format, luma and chroma bit depth, and the SPS extensions.
const HIGH_PROFILES = new Set([100, 110, 122, 144])

// Those bytes: the browser's own with their reserved bits set, as for the
// header. Without them, High (100) is 4:2:0 at 8 bits, the only format that
// profile gives a WebCodecs encoder; the other three carry bit depths this
// cannot guess, so they go without.
const highTail = (profile: number, tail: Uint8Array<ArrayBuffer> | null) =>
  !HIGH_PROFILES.has(profile)
    ? new Uint8Array(0)
    : tail !== null
      ? join([
          u8(
            0xfc | (tail[0]! & 0x03),
            0xf8 | (tail[1]! & 0x07),
            0xf8 | (tail[2]! & 0x07),
          ),
          tail.slice(3),
        ])
      : profile === 100
        ? u8(0xfd, 0xf8, 0xf8, 0x00)
        : new Uint8Array(0)

// Rebuild an `avcC` record from whatever the encoder handed over, because what
// Firefox hands over is malformed and ffmpeg says so.
//
// Measured on Nightly, `decoderConfig.description` for `avc1.42002a` comes back
//
//   01 42 c0 2a 03 01 00 18 67 67 42 c0 2a d9 …  01 00 05 68 68 cb 8c b2
//
// against the same stream written by ffmpeg, which is
//
//   01 42 c0 20 ff e1 00 18 67 42 c0 20 d9 …
//
// Two faults, and they are the browser's — the bytes above are dumped straight
// off the callback, before this file sees them. The reserved bits before
// `lengthSizeMinusOne` and `numOfSequenceParameterSets` are left clear where
// the spec fixes them at 1 (`0xFC`, `0xE0`), and **each parameter set carries a
// duplicate of its own NAL header byte** — `67 67`, `68 68`. ffmpeg decodes the
// picture anyway but reports `sps_id out of range` and `cpb_count 33 invalid`
// on every frame, because it is parsing the SPS one byte off; a stricter
// demuxer is entitled to refuse the file outright, and an editor is exactly the
// stricter demuxer this is for.
//
// So the sets are read out by their declared lengths, un-doubled, and re-emitted
// with the reserved bits on. Detecting the duplicate rather than always
// dropping a byte is what keeps this correct on a browser without the bug: a
// real SPS's second byte is `profile_idc` (0x64 for the High profile
// `record.ts` asks for) and can never equal its own NAL header, so the two
// being identical is unambiguous.
export function normaliseAvcc(
  raw: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  // Too short to be a record at all — hand it back and let the file fail
  // visibly rather than inventing parameter sets nothing came from.
  if (raw.length < 7) return raw

  const sets: { type: number; data: Uint8Array<ArrayBuffer> }[] = []
  let at = 6
  let whole = true
  const take = (count: number, expect: number) => {
    for (let i = 0; i < count && whole; i++) {
      const len = at + 2 <= raw.length ? (raw[at]! << 8) | raw[at + 1]! : 0
      at += 2
      whole = len > 0 && at + len <= raw.length
      if (whole) {
        const data = raw.slice(at, at + len)
        at += len
        // The duplicate, if this browser writes one.
        const doubled =
          data.length > 2 && data[0] === data[1] && (data[0]! & 0x1f) === expect
        sets.push({ type: expect, data: doubled ? data.slice(1) : data })
      }
    }
  }
  take(raw[5]! & 0x1f, 7)
  if (at < raw.length) take(raw[at++]!, 8)

  const sps = sets.filter(s => s.type === 7)
  const pps = sets.filter(s => s.type === 8)
  const first = sps[0]
  if (first === undefined) return raw
  const profile = first.data[1] ?? 0

  return join([
    // Version, and the profile/compat/level triplet, which are the first three
    // bytes of the SPS itself and are taken from there rather than from the
    // header — a browser that got the header wrong has not earned the benefit
    // of the doubt about these.
    u8(1, profile, first.data[2] ?? 0, first.data[3] ?? 0),
    // Reserved bits set, and a four-byte NAL length, which is what `record.ts`
    // configures the encoder for.
    u8(0xff, 0xe0 | sps.length),
    ...lengths(sps),
    u8(pps.length),
    ...lengths(pps),
    highTail(profile, whole && raw.length - at >= 4 ? raw.slice(at) : null),
  ])
}

// One encoded frame's entry in the sample table. The bytes are not here: they
// travel as the spec's `video`, in these samples' order, because the pieces a
// take spills its picture into are much larger than a frame.
export interface Sample {
  size: number
  // Whether an editor can cut here. Every frame the encoder marked a keyframe
  // goes in `stss`; with no `stss` at all a player assumes *every* frame is a
  // sync point, which is wrong the moment the encoder emits a P-frame.
  key: boolean
  // When the frame is shown, in frame periods from the start. The index when
  // absent. Samples arrive in decode order, which differs from presentation
  // order wherever the encoder used B-frames, and a gap between two
  // presentation times is a frame held for longer.
  pts?: number
}

// One encoded block of sound, as it comes off `AudioEncoder`, and how many
// sample periods it covers.
export interface AudioSample {
  data: Uint8Array<ArrayBuffer>
  frames: number
}

export interface Mp4Audio {
  codec: 'aac' | 'opus'
  sampleRate: number
  channels: number
  // AAC's AudioSpecificConfig, which `esds` carries. Opus has none.
  config: Uint8Array<ArrayBuffer> | null
  // Opus's pre-skip in 48 kHz samples, which `dOps` carries: the encoder's
  // lookahead, for a player to drop off the front.
  preSkip: number
  samples: readonly AudioSample[]
}

interface Mp4Tables {
  width: number
  height: number
  // Frames per second, as a rational so 29.97 and 23.976 stay exact rather
  // than becoming a repeating decimal an editor then rounds differently.
  fps: { num: number; den: number }
  // The encoder's `decoderConfig.description` — the avcC record, which carries
  // the SPS and PPS. Without it a decoder has no parameter sets and the file is
  // unplayable; `VideoEncoder` hands it over on the first chunk's metadata.
  avcc: Uint8Array<ArrayBuffer>
  samples: readonly Sample[]
  // Where the track ends, in frame periods. The last frame stays up until then;
  // absent, it lasts one period.
  end?: number
  audio?: Mp4Audio
  // Whether the payload is being written as it is produced. The `mdat` header
  // then has to be laid out before its size is known, so it takes the large
  // form whatever the take turns out to weigh, and the offsets in the sample
  // tables are measured from `STREAM_HEAD`.
  streamed?: boolean
}

interface Mp4Spec<P extends Payload = Payload> extends Mp4Tables {
  // The samples' bytes, in the samples' order, in however many pieces they
  // arrived in. The tables are built from the sizes in `samples`, so the two
  // have to agree on the total — `mp4Parts` says so rather than writing a file
  // whose sample table points past its own `mdat`.
  video: readonly P[]
}

// The file with the picture taken out of the middle of it.
export interface Mp4Layout {
  // The brand and the `mdat` header: what the picture follows.
  head: Uint8Array<ArrayBuffer>
  // What the picture is followed by: the sound's samples, which share the
  // picture's `mdat`, and then `moov`. Every table in `moov` is measured from
  // `head.length` and from the picture being exactly as long as the sample
  // table says, so a writer that places either anywhere else writes a file
  // that does not say where its own frames are.
  tail: Uint8Array<ArrayBuffer>[]
}

// An MPEG-4 descriptor: a tag, a length and a body. Every one written here is
// under 128 bytes, which is what lets the length be the single-byte form.
const descriptor = (
  tag: number,
  ...parts: Uint8Array<ArrayBuffer>[]
): Uint8Array<ArrayBuffer> => {
  const body = join(parts)
  if (body.length > 127) throw new Error(`descriptor ${tag} too long`)
  return join([u8(tag, body.length), body])
}

// The sound's sample entry. Both codecs share the audio entry's fixed fields
// and differ in the box after them: `esds` wraps AAC's AudioSpecificConfig in
// the MPEG-4 descriptors, and `dOps` states what an Opus decoder needs.
function soundEntry(a: Mp4Audio, bitrate: number): Uint8Array<ArrayBuffer> {
  const tail =
    a.codec === 'aac'
      ? fullBox(
          'esds',
          0,
          0,
          descriptor(
            0x03,
            u16(1),
            u8(0),
            descriptor(
              0x04,
              // MPEG-4 audio, an audio stream, then a buffer size nothing reads.
              u8(0x40, 0x15, 0, 0, 0),
              u32(bitrate),
              u32(bitrate),
              descriptor(0x05, a.config ?? new Uint8Array()),
            ),
            descriptor(0x06, u8(0x02)),
          ),
        )
      : box(
          'dOps',
          u8(0, a.channels),
          u16(a.preSkip),
          u32(a.sampleRate),
          u16(0),
          u8(0),
        )
  return box(
    a.codec === 'aac' ? 'mp4a' : 'Opus',
    u8(0, 0, 0, 0, 0, 0),
    u16(1),
    u32(0),
    u32(0),
    u16(a.channels),
    u16(16),
    u16(0),
    u16(0),
    u32(a.sampleRate * 0x10000),
    tail,
  )
}

// A run-length table, one entry per run of equal values: `stts` over the
// durations and `ctts` over the composition offsets. AAC's `stts` is one run,
// since every block is 1024 periods; Opus varies with its frame size.
function runTable(
  type: 'stts' | 'ctts',
  values: readonly number[],
): Uint8Array<ArrayBuffer> {
  const runs: [number, number][] = []
  for (const v of values) {
    const last = runs.at(-1)
    if (last !== undefined && last[1] === v) last[0]++
    else runs.push([1, v])
  }
  return fullBox(
    type,
    0,
    0,
    u32(runs.length),
    join(runs.flatMap(([count, v]) => [u32(count), u32(v)])),
  )
}

// One edit: show the media from `mediaTime` on, for `duration` movie ticks.
const editList = (duration: number, mediaTime: number) =>
  box(
    'edts',
    fullBox(
      'elst',
      0,
      0,
      u32(1),
      u32(duration),
      u32(mediaTime),
      u16(1),
      u16(0),
    ),
  )

// A track's samples as one chunk at `offset` in the file.
//
// `stco` holds 32-bit offsets, so a track whose samples begin past 4 GiB needs
// `co64`, which is the same table with 64-bit entries. Written only where the
// offset needs it: a reader takes the box it finds as what the file promises
// about itself, and `stco` is the one every demuxer has always had.
const oneChunk = (
  sizes: readonly number[],
  offset: number,
): Uint8Array<ArrayBuffer>[] => [
  fullBox('stsc', 0, 0, u32(1), u32(1), u32(sizes.length), u32(1)),
  fullBox('stsz', 0, 0, u32(0), u32(sizes.length), join(sizes.map(u32))),
  offset > 0xffffffff
    ? fullBox('co64', 0, 0, u32(1), u64(offset))
    : fullBox('stco', 0, 0, u32(1), u32(offset)),
]

const dinf = () =>
  box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1)))

function soundTrak(
  a: Mp4Audio,
  offset: number,
  movieDuration: number,
): Uint8Array<ArrayBuffer> {
  const frames = a.samples.reduce((n, s) => n + s.frames, 0)
  const bytes = a.samples.reduce((n, s) => n + s.data.length, 0)
  const bitrate =
    frames > 0 ? Math.round((bytes * 8 * a.sampleRate) / frames) : 0
  return box(
    'trak',
    fullBox(
      'tkhd',
      0,
      3,
      NO_DATE,
      NO_DATE,
      u32(2),
      u32(0),
      u32(movieDuration),
      u32(0),
      u32(0),
      // Layer, alternate group, full volume, reserved.
      u16(0),
      u16(1),
      u16(0x0100),
      u16(0),
      MATRIX,
      u32(0),
      u32(0),
    ),
    box(
      'mdia',
      fullBox(
        'mdhd',
        0,
        0,
        NO_DATE,
        NO_DATE,
        u32(a.sampleRate),
        u32(frames),
        u16(0x55c4),
        u16(0),
      ),
      fullBox(
        'hdlr',
        0,
        0,
        u32(0),
        str('soun'),
        u32(0),
        u32(0),
        u32(0),
        str('SoundHandler\0'),
      ),
      box(
        'minf',
        fullBox('smhd', 0, 0, u16(0), u16(0)),
        dinf(),
        box(
          'stbl',
          fullBox('stsd', 0, 0, u32(1), soundEntry(a, bitrate)),
          runTable(
            'stts',
            a.samples.map(s => s.frames),
          ),
          ...oneChunk(
            a.samples.map(s => s.data.length),
            offset,
          ),
        ),
      ),
    ),
  )
}

// Movie timescale. 1000 is conventional and is only used for the durations in
// `mvhd`/`tkhd`; the track's own timescale below is what carries the frame
// timing, and it is exact.
const MOVIE_TIMESCALE = 1000

// The brand. Invariant, and hoisted for that reason: it is half of what a
// streamed take has to reserve in front of its payload before it knows what
// the other half will say.
const FTYP = box(
  'ftyp',
  str('isom'),
  u32(512),
  str('isom'),
  str('iso2'),
  str('avc1'),
  str('mp41'),
)

// `mdat`'s header. The 32-bit size field caps a box at 4 GiB, and the form
// past that is a size of 1 followed by a 64-bit `largesize` — eight bytes more
// of header, which is why the payload's offset is read off this rather than
// assumed to be 8.
const mdatHeader = (
  payload: number,
  large: boolean,
): Uint8Array<ArrayBuffer> =>
  large
    ? join([u32(1), str('mdat'), u64(payload + 16)])
    : join([u32(payload + 8), str('mdat')])

// What a streamed take leaves in front of its payload: the brand, and an
// `mdat` header in the large form. A take being written does not know how
// large it will be, so it reserves this much, writes its picture after it, and
// patches the header in once the take is over — see `takeSink.ts`. Fixed,
// because every byte of it is.
export const STREAM_HEAD = FTYP.length + 16

// The file as one array, for a caller that has every sample's bytes to hand:
// the tests, and anything that measures the output. A take uses `mp4Parts`.
export function writeMp4(
  spec: Mp4Spec<Uint8Array<ArrayBuffer>>,
): Uint8Array<ArrayBuffer> {
  return join(mp4Parts(spec))
}

// The file as the pieces it is laid out from, the payload passed through
// untouched, so a Blob can be built without copying the take again.
export function mp4Parts<P extends Payload>(
  spec: Mp4Spec<P>,
): (Uint8Array<ArrayBuffer> | P)[] {
  const videoBytes = spec.samples.reduce((t, s) => t + s.size, 0)
  const carried = spec.video.reduce((t, p) => t + sizeOf(p), 0)
  if (carried !== videoBytes) {
    throw new Error(
      `the sample table says ${videoBytes} bytes of picture, the payload carries ${carried}`,
    )
  }
  const { head, tail } = mp4Layout(spec)
  return [head, ...spec.video, ...tail]
}

// The boxes either side of the payload, for a writer that places the payload
// itself — a take streaming to disk, which has to write the front of the file
// before it has any of it and the back of it only once it is over.
export function mp4Layout(spec: Mp4Tables): Mp4Layout {
  const { width, height, fps, samples } = spec
  // The track's timescale *is* the frame rate's numerator, so one frame is
  // exactly `den` ticks and there is no rounding anywhere. 60fps becomes
  // timescale 60 delta 1; 29.97 becomes timescale 30000 delta 1001, which is
  // the pairing broadcast has used for fifty years and which every editor
  // recognises on sight.
  const timescale = fps.num
  const delta = fps.den
  // Decode times are the presentation times sorted, pulled back by the
  // deepest reorder so that no composition offset is negative. The edit list
  // then starts the presentation where that pull-back put the first frame.
  const pts = samples.map((s, i) => (s.pts ?? i) * delta)
  const sorted = pts.toSorted((a, b) => a - b)
  let shift = 0
  for (let i = 0; i < pts.length; i++)
    shift = Math.max(shift, sorted[i]! - pts[i]!)
  const last = sorted.at(-1) ?? 0
  const end = Math.max(last + delta, (spec.end ?? 0) * delta)
  const durations = sorted.map((v, i) => (sorted[i + 1] ?? end) - v)
  const offsets = pts.map((p, i) => p - sorted[i]! + shift)
  const trackDuration = end - (sorted[0] ?? 0)
  const videoDuration = Math.round(
    (trackDuration / timescale) * MOVIE_TIMESCALE,
  )
  const audio = spec.audio
  const audioDuration =
    audio === undefined
      ? 0
      : Math.round(
          (audio.samples.reduce((t, s) => t + s.frames, 0) / audio.sampleRate) *
            MOVIE_TIMESCALE,
        )
  const movieDuration = Math.max(videoDuration, audioDuration)

  // The picture's samples, then the sound's, each track one chunk.
  const videoBytes = samples.reduce((t, s) => t + s.size, 0)
  const audioBytes = audio?.samples.reduce((t, s) => t + s.data.length, 0) ?? 0
  const payloadBytes = videoBytes + audioBytes
  // `mdat` comes before `moov` so the chunk offsets can be computed without
  // laying the movie box out twice: everything in front of the samples is the
  // brand plus this box's own header.
  const head = join([
    FTYP,
    mdatHeader(
      payloadBytes,
      spec.streamed === true || payloadBytes + 8 > 0xffffffff,
    ),
  ])
  const sampleStart = head.length

  const avc1 = box(
    'avc1',
    // Six reserved bytes and a data-reference index of 1.
    u8(0, 0, 0, 0, 0, 0),
    u16(1),
    // Version, revision, vendor, temporal and spatial quality: all zero for a
    // file nothing is streaming.
    u16(0),
    u16(0),
    u32(0),
    u32(0),
    u32(0),
    u16(width),
    u16(height),
    // 72dpi horizontal and vertical, as 16.16.
    u32(0x00480000),
    u32(0x00480000),
    u32(0),
    u16(1),
    // A 32-byte Pascal compressor name, empty.
    u8(0),
    new Uint8Array(31),
    u16(0x0018),
    // -1: no colour table.
    u16(0xffff),
    box('avcC', normaliseAvcc(spec.avcc)),
  )

  const stbl = box(
    'stbl',
    fullBox('stsd', 0, 0, u32(1), avc1),
    // One entry for every run of equal durations, so a take with no frame held
    // is one entry, which is what makes the file constant.
    runTable('stts', durations),
    ...(offsets.some(o => o !== 0) ? [runTable('ctts', offsets)] : []),
    // Which frames an editor may cut on. Omitted entirely when every frame is
    // one — that is what the format's absence means, and writing it out would
    // be a table the size of the movie saying nothing.
    ...(samples.every(s => s.key)
      ? []
      : [
          fullBox(
            'stss',
            0,
            0,
            u32(samples.filter(s => s.key).length),
            join(samples.flatMap((s, i) => (s.key ? [u32(i + 1)] : []))),
          ),
        ]),
    // One chunk holding every sample, so `stsc` is one entry rather than one
    // per frame. The sizes are listed one by one, because encoded frames are
    // not the same length.
    ...oneChunk(
      samples.map(s => s.size),
      sampleStart,
    ),
  )

  const moov = box(
    'moov',
    fullBox(
      'mvhd',
      0,
      0,
      NO_DATE,
      NO_DATE,
      u32(MOVIE_TIMESCALE),
      u32(movieDuration),
      // Rate 1.0, volume 1.0, then reserved.
      u32(0x00010000),
      u16(0x0100),
      u16(0),
      u32(0),
      u32(0),
      MATRIX,
      // Six predefined words, then the id the next track would take.
      new Uint8Array(24),
      u32(audio === undefined ? 2 : 3),
    ),
    box(
      'trak',
      // Flags 3: enabled, and in the movie.
      fullBox(
        'tkhd',
        0,
        3,
        NO_DATE,
        NO_DATE,
        u32(1),
        u32(0),
        u32(videoDuration),
        u32(0),
        u32(0),
        // Layer, alternate group, volume (0 for video), reserved.
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        MATRIX,
        // Display size as 16.16, which is what a player letterboxes to.
        u32(width * 0x10000),
        u32(height * 0x10000),
      ),
      ...(shift > 0 ? [editList(videoDuration, shift)] : []),
      box(
        'mdia',
        fullBox(
          'mdhd',
          0,
          0,
          NO_DATE,
          NO_DATE,
          u32(timescale),
          u32(trackDuration),
          // 'und', packed five bits per letter, then predefined.
          u16(0x55c4),
          u16(0),
        ),
        fullBox(
          'hdlr',
          0,
          0,
          u32(0),
          str('vide'),
          u32(0),
          u32(0),
          u32(0),
          str('VideoHandler\0'),
        ),
        box(
          'minf',
          // Graphics mode 0 and an all-zero opcolor: copy, which is the only
          // sane answer for a track nothing is composited under.
          fullBox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
          // The data is in this file, which is what the self-contained flag on
          // `url ` says — hence a `dref` with one entry and no actual URL.
          dinf(),
          stbl,
        ),
      ),
    ),
    ...(audio === undefined
      ? []
      : [soundTrak(audio, sampleStart + videoBytes, audioDuration)]),
  )

  return { head, tail: [...(audio?.samples.map(s => s.data) ?? []), moov] }
}

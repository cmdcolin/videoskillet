// Recording the canvas at a constant frame rate — the encoder half of
// docs/EDITOR.md › _Fixed-framerate export_, and the thing that separates a
// screen grab from an export an editor will conform.
//
// **What was wrong with what this replaces.** `MediaRecorder` over
// `captureStream()` timestamps by wall clock: a frame that took 40ms lands 40ms
// in, and the file records whatever the tab managed rather than what the
// simulation did. An NLE conforms that as variable-framerate and either drops
// or duplicates frames to fit a timeline — which is fatal for a piece cut to
// music, since the drift is not constant. Here every frame is handed over with
// `timestamp: i * 1e6 / fps` and the muxer writes one `stts` entry, so the file
// is constant by construction and indifferent to how long any frame took.
//
// **That is `frame`, the offline render's way in.** A live take arrives through
// `place` instead, stamped by when each frame was rendered and snapped to the
// frame grid, because a take with sound has to keep real time: see
// docs/adr/0013.
//
// **Firefox reads a WebGPU canvas here, which it will not do elsewhere.** The
// note in EDITOR.md — blank `toBlob`, no frames from `captureStream()` — is
// still true of those two APIs and is why the old path mirrored through a 2D
// canvas first. `new VideoFrame(canvas)` is a different path and works:
// measured on Nightly, a frame built straight off the WebGPU canvas comes back
// BGRA and full of picture. So the mirror is gone, and with it the extra copy
// per frame it cost.

import { mp4Parts } from './mp4'
import { startAudio } from './recordAudio'
import { audioClock, wallClock } from './takeClock'

import type { InputTap } from '../core/signal/audiostate'
import type { Sample } from './mp4'

// H.264, and neither half of the codec string is a constant.
//
// **The level.** A level caps the coded picture area, and Chrome enforces it at
// `configure` with a hard rejection — a 2560x1592 retina window codes as
// 2560x1600 = 4096000 samples against the old fixed `avc1.42002a`'s level 4.2
// budget of 2228224, and the recording never started. So the level comes from
// the frame, in macroblocks.
//
// **The profile.** Baseline was picked as "the profile every editor and phone
// decodes", which was an argument from 2010 and cost real picture. Measured on
// Chrome 141 / macOS against 16 frames of grain and one-pixel detail at
// 2560x1600, an I420 source encoded and decoded back:
//
//   baseline 5.0   175 Mbps   24.52 dB
//   main     5.0   143 Mbps   24.63 dB
//   high     5.0   143 Mbps   24.63 dB
//
// Same picture for 18% fewer bits — CABAC and the 8x8 transform, both of which
// baseline forbids and both of which are worth most on exactly this content.
// Nothing that has shipped this decade fails to decode High.
//
// Ordered best-first and probed rather than assumed: `isConfigSupported`
// discriminates here (it declines High 4:2:2 and High 10 on this machine), so a
// platform without High falls back rather than failing the take.
const PROFILES = ['6400', '4d00', '4200']

// `maxFS` from Table A-1, in 16x16 macroblocks, against the byte the codec
// string spells the level with. Ordered, and read as "the first one that fits".
const LEVELS: { code: number; maxMacroblocks: number }[] = [
  { code: 0x1e, maxMacroblocks: 1620 },
  { code: 0x1f, maxMacroblocks: 3600 },
  { code: 0x20, maxMacroblocks: 5120 },
  { code: 0x28, maxMacroblocks: 8192 },
  { code: 0x2a, maxMacroblocks: 8704 },
  { code: 0x32, maxMacroblocks: 22080 },
  { code: 0x33, maxMacroblocks: 36864 },
  { code: 0x3c, maxMacroblocks: 139264 },
]

export const codecFor = (profile: string, level: number): string =>
  `avc1.${profile}${level.toString(16).padStart(2, '0')}`

// Every codec string worth trying for this picture, best first: profile
// outermost because a lesser profile costs picture on every frame, where a
// larger level than the frame needs costs nothing at all. Within a profile the
// smallest level that fits comes first — that is the honest label, since a
// decoder reads the level as a promise about what it will be asked for.
export const candidatesFor = (width: number, height: number): string[] => {
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16)
  const levels = LEVELS.filter(l => macroblocks <= l.maxMacroblocks)
  return PROFILES.flatMap(p => levels.map(l => codecFor(p, l.code)))
}

// Bits per pixel per frame. This content is worst-case for a codec — snow,
// grain and dot crawl, a new noise field every frame — and the same 0.4 the
// `MediaRecorder` path settled on for the same reason. Floor and ceiling keep a
// tiny canvas from being starved and a fullscreen 4K one from writing a
// gigabyte a minute.
const BITS_PER_PIXEL = 0.4
const MIN_BITRATE = 16_000_000
const MAX_BITRATE = 60_000_000

const bitrateFor = (w: number, h: number, fps: number): number =>
  Math.min(MAX_BITRATE, Math.max(MIN_BITRATE, w * h * fps * BITS_PER_PIXEL))

// How often a keyframe goes in. Two seconds is the usual compromise, and it is
// the one an editor cares about: a cut lands on the nearest one, so a long
// interval makes scrubbing coarse while a short one spends bitrate.
const KEYFRAME_SECONDS = 2

// Frames the encoder may hold before `busy` says so. Nothing else bounds the
// queue: each queued frame keeps a full-size copy of the picture, and a phone's
// encoder that fell behind at 60fps piled up 400 of them, 1.4GB, in ten seconds
// (scripts/camrec.mjs).
const MAX_QUEUE = 3

// Where a take stops itself. Box sizes and chunk offsets in `mp4.ts` are 32-bit,
// so a file past 4 GiB would come out silently corrupt; this leaves room for
// the sound and the movie box.
const MAX_BYTES = 3_900_000_000

// How long a live take with sound reads the audio clock before its first frame,
// so the average the frame is placed by has something behind it: about seven
// of Firefox's refreshes. The take starts this much after the click.
const CLOCK_WARMUP_MS = 100

interface RecorderSpec {
  width: number
  height: number
  fps: { num: number; den: number }
  // The sound to take with the picture. A caller using `frame` hands it frames
  // at the wall clock's pace; `place` keeps it in step on its own.
  audio?: InputTap | null
  // 2 for what the speakers play, 1 (the default) for a microphone.
  channels?: 1 | 2
  // Whether frames arrive through `place`, which needs the audio clock read
  // ahead of the first one.
  live?: boolean
}

export interface Recorder {
  codec: string
  // Whether the platform offers a hardware encoder for this config, or null
  // where the browser will not say.
  hardware: boolean | null
  // Hand over one rendered frame. The timestamp is derived from how many have
  // been taken, never from the clock: the offline render's whole point.
  frame: (source: CanvasImageSource) => void
  // Hand over a frame of a live take, rendered at `renderedAt`
  // (performance.now()). It lands in the frame period its time falls in, on the
  // sound's clock when the take has sound and the wall clock when not, and the
  // frame before it stays up across any period nothing landed in. A frame
  // whose period is taken, or that finds the encoder `busy`, is dropped. The
  // recorder closes the frame.
  place: (frame: VideoFrame, renderedAt: number) => void
  // Whether the file has reached the size this muxer can write.
  full: () => boolean
  // Whether the encoder is too far behind to take another frame.
  busy: () => boolean
  // Keep the last frame up for one more frame period without encoding
  // anything. The file stops being constant-framerate where this is used.
  hold: () => void
  // Flush the encoder and mux. Rejects if nothing was recorded.
  finish: () => Promise<Blob>
  // Give up without producing a file: an encoder is an OS resource, and a
  // recording abandoned by a device loss or an unmount has to let it go.
  abort: () => void
  frames: () => number
  // Frame periods covered by `hold`.
  held: () => number
  // The deepest the encoder's queue has been.
  deepest: () => number
  // The last error the encoder reported, or ''. Encoding failures arrive on a
  // callback rather than as a rejected call, so they have nowhere else to go.
  error: () => string
}

export function isSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
  )
}

// H.264 is 4:2:0, so a chroma sample covers two luma samples in each direction
// and an odd dimension has nowhere to put the last one. Firefox accepts the
// `configure` and the `encode` and then fails the whole encoder on its *error
// callback* — asynchronously, with `NotSupportedError: Operation is not
// supported` and nothing naming the size — so this is worth doing here rather
// than trusting a caller to. Measured against a 440x573 canvas, which is what
// an ordinary window happens to produce.
//
// Rounded down and cropped rather than padded: a row of black at the bottom is
// a row an editor would have to be told to ignore, and one line off a 573-line
// picture is not a picture anybody can tell was cropped.
const even = (n: number): number => Math.max(2, n - (n % 2))

export async function startRecording(spec: RecorderSpec): Promise<Recorder> {
  const { fps } = spec
  const width = even(spec.width)
  const height = even(spec.height)
  const rate = fps.num / fps.den
  const samples: Sample[] = []
  let avcc: Uint8Array<ArrayBuffer> | null = null
  let bytes = 0
  let count = 0
  let held = 0
  let deepest = 0
  let failure = ''
  let closed = false

  const configFor = (codec: string): VideoEncoderConfig => ({
    codec,
    width,
    height,
    bitrate: bitrateFor(width, height, rate),
    framerate: rate,
    // Length-prefixed NAL units with the parameter sets out of band, which is
    // what an MP4 sample table wants; 'annexb' would inline them and the file
    // would need a different `stsd` entry.
    avc: { format: 'avc' },
    // The picture is a new noise field every frame, so there is little for a
    // realtime rate controller to work with and no reason to ask it to hit a
    // deadline: this is a file, not a stream.
    latencyMode: 'quality',
  })

  // Asked rather than assumed. The level that fits the picture is not always
  // one the platform encoder implements, and `configure` reports that by
  // throwing — which would surface as a failed recording rather than as a
  // choice this function could have made differently.
  let codec = ''
  for (const candidate of candidatesFor(width, height)) {
    const { supported } = await VideoEncoder.isConfigSupported(
      configFor(candidate),
    )
    if (supported === true) {
      codec = candidate
      break
    }
  }
  if (codec === '') {
    throw new Error(
      `no supported H.264 level for ${width}x${height} at ${Math.round(rate)}fps`,
    )
  }

  const hardware = await VideoEncoder.isConfigSupported({
    ...configFor(codec),
    hardwareAcceleration: 'prefer-hardware',
  }).then(
    r => r.supported === true,
    () => null,
  )

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      // The parameter sets arrive once, on the first chunk. Kept rather than
      // re-read, because later chunks carry no metadata at all and a file
      // without an avcC record is a file nothing can decode.
      // `description` is typed as a union of every buffer-ish thing, because
      // the spec allows any of them. Copied rather than wrapped either way: it
      // belongs to the encoder, which is about to be closed.
      const description = meta?.decoderConfig?.description
      if (avcc === null && description !== undefined) {
        avcc = (
          ArrayBuffer.isView(description)
            ? new Uint8Array(
                description.buffer,
                description.byteOffset,
                description.byteLength,
              )
            : new Uint8Array(description)
        ).slice()
      }
      const data = new Uint8Array(chunk.byteLength)
      chunk.copyTo(data)
      bytes += data.length
      // Presentation time in frame periods, off the frame's own timestamp: the
      // encoder hands chunks over in decode order.
      samples.push({
        data,
        key: chunk.type === 'key',
        pts: Math.round((chunk.timestamp * fps.num) / (1e6 * fps.den)),
      })
    },
    error: e => {
      failure = e instanceof Error ? e.message : String(e)
    },
  })

  encoder.configure(configFor(codec))
  // A take whose sound cannot be encoded is still a take, silent. So is one
  // whose context is not running: its clock stands still, and every frame would
  // land in the first period.
  const tap =
    spec.audio === undefined || spec.audio === null ? null : spec.audio
  if (tap !== null && tap.context.state !== 'running')
    await Promise.race([
      tap.context.resume().catch(() => {}),
      new Promise(r => setTimeout(r, CLOCK_WARMUP_MS)),
    ])
  const sound =
    tap === null || tap.context.state !== 'running'
      ? null
      : await startAudio(tap, spec.channels ?? 1).catch(() => null)

  const clock = sound === null ? wallClock() : audioClock(sound.context)
  const sampler =
    spec.live === true && sound !== null ? setInterval(clock.sample, 2) : 0
  if (sampler !== 0) await new Promise(r => setTimeout(r, CLOCK_WARMUP_MS))
  const keyEvery = Math.max(1, Math.round(rate * KEYFRAME_SECONDS))
  const period = (1e6 * fps.den) / fps.num
  // The take's start on its clock, and the period the last placed frame took.
  let origin: number | null = null
  let last = -1

  return {
    codec,
    hardware,
    frames: () => count,
    held: () => held,
    deepest: () => deepest,
    error: () => failure,
    busy: () => encoder.encodeQueueSize >= MAX_QUEUE,
    full: () => bytes >= MAX_BYTES,
    hold: () => {
      if (closed) return
      held++
      count++
    },
    place: (frame, renderedAt) => {
      if (closed || encoder.state !== 'configured') {
        frame.close()
        return
      }
      clock.sample()
      const t = clock.at(renderedAt)
      if (origin === null) {
        origin = t
        sound?.origin(Math.round(t * sound.context.sampleRate))
      }
      const slot = Math.round((t - origin) * rate)
      if (slot <= last || encoder.encodeQueueSize >= MAX_QUEUE) {
        frame.close()
        return
      }
      const stamped = new VideoFrame(frame, {
        timestamp: Math.round(slot * period),
        duration: Math.round(period),
        visibleRect: { x: 0, y: 0, width, height },
      })
      frame.close()
      encoder.encode(stamped, {
        keyFrame:
          last < 0 || Math.floor(slot / keyEvery) > Math.floor(last / keyEvery),
      })
      deepest = Math.max(deepest, encoder.encodeQueueSize)
      stamped.close()
      held += Math.max(0, slot - last - 1)
      last = slot
      count = slot + 1
    },
    frame: source => {
      if (closed || encoder.state !== 'configured') return
      // Microseconds, off the count and never off a clock. A frame that took
      // 200ms to render still lands exactly one frame after its predecessor,
      // which is the property the whole file is for.
      const timestamp = Math.round((count * 1e6 * fps.den) / fps.num)
      const duration = Math.round((1e6 * fps.den) / fps.num)
      const frame = new VideoFrame(source, {
        timestamp,
        duration,
        // Cropped to the even size the encoder was configured with — see
        // `even` above. A frame whose size disagrees with the configuration is
        // the other way to fail this encoder asynchronously.
        visibleRect: { x: 0, y: 0, width, height },
      })
      encoder.encode(frame, {
        keyFrame:
          count % Math.max(1, Math.round(rate * KEYFRAME_SECONDS)) === 0,
      })
      deepest = Math.max(deepest, encoder.encodeQueueSize)
      // Closed at once rather than left to the collector: a VideoFrame holds a
      // GPU or system buffer, and a few unreleased ones stall the encoder
      // outright.
      frame.close()
      if (count === 0) sound?.go()
      count++
    },
    abort: () => {
      clearInterval(sampler)
      closed = true
      sound?.abort()
      if (encoder.state !== 'closed') encoder.close()
      samples.length = 0
    },
    finish: async () => {
      clearInterval(sampler)
      closed = true
      // A live take lasts until it was stopped, so its last frame stays up
      // until then, as long as the sound runs.
      const end =
        origin === null
          ? count
          : Math.max(
              count,
              Math.round((clock.at(performance.now()) - origin) * rate),
            )
      // The sound stops with the last frame, before the picture's flush, which
      // takes long enough to leave the sound half a second over.
      const heard = sound === null ? Promise.resolve(null) : sound.finish()
      if (encoder.state === 'configured') await encoder.flush()
      if (encoder.state !== 'closed') encoder.close()
      if (failure !== '') throw new Error(failure)
      if (samples.length === 0) throw new Error('nothing was recorded')
      if (avcc === null) {
        throw new Error('the encoder produced no parameter sets')
      }
      const audio = await heard
      // The Blob takes the file in the pieces it is laid out from. Joining them
      // first would hold the take in memory twice more, for nothing.
      const parts = mp4Parts({
        width,
        height,
        fps,
        avcc,
        samples,
        end,
        ...(audio === null ? {} : { audio }),
      })
      return new Blob(parts, { type: 'video/mp4' })
    },
  }
}

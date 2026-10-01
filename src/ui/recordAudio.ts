import tapUrl from './tap.worklet.js?url'

import type { InputTap } from '../core/signal/audiostate'
import type { AudioSample, Mp4Audio } from './mp4'

// A take's sound, from its origin to `finish`.
export interface AudioTake {
  context: AudioContext
  // Where the take starts, in sample frames of the context's clock. The tap
  // stamps every block with the frame it was processed at, so sound from before
  // the origin is cut off at the exact sample.
  origin: (frame: number) => void
  // The origin at the context's current time, for a caller with no clock of
  // its own to place it by.
  go: () => void
  // Null when nothing was kept, which leaves the take silent.
  finish: () => Promise<Mp4Audio | null>
  abort: () => void
}

// AAC first, because it is what a phone's photo library and every editor
// expect. Opus is the fallback for a browser with no AAC encoder, such as
// Firefox on Linux. Opus in MP4 plays in the browsers but not everywhere else.
const CODECS = [
  { codec: 'aac', string: 'mp4a.40.2', frames: 1024 },
  { codec: 'opus', string: 'opus', frames: 960 },
] as const

const BITRATE = 128_000

// Opus's lookahead at 48 kHz when the encoder does not state one: libopus's
// default of 6.5 ms.
const OPUS_PRESKIP = 312

// The OpusHead the encoder may hand over carries the true pre-skip,
// little-endian at byte 10.
const preSkipOf = (head: Uint8Array<ArrayBuffer> | null): number =>
  head !== null && head.length >= 12 ? head[10] | (head[11] << 8) : OPUS_PRESKIP

const bytesOf = (d: AllowSharedBufferSource): Uint8Array<ArrayBuffer> =>
  (ArrayBuffer.isView(d)
    ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength)
    : new Uint8Array(d)
  ).slice()

// Blocks kept while the take waits for its origin. The origin is set by the
// first frame of picture, a moment after the tap starts, so two seconds is
// ample and bounds a take that never gets a frame.
const EARLY_FRAMES_MAX = 2 * 48_000

// The tap into an encoder, or null where the browser encodes neither codec,
// which leaves the take silent rather than failing it. Mono for the mic, and
// stereo for what the speakers play, where the reverb's two tails are what
// make it wide.
export async function startAudio(
  tap: InputTap,
  channels: 1 | 2 = 1,
): Promise<AudioTake | null> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined')
    return null
  const ctx = tap.context
  const rate = ctx.sampleRate
  const configFor = (codec: string): AudioEncoderConfig => ({
    codec,
    sampleRate: rate,
    numberOfChannels: channels,
    bitrate: BITRATE * channels,
  })
  let pick: (typeof CODECS)[number] | null = null
  for (const c of CODECS) {
    const { supported } = await AudioEncoder.isConfigSupported(
      configFor(c.string),
    )
    if (supported === true) {
      pick = c
      break
    }
  }
  if (pick === null) return null
  const chosen = pick
  // Opus runs on a 48 kHz clock whatever rate it was fed at.
  const clock = chosen.codec === 'opus' ? 48000 : rate

  const samples: AudioSample[] = []
  let config: Uint8Array<ArrayBuffer> | null = null
  let failure = ''
  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      const description = meta?.decoderConfig?.description
      if (config === null && description !== undefined)
        config = bytesOf(description)
      const data = new Uint8Array(chunk.byteLength)
      chunk.copyTo(data)
      const frames =
        chunk.duration === null
          ? chosen.frames
          : Math.round((chunk.duration * clock) / 1e6)
      samples.push({ data, frames })
    },
    error: e => {
      failure = e instanceof Error ? e.message : String(e)
    },
  })
  encoder.configure(configFor(chosen.string))

  await ctx.audioWorklet.addModule(tapUrl)
  const node = new AudioWorkletNode(ctx, 'take-tap', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: channels,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
    processorOptions: { channels },
  })
  // Nothing pulls a node that leads nowhere, so it feeds a muted gain that
  // reaches the speakers.
  const mute = ctx.createGain()
  mute.gain.value = 0
  node.connect(mute).connect(ctx.destination)
  const unlisten = tap.listen(node)

  let start = -1
  let ended: (() => void) | null = null
  const early: {
    pcm: Float32Array<ArrayBuffer>
    frames: number
    at: number
  }[] = []
  let earlyFrames = 0
  // A block is planar, one channel after another. The part of it before the
  // origin is cut off, channel by channel.
  const encode = (
    pcm: Float32Array<ArrayBuffer>,
    frames: number,
    at: number,
  ) => {
    const skip = Math.max(0, start - at)
    const n = frames - skip
    if (n <= 0 || encoder.state !== 'configured') return
    let data = pcm
    if (skip > 0) {
      data = new Float32Array(n * channels)
      for (let c = 0; c < channels; c++)
        data.set(pcm.subarray(c * frames + skip, (c + 1) * frames), c * n)
    }
    const audio = new AudioData({
      format: 'f32-planar',
      sampleRate: rate,
      numberOfFrames: n,
      numberOfChannels: channels,
      timestamp: Math.round(((at + skip - start) * 1e6) / rate),
      data,
    })
    encoder.encode(audio)
    audio.close()
  }
  const onBlock = (
    e: MessageEvent<{
      pcm: Float32Array<ArrayBuffer>
      frames: number
      at: number
      last: boolean
    }>,
  ) => {
    const { pcm, frames, at, last } = e.data
    if (frames > 0) {
      if (start >= 0) encode(pcm, frames, at)
      else {
        early.push({ pcm, frames, at })
        earlyFrames += frames
        while (earlyFrames > EARLY_FRAMES_MAX && early.length > 1)
          earlyFrames -= early.shift()?.frames ?? 0
      }
    }
    if (last) ended?.()
  }
  const origin = (frame: number) => {
    if (start >= 0) return
    start = frame
    for (const b of early) encode(b.pcm, b.frames, b.at)
    early.length = 0
  }
  node.port.addEventListener('message', onBlock)
  node.port.start()

  const release = () => {
    unlisten()
    node.port.removeEventListener('message', onBlock)
    node.disconnect()
    mute.disconnect()
    if (encoder.state !== 'closed') encoder.close()
  }

  return {
    context: ctx,
    origin,
    go: () => origin(Math.round(ctx.currentTime * rate)),
    abort: () => {
      node.port.postMessage('stop', [])
      release()
    },
    finish: async () => {
      // A suspended context never answers, and a take must still end.
      await new Promise<void>(done => {
        ended = done
        node.port.postMessage('stop', [])
        setTimeout(done, 500)
      })
      if (encoder.state === 'configured') await encoder.flush()
      release()
      if (failure !== '' || samples.length === 0) return null
      if (chosen.codec === 'aac' && config === null) return null
      return {
        codec: chosen.codec,
        sampleRate: clock,
        channels,
        config: chosen.codec === 'aac' ? config : null,
        preSkip: chosen.codec === 'opus' ? preSkipOf(config) : 0,
        samples,
      }
    },
  }
}

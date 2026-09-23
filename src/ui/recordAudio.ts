import tapUrl from './tap.worklet.js?url'

import type { InputTap } from '../core/signal/audiostate'
import type { AudioSample, Mp4Audio } from './mp4'

// A take's sound, from the tap's first block to `finish`.
export interface AudioTake {
  // Start keeping sound. The recorder calls it with the first frame of picture.
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
const preSkipOf = (head: Uint8Array | null): number =>
  head !== null && head.length >= 12 ? head[10] | (head[11] << 8) : OPUS_PRESKIP

const bytesOf = (d: AllowSharedBufferSource): Uint8Array =>
  ArrayBuffer.isView(d)
    ? new Uint8Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength))
    : new Uint8Array(d.slice(0))

// The mic through the tap into an encoder, or null where the browser encodes
// neither codec, which leaves the take silent rather than failing it.
export async function startAudio(tap: InputTap): Promise<AudioTake | null> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined')
    return null
  const ctx = tap.context
  const rate = ctx.sampleRate
  const configFor = (codec: string): AudioEncoderConfig => ({
    codec,
    sampleRate: rate,
    numberOfChannels: 1,
    bitrate: BITRATE,
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
  let config: Uint8Array | null = null
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
    channelCount: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  })
  // Nothing pulls a node that leads nowhere, so it feeds a muted gain that
  // reaches the speakers.
  const mute = ctx.createGain()
  mute.gain.value = 0
  node.connect(mute).connect(ctx.destination)
  const unlisten = tap.listen(node)

  let taken = 0
  let ended: (() => void) | null = null
  const onBlock = (
    e: MessageEvent<{ pcm: Float32Array<ArrayBuffer>; last: boolean }>,
  ) => {
    const { pcm, last } = e.data
    if (pcm.length > 0 && encoder.state === 'configured') {
      const data = new AudioData({
        format: 'f32-planar',
        sampleRate: rate,
        numberOfFrames: pcm.length,
        numberOfChannels: 1,
        timestamp: Math.round((taken * 1e6) / rate),
        data: pcm,
      })
      encoder.encode(data)
      data.close()
      taken += pcm.length
    }
    if (last) ended?.()
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
    go: () => node.port.postMessage('go', []),
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
        channels: 1,
        config: chosen.codec === 'aac' ? config : null,
        preSkip: chosen.codec === 'opus' ? preSkipOf(config) : 0,
        samples,
      }
    },
  }
}

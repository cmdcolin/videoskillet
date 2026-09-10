// Audio for the offline renderer, both directions.
//
// **In**, because without it the picture is wrong rather than merely quiet. The
// audio-reactive controls are not an effect laid on top: `audioBendUs`,
// `audioLoad` and `audioIre` drive vertical hold, HV sag and the demodulator's
// reference, so a look built over a track and rendered in silence comes back
// with the artifacts that should be pumping sitting still. A render with no
// audio is a render of a different board.
//
// **Out**, because the buzz is an output of the instrument. `buzz_tap.wgsl`
// measures the composite the receiver locked to and `signal/buzz.ts` turns it
// into sound, so a bright scene buzzes louder and a head switch clicks on the
// line it damages. None of that survives a silent file.
//
// The offline side is the more defensible of the two paths, and worth saying
// plainly: a browser hands the analyser whatever arrived on its own audio
// clock, where this cuts the window at the frame the render is on. Two renders
// of one take agree here; two live takes never did.

// Declared here rather than imported from `audiostate.ts`, for the reason
// `gpuprof/main.ts` gives about presets: the type graph is followed by
// `deno check`, and `audiostate.ts` reaches `buzz.ts`, which imports its
// worklet through Vite's `?url` and pulls in Web Audio besides. The values all
// come from the bundle; only this shape is restated, and `audiostate.ts` owns
// it — `AnalysisSource` there is what this has to match.
interface AnalysisSource {
  sampleRate: number
  timeDomain: (out: Float32Array) => void
  frequency: (out: Float32Array) => void
}

// `AnalyserNode.fftSize` as `audiostate.ts` configures it. Restated for the
// same reason as the interface, and it is checked at runtime: the engine sizes
// its own buffers off `setAnalysisSource`, so a disagreement would show as a
// short window rather than a crash.
const ANALYSIS_FFT = 2048

// What the analyser this replaces is configured with (`AnalyserNode` defaults,
// and `audiostate.ts` sets `fftSize` to match).
const SMOOTHING = 0.8

// Mono, float, at one rate whatever the file holds. 48k because the window
// arithmetic in `lowEnergy` is in Hz and the rate only has to be *known*.
export const AUDIO_RATE = 48000

export async function decodeAudio(path: string): Promise<Float32Array | null> {
  const out = await new Deno.Command('ffmpeg', {
    args: [
      '-v',
      'error',
      '-i',
      path,
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(AUDIO_RATE),
      '-f',
      'f32le',
      '-',
    ],
    stdout: 'piped',
    stderr: 'piped',
  }).output()
  // A file with no audio track is not a failure — most patterns and plenty of
  // clips have none, and the render carries on in silence with the artifacts
  // that do not depend on it.
  if (!out.success || out.stdout.length === 0) return null
  return new Float32Array(
    out.stdout.buffer.slice(
      out.stdout.byteOffset,
      out.stdout.byteOffset + out.stdout.byteLength,
    ),
  )
}

// In-place radix-2 FFT. Written out rather than depended on for the same reason
// `ui/mp4.ts` is: one transform of one fixed power-of-two size, against a
// dependency that carries every size and every layout.
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k]
        const ai = im[i + k]
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ar + br
        im[i + k] = ai + bi
        re[i + k + len / 2] = ar - br
        im[i + k + len / 2] = ai - bi
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

// The window `AnalyserNode` applies before its transform. Matched because
// `lowEnergy` reads the result as calibrated dB, so the window's coherent gain
// sits in every number it produces.
const blackman = (n: number, N: number): number =>
  0.42 -
  0.5 * Math.cos((2 * Math.PI * n) / N) +
  0.08 * Math.cos((4 * Math.PI * n) / N)

// A track, positioned by frame, presenting itself the way an analyser does.
export class OfflineAnalysis implements AnalysisSource {
  readonly sampleRate = AUDIO_RATE
  private at = 0
  private readonly win = new Float32Array(ANALYSIS_FFT)
  private readonly re = new Float32Array(ANALYSIS_FFT)
  private readonly im = new Float32Array(ANALYSIS_FFT)
  // The smoothed magnitudes an analyser carries between calls. Keeping them is
  // what makes the spectrum a running measurement rather than a per-frame one,
  // and `stepHit` reads flux, so it is the difference between frames that this
  // state decides.
  private readonly smoothed = new Float32Array(ANALYSIS_FFT / 2)
  private spectrumFrame = -1

  constructor(
    private readonly samples: Float32Array,
    private readonly fps: number,
  ) {}

  // Where in the track frame `n` is. The render's clock, not a wall clock.
  seek(frame: number): void {
    this.at = Math.round((frame / this.fps) * AUDIO_RATE)
  }

  timeDomain(out: Float32Array): void {
    const start = this.at - out.length
    for (let i = 0; i < out.length; i++) {
      const at = start + i
      out[i] = at >= 0 && at < this.samples.length ? this.samples[at] : 0
    }
  }

  frequency(out: Float32Array): void {
    // The transform is over the same window `timeDomain` just handed out, so it
    // runs once per frame however many times it is asked for.
    if (this.spectrumFrame !== this.at) {
      this.spectrumFrame = this.at
      this.timeDomain(this.win)
      for (let i = 0; i < ANALYSIS_FFT; i++) {
        this.re[i] = this.win[i] * blackman(i, ANALYSIS_FFT)
        this.im[i] = 0
      }
      fft(this.re, this.im)
      for (let k = 0; k < this.smoothed.length; k++) {
        const mag =
          Math.sqrt(this.re[k] * this.re[k] + this.im[k] * this.im[k]) /
          ANALYSIS_FFT
        this.smoothed[k] = SMOOTHING * this.smoothed[k] + (1 - SMOOTHING) * mag
      }
    }
    for (let k = 0; k < out.length; k++) {
      // dB, floored rather than -Infinity: `lowEnergy` maps the bottom 60 dB to
      // zero anyway, and a -Infinity in an array somebody later averages is a
      // NaN waiting to happen.
      out[k] =
        this.smoothed[k] > 0
          ? Math.max(-200, 20 * Math.log10(this.smoothed[k]))
          : -200
    }
  }
}

// Where the audio for the file comes from. The buzz is the instrument's own
// output and the source track is what was played into it; a real set makes both
// noises at once, which is why `both` is the default and not a compromise.
export type AudioMode = 'auto' | 'buzz' | 'source' | 'none'

// PCM in the containers that take it, AAC in the ones that do not. ProRes lands
// in a .mov and every NLE expects uncompressed audio beside it.
export const audioCodecFor = (path: string): string[] =>
  /\.(mov|mkv|avi|mxf)$/i.test(path)
    ? ['-c:a', 'pcm_s16le']
    : ['-c:a', 'aac', '-b:a', '256k']

// Fold the rendered picture, the buzz and the source track into one file.
//
// A second pass rather than a second pipe into the first ffmpeg: one process
// takes one stdin, and the alternatives — a fifo, an inherited descriptor — are
// more moving parts than a copy of an already-encoded video stream. `-c:v copy`
// means the picture is not re-encoded, so this costs a file copy and no
// quality.
export async function mux(
  videoPath: string,
  outPath: string,
  buzzPath: string | null,
  sourcePath: string | null,
  buzzRate: number,
): Promise<void> {
  const args = ['-v', 'error', '-y', '-i', videoPath]
  const inputs: string[] = []
  if (buzzPath !== null) {
    args.push(
      '-f',
      'f32le',
      '-ar',
      String(buzzRate),
      '-ac',
      '1',
      '-i',
      buzzPath,
    )
    inputs.push(`${inputs.length + 1}:a`)
  }
  if (sourcePath !== null) {
    args.push('-i', sourcePath)
    inputs.push(`${inputs.length + 1}:a`)
  }
  args.push('-map', '0:v', '-c:v', 'copy')
  if (inputs.length === 1) {
    args.push('-map', inputs[0], ...audioCodecFor(outPath))
  } else if (inputs.length > 1) {
    // Summed rather than laid on separate tracks: what a set does is make both
    // noises through one speaker, and an editor opening two audio streams has
    // to be told which is which.
    args.push(
      '-filter_complex',
      `${inputs.map(i => `[${i}]`).join('')}amix=inputs=${inputs.length}:normalize=0[a]`,
      '-map',
      '[a]',
      ...audioCodecFor(outPath),
    )
  }
  args.push('-shortest', outPath)
  const out = await new Deno.Command('ffmpeg', {
    args,
    stdout: 'piped',
    stderr: 'piped',
  }).output()
  if (!out.success) {
    throw new Error(
      `ffmpeg could not mux the audio:\n${new TextDecoder().decode(out.stderr).trim()}`,
    )
  }
}

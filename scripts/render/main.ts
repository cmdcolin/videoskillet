// Run a look over a video file, offline, with no browser in the room.
//
//   pnpm render in.mp4 out.mov --look='#p=mD.FbQB…'
//   pnpm render in.mp4 out.mov --preset=wornTape --seconds=10
//   pnpm render in.mp4 out.mov --set=noiseIre:9,hHold:0.2 --codec=prores
//   pnpm render --pattern=bars out.mov --seconds=5
//
// **Why this exists when the app already writes an MP4.** The tray's ⎙ render
// is one take at a time, in a tab, in whichever browser you are sitting in —
// and what a browser will encode turned out to be the binding constraint on
// picture quality. `scripts/enccheck.mjs` measures it: H.264 4:2:0 scores
// 9.03 dB against one-pixel chroma detail through the app's own input path,
// where AV1 4:4:4 scores 42.63 — and Firefox, which this project develops
// against, will not encode 4:4:4 at all. Here the encoder is ffmpeg, so ProRes
// 4444 and DNxHR are one flag and the browser's codec roster stops mattering.
//
// It is also the honest shape for this simulator. Frame N is a function of
// every frame before it — the feedback loops see to that — so there is no
// seeking, and a renderer that walks a file from the top is not a compromise,
// it is the only correct way to do it. The FAQ's answer to "why not an NLE
// plugin" is the same argument.
//
// **It runs the app's own engine.** Not a copy of the pass graph: `entry.ts`
// bundles `core/gpu/pipeline.ts` itself, so a look renders here exactly as it
// renders in the tab. See `vite.render.config.ts` for why a bundle is involved.

import './runtime.ts'
import { AUDIO_RATE, decodeAudio, mux, OfflineAnalysis } from './audio.ts'
import { CODECS, ffmpegDecode, ffmpegEncode, probeFrames } from './ffmpeg.ts'
import { pattern } from './pattern.ts'

// From the source rather than from the bundle: a bundle is JavaScript, so the
// types do not survive it, and `controls.ts` is plain TypeScript that Deno
// resolves directly. The values still come from the bundle — only a type
// crosses here, and `verbatimModuleSyntax` keeps it from becoming an import.
import type { Controls } from '../../src/core/controls.ts'
import type { AudioMode } from './audio.ts'

const flag = (name: string): string | undefined => {
  const hit = Deno.args.find(a => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}
const has = (name: string): boolean => Deno.args.includes(`--${name}`)
const positional = Deno.args.filter(a => !a.startsWith('--'))

if (has('help') || positional.length === 0) {
  console.log(`videoskillet render — the signal path over a file, offline.

  render <in> <out> [options]
  render <out> [options]          when the look names its own source

  --look=<url>                  a whole address bar off the app
  --preset=<name>               a built-in preset by name
  --set=<key:value,…>           controls by name, applied over the above
  --seconds=<n>                 how much to render (default: the whole input)
  --fps=<n>                     output rate (default 60, the simulation's own)
  --seed=<n>                    the dice; same seed, same file
  --motion=<0..1>               the bay's master amount (default 1)
  --bpm=<n>                     tempo, for routings locked to a clock
  --pattern=<bars|sweep|none>   a generated source, over what the link says
  --codec=<${Object.keys(CODECS).join('|')}>
  --audio=<auto|buzz|source|none>
  --quiet                       no progress line

--look takes the link whole and reads it with the app's own parser, so the
board, the modulation bay, the source mode, the caption and the seed all arrive
together. Every demo in the README renders as it stands.

Audio is not decoration: bass drives vertical hold and HV sag, so a look built
over a track renders differently in silence. --audio=auto feeds the input's own
sound in, and writes the intercarrier buzz beside it when the look asks for one.

Every control name is in docs/EFFECTS.md. A link off the app works whole:
copy the address bar and pass it as --look.`)
  Deno.exit(0)
}

const {
  ACTIVE_HEIGHT,
  ACTIVE_WIDTH,
  AudioState,
  DEFAULT_CONTROLS,
  dcState,
  detect,
  EMPTY_SLOT,
  Engine,
  LINES,
  parseSessionParams,
  PRESET_BY_NAME,
  presetControls,
  smpteBarsPixels,
  sweepPixels,
  toEngineSlots,
} = await import('./build/engine.js')

// Everything a link says, read by the app's own parser.
//
// `--look` takes a whole address bar, and giving it to `parseSessionParams`
// rather than picking `p=` out with a regex is what makes the two agree: the
// same layering (landing look, then preset, then `p=`, then `set=`), the same
// checksum on the packed form, and — the part a regex was never going to reach
// — the same `mod=`, `src=`, `seed=` and caption. A link whose motion lives in
// the bay used to render at its resting frame, which is the same shape of bug
// silence was.
function session() {
  const linked = flag('look') ?? ''
  // Either sigil and either half, the way the app takes them: it writes the
  // hash and reads both, so a link copied from anywhere works whole. A bare
  // packed payload with no `p=` in front of it is spelled out into one.
  const at = Math.min(
    ...[linked.indexOf('?'), linked.indexOf('#')].filter(i => i !== -1),
    linked.length,
  )
  const search =
    linked === ''
      ? ''
      : at === linked.length
        ? `?p=${linked}`
        : `?${linked.slice(at + 1)}`

  const preset = flag('preset')
  if (preset !== undefined && !PRESET_BY_NAME.has(preset)) {
    console.error(`no preset named ${preset}`)
    Deno.exit(2)
  }
  const parsed = parseSessionParams(search)
  // A `--preset` under a `--look`, so naming both layers the way a link
  // carrying `?preset=` under its own `?set=` does.
  const base =
    preset === undefined
      ? { ...DEFAULT_CONTROLS }
      : presetControls(PRESET_BY_NAME.get(preset)!.patch)
  const controls: Controls = { ...base, ...parsed.controls }
  const set = flag('set')
  if (set !== undefined) applySet(controls, set)
  return { ...parsed, controls }
}

function applySet(c: Controls, text: string): void {
  for (const pair of text.split(',')) {
    if (pair === '') continue
    const at = pair.indexOf(':')
    const key = (at === -1 ? pair : pair.slice(0, at)).trim()
    const value = Number(pair.slice(at + 1))
    if (!(key in DEFAULT_CONTROLS)) {
      console.error(`no control named ${key} — see docs/EFFECTS.md`)
      Deno.exit(2)
    }
    if (!Number.isFinite(value)) {
      console.error(`${key} was given no number`)
      Deno.exit(2)
    }
    ;(c as unknown as Record<string, number>)[key] = value
  }
}

// Anything ffmpeg could not do, said in its words and without a stack trace.
// A missing input file is a typo, not a crash, and it should read like one.
function fail(e: unknown): never {
  console.error(`\n${e instanceof Error ? e.message : String(e)}`)
  Deno.exit(1)
}

const link = session()
const controls = link.controls
const fps = Number(flag('fps') ?? 60)
// A link may name the dice itself (`?seed=`), and `--seed` overrides it. Same
// precedence as everything else here: the flag is the later word.
const seed = Number(flag('seed') ?? link.seed ?? 1)
const quiet = has('quiet')
const codec = flag('codec') ?? 'prores'
if (!(codec in CODECS)) {
  console.error(
    `no codec named ${codec} — one of ${Object.keys(CODECS).join(', ')}`,
  )
  Deno.exit(2)
}

// One positional is an output and two are a file and an output. A link that
// names its own source (`?src=vhs+static`, a pattern, the synth) needs no input
// file, and neither does `--pattern`, so requiring a placeholder for one would
// be a word with nothing to say.
const patternName = flag('pattern')
const input = positional.length > 1 ? positional[0] : null
const output = positional.length > 1 ? positional[1] : positional[0]
if (output === undefined) {
  console.error('no output file')
  Deno.exit(2)
}

const seconds = flag('seconds') === undefined ? null : Number(flag('seconds'))
// How many frames to render. An explicit `--seconds` wins; failing that the
// input's own length, which is what "run the look over this clip" means; and
// failing both — a generated pattern with no length of its own — ten seconds,
// the same fallback the app's ⎙ button lands on.
let frames: number
if (seconds !== null) frames = Math.round(seconds * fps)
else if (input !== null) frames = await probeFrames(input, fps)
else frames = 10 * fps

const audioMode = (flag('audio') ?? 'auto') as AudioMode
if (!['auto', 'buzz', 'source', 'none'].includes(audioMode)) {
  console.error(`no audio mode named ${audioMode}`)
  Deno.exit(2)
}

// The track, decoded before the engine exists because whether there is one
// decides how the engine is set up.
const track =
  audioMode === 'none' || input === null ? null : await decodeAudio(input)
const analysis = track === null ? null : new OfflineAnalysis(track, fps)

const canvas = new OffscreenCanvas(ACTIVE_WIDTH, ACTIVE_HEIGHT)
// The engine is handed an AudioState of our own so the analysis source can be
// set on it — the same object the live app builds, reading a track instead of a
// microphone.
const audioState = new AudioState()
if (analysis !== null) audioState.setAnalysisSource(analysis)
const engine = await Engine.create(canvas as never, { audio: audioState })
// The loop was started by the constructor and has nothing to run on here, but
// stopping it is what makes the clock the render's — the same first move
// `ui/render.ts` makes, for the same reason.
engine.pauseLoop()
engine.startTake({ fps, seed })
engine.applyControls(controls)

// **The bay, which is half of what a published link is.** Every demo in the
// README carries a `?mod=`, and a routing that never reaches the engine renders
// the look at its resting frame — a still of a patch that was supposed to
// wander. `toEngineSlots` is the same conversion `useModSlots` runs each render,
// so the master amount and the tempo lock behave as they do in the panel; the
// tempo is whatever `--bpm` says, since a render has no tap and no MIDI clock.
const bpm: number | null =
  flag('bpm') === undefined ? null : Number(flag('bpm'))
const routings = link.mod ?? []
if (routings.length > 0) {
  // Retyped at the boundary because the bundle is JavaScript: TypeScript infers
  // `bpm` from its `= null` default and decides the parameter is `null`. The
  // real signature is `modSlots.ts`'s, which takes the tempo or nothing.
  const slotsFor = toEngineSlots as unknown as (
    slots: readonly unknown[],
    master: number,
    bpm: number | null,
  ) => never[]
  engine.setModSlots(
    slotsFor(
      routings.map(r => ({ ...EMPTY_SLOT, ...r, on: true })),
      Number(flag('motion') ?? 1),
      bpm,
    ),
  )
}

// What the link put on the deck, for the sources that need nothing fetched.
// The rest — a clip, a still, a pool pick — is what the positional input is
// for, and a link naming one renders over whatever file was given instead.
const NOISE: Record<string, number> = {
  'tv static': 1,
  'vhs static': 2,
  synth: 3,
}
const linkPattern =
  link.src === 'bars' ? 'bars' : link.src === 'sweep' ? 'sweep' : null
if (link.src !== null && link.src in NOISE) {
  engine.setNoiseSource(NOISE[link.src])
}
if (link.srcb !== null) {
  if (link.srcb === 'none') engine.setSourceBEnabled(false)
  else if (link.srcb in NOISE) engine.setNoiseSourceB(NOISE[link.srcb])
}
if (link.caption !== '') engine.setCaption(link.caption)

// The buzz, if anyone is listening. `buzzDrive` gates the tap pass, the
// readback and the push alike on this switch, so leaving it off is what makes
// `--audio=source` cost nothing rather than compute a track and discard it.
const wantBuzz = audioMode === 'auto' || audioMode === 'buzz'
const BUZZ_RATE = LINES * fps
const buzzChunks: Float32Array[] = []
let buzzTaps = 0
if (wantBuzz) {
  engine.setSoundOut(true)
  const dc = dcState()
  // Seeded, so the hiss is the same hiss on a re-render. The picture's dice
  // come from `startTake`; this is the sound's, and it is the same argument.
  let n = seed >>> 0
  const rand = () => {
    n = (n * 1664525 + 1013904223) >>> 0
    return n / 4294967296
  }
  engine.audioState.setBuzzSink((tap: Float32Array, drive: number) => {
    const out = new Float32Array(tap.length / 2)
    detect(tap, out, dc, drive, rand)
    buzzChunks.push(out)
    buzzTaps++
  })
}

const source =
  input === null
    ? pattern(
        patternName ?? linkPattern ?? (link.src === null ? 'bars' : 'none'),
        smpteBarsPixels,
        sweepPixels,
      )
    : ffmpegDecode(input, ACTIVE_WIDTH, ACTIVE_HEIGHT, fps)

// With audio the picture goes to a scratch file first and is copied into the
// finished one alongside the sound — see `mux`, which does not re-encode it.
const wantAudio = wantBuzz || audioMode === 'source'
// The extension is kept, because ffmpeg picks the container from it and
// `out.mov.tmp` names no format it knows.
const scratch = (suffix: string): string => {
  const dot = output.lastIndexOf('.')
  return dot === -1
    ? `${output}.${suffix}`
    : `${output.slice(0, dot)}.${suffix}${output.slice(dot)}`
}
const videoPath = wantAudio ? scratch('videoonly') : output
const sink = ffmpegEncode(videoPath, ACTIVE_WIDTH, ACTIVE_HEIGHT, fps, codec)

const started = performance.now()
let wrote = 0
try {
  for (let i = 0; i < frames; i++) {
    const frame = await source.next()
    // A file that ends before the frame count asked for stops the render there
    // rather than padding it: the last frame repeated is a still nobody asked
    // for, and the loops would keep eating it.
    if (frame === null && input !== null) {
      frames = i
      break
    }
    if (frame !== null) {
      engine.setImagePixels(frame, ACTIVE_WIDTH, ACTIVE_HEIGHT)
    }
    // Before the step, because the step is what reads it. The window the
    // analyser hands over ends at this frame's position in the track, so the
    // bass that lands on frame N bends frame N.
    analysis?.seek(i)
    engine.step()
    await sink.write(await engine.readFrame())
    wrote++
    if (!quiet && i % 30 === 0) {
      const done = ((i + 1) / frames) * 100
      const rate = (i + 1) / ((performance.now() - started) / 1000)
      await Deno.stdout.write(
        new TextEncoder().encode(
          `\r  ${done.toFixed(0)}%  frame ${i + 1}/${frames}  ${rate.toFixed(1)} fps  `,
        ),
      )
    }
  }
} finally {
  // **Order matters and the encoder goes last.** Closing the source first is
  // what stops a decoder we cut short from writing into a pipe nobody is
  // reading; the sink's close is what flushes the file. Errors from either are
  // caught below rather than allowed to escape as a stack trace — everything
  // that goes wrong here is ffmpeg's to explain, and its own words are the
  // diagnosis.
  try {
    await source.close()
  } catch (e) {
    fail(e)
  }
  try {
    await sink.close()
  } catch (e) {
    fail(e)
  }
  // **Drain the buzz before tearing anything down.** The tap arrives from a
  // `mapAsync` a frame or two behind the submit that copied it, and
  // `BuzzRead.destroy` drops whatever is still in flight — so destroying the
  // engine here would silently shorten the track by the last few frames.
  if (wantBuzz) {
    for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0))
  }
  // The device is let go of, never destroyed — adr/0004. There is no tab here
  // to take a rendering step from, but the rule is the engine's rather than the
  // browser's and a renderer is not the place to make an exception to it.
  engine.destroy({ keepDevice: true })
}

const buzzPath = `${output}.buzz.f32`
try {
  if (wantAudio) {
    let havebuzz = false
    if (wantBuzz && buzzChunks.length > 0) {
      // **A tap per rendered frame, or the sound and the picture disagree.**
      // `BuzzRead` skips a frame when every staging buffer is still in flight,
      // which is right in a live session (the audio ring glides over a gap) and
      // wrong in a file, where a dropped frame shortens the track and slides
      // everything after it earlier. Worth saying rather than quietly writing a
      // track that drifts.
      if (buzzTaps !== wrote) {
        console.warn(
          `\n  note: ${wrote} frames rendered but ${buzzTaps} buzz taps arrived; the sound is ${(((wrote - buzzTaps) / wrote) * 100).toFixed(1)}% short and will drift against the picture`,
        )
      }
      const total = buzzChunks.reduce((n, c) => n + c.length, 0)
      const all = new Float32Array(total)
      let at = 0
      for (const c of buzzChunks) {
        all.set(c, at)
        at += c.length
      }
      await Deno.writeFile(buzzPath, new Uint8Array(all.buffer))
      havebuzz = true
    }
    await mux(
      videoPath,
      output,
      havebuzz ? buzzPath : null,
      (audioMode === 'auto' || audioMode === 'source') && track !== null
        ? input
        : null,
      BUZZ_RATE,
    )
  }
} catch (e) {
  fail(e)
} finally {
  if (wantAudio) {
    await Deno.remove(videoPath).catch(() => {})
    await Deno.remove(buzzPath).catch(() => {})
  }
}

const took = (performance.now() - started) / 1000
if (!quiet) {
  const sound =
    !wantAudio || (buzzChunks.length === 0 && track === null)
      ? 'silent'
      : [
          buzzChunks.length > 0 ? 'buzz' : null,
          track !== null && audioMode !== 'buzz' ? 'source' : null,
        ]
          .filter(x => x !== null)
          .join(' + ')
  console.log(
    `\r  ${wrote} frames in ${took.toFixed(1)}s (${(wrote / took).toFixed(1)} fps), ${sound} → ${output}`,
  )
}

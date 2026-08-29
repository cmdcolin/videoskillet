// Render a batch of looks headless and lay them out as a contact sheet you can
// say yes or no to, one tile at a time.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     rolls --n=16 --seed=7      random rolls, the app's own draw
//     presets                    every built-in preset
//     presets --group='Tape wear'
//     presets --only=vhs,fmFold   a named shortlist
//     candidates --spec=scripts/gpuprof/candidates.feedback.ts
//
// `--srcnoise=1` renders over TV static instead of a test chart (2 = VHS blank
// tape), which is what most of the published demos are built on.
//
// `--source=bars` swaps the detail chart back for flat colour bars.
//
// The counterpart to `scripts/contact.mjs`, which does the same job through a
// headed Firefox and the real app. This one never opens a window, so it can run
// while someone is using the machine — the trade is that it drives the graph
// rather than the app, so what it cannot show is anything the UI layer adds: a
// modulation routing, a video source, a transition.
//
// Each tile is a strip of frames rather than one still, because half of what is
// worth keeping here is motion — a roll, a boil, a loop still winding up — and
// a single frame of it looks like a mistake. The HTML plays them.

import { DEFAULT_CONTROLS } from '../../src/core/controls'
import { rngFor } from '../../src/core/rng'
import { Runner, meanAbs, panner, spread } from './render'

import type { Controls } from '../../src/core/controls'
import type { Routing } from './render'

interface Preset {
  name: string
  displayName?: string
  group: string
  blurb: string
  patch: Partial<Controls>
}
interface PresetsModule {
  PRESETS: Preset[]
  presetControls: (patch: Partial<Controls>) => Controls
  blendPresets: (
    baseline: Controls,
    weights: ReadonlyMap<string, number>,
  ) => Controls
  randomPresetMix: (
    sourceBOn: boolean,
    rand: () => number,
  ) => ReadonlyMap<string, number>
}

async function presetsModule(): Promise<PresetsModule> {
  return (await import(
    new URL('../../src/ui/presets.ts', import.meta.url).href
  )) as PresetsModule
}

function arg(name: string): string | undefined {
  return Deno.args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
}

const TW = Number(arg('tw') ?? 320)
// 4:3, the shape the app presents in — not the 754x480 sample grid.
const TH = Math.round((TW * 3) / 4)
const FRAMES = Number(arg('frames') ?? 260)
// Every fourth frame, so a 6-frame strip covers a fifth of a second of tape —
// long enough to read a roll's direction, short enough that a fast boil does
// not alias into a stutter.
const STRIP = [20, 16, 12, 8, 4, 0]
// `--video` captures the last N frames as an mp4 instead of six stills. Every
// frame read back is a 1.4 MB copy off the GPU, so this is the slow path and
// the reason it is opt-in.
const VIDEO = Deno.args.includes('--video')
const VIDEO_FRAMES = Number(arg('vframes') ?? 150)

interface Item {
  name: string
  blurb: string
  controls: Controls
  mod?: readonly Routing[]
}

// Raw RGB out to a JPEG. ffmpeg rather than a hand-rolled encoder: it is
// already a dependency of the clip tooling, and the alternative is a CRC table
// to save one process per tile. JPEG rather than PNG because these go into one
// HTML page as data URIs, and a sheet of noisy CRT frames is 8x the page in
// PNG — over the 16MB an artifact may be.
async function writeJpeg(
  px: Float32Array,
  w: number,
  h: number,
  path: string,
): Promise<void> {
  const bytes = new Uint8Array(px.length)
  for (let i = 0; i < px.length; i++) bytes[i] = Math.round(px[i])
  const cmd = new Deno.Command('ffmpeg', {
    args: [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-s',
      `${w}x${h}`,
      '-i',
      'pipe:0',
      '-q:v',
      '6',
      path,
    ],
    stdin: 'piped',
    stdout: 'null',
    stderr: 'inherit',
  }).spawn()
  const w2 = cmd.stdin.getWriter()
  await w2.write(bytes)
  await w2.close()
  await cmd.status
}

// A run of frames straight into an mp4. Six stills cannot show a look that is
// mostly motion, and a strip long enough to read as motion is bigger as JPEGs
// than the same seconds are as video.
async function writeVideo(
  shots: Float32Array[],
  w: number,
  h: number,
  path: string,
): Promise<void> {
  const cmd = new Deno.Command('ffmpeg', {
    args: [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-s',
      `${w}x${h}`,
      '-r',
      '30',
      '-i',
      'pipe:0',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '30',
      // yuv420p and an even frame size, or the file plays in ffmpeg and
      // nowhere else.
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      path,
    ],
    stdin: 'piped',
    stdout: 'null',
    stderr: 'inherit',
  }).spawn()
  const writer = cmd.stdin.getWriter()
  const bytes = new Uint8Array(w * h * 3)
  for (const s of shots) {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(s[i])
    await writer.write(bytes)
  }
  await writer.close()
  await cmd.status
}

async function main(): Promise<void> {
  const mode = Deno.args.find(a => !a.startsWith('--')) ?? 'rolls'
  const outDir = arg('out') ?? 'docs/sheet'
  const { PRESETS, presetControls, blendPresets, randomPresetMix } =
    await presetsModule()
  await Deno.mkdir(outDir, { recursive: true })

  const items: Item[] = []
  if (mode === 'candidates') {
    const spec = arg('spec')
    if (spec === undefined) throw new Error('candidates needs --spec=<file.ts>')
    const mod = (await import(new URL(spec, `file://${Deno.cwd()}/`).href)) as {
      candidates: { name: string; blurb: string; patch: Partial<Controls> }[]
    }
    for (const c of mod.candidates) {
      items.push({
        name: c.name,
        blurb: c.blurb,
        controls: presetControls(c.patch),
      })
    }
  } else if (mode === 'presets') {
    const group = arg('group')
    const only = arg('only')?.split(',')
    for (const p of PRESETS) {
      if (p.name === 'clean') continue
      if (group !== undefined && p.group !== group) continue
      if (only !== undefined && !only.includes(p.name)) continue
      items.push({
        name: p.displayName ?? p.name,
        blurb: `${p.group} — ${p.blurb}`,
        controls: presetControls(p.patch),
      })
    }
  } else {
    const n = Number(arg('n') ?? 16)
    const rand = rngFor(Number(arg('seed') ?? 1))
    for (let i = 0; i < n; i++) {
      const weights = randomPresetMix(true, rand)
      items.push({
        name: `roll ${i + 1}`,
        blurb: [...weights].map(([k, w]) => `${k} ${w.toFixed(2)}`).join(' + '),
        controls: blendPresets({ ...DEFAULT_CONTROLS }, weights),
      })
    }
  }

  const runner = await Runner.create(
    arg('source') === 'bars' ? 'bars' : 'detail',
  )
  // A loop eating a frozen frame converges and stops, so every feedback look
  // would render as the source slightly soft. Panning the picture is the
  // cheapest honest stand-in for live video.
  // `--srcnoise=1` is TV static, `2` is VHS blank tape — the generated sources
  // most of the published demos are built on. Panning a generated source does
  // nothing (it is made on the GPU, not uploaded), so motion comes off the
  // generator itself and `--still` is implied.
  runner.srcNoise = Number(arg('srcnoise') ?? 0)
  runner.srcNoiseB = Number(arg('srcnoiseb') ?? 0)
  const move =
    arg('still') === undefined && runner.srcNoise === 0
      ? panner(runner.srcA)
      : undefined
  const ref = await runner.run(
    { ...DEFAULT_CONTROLS },
    FRAMES,
    { tail: [0], w: TW, h: TH },
    move,
  )
  const manifest: Record<string, unknown>[] = []
  for (const [i, it] of items.entries()) {
    const tail = VIDEO
      ? Array.from({ length: VIDEO_FRAMES }, (_, k) => VIDEO_FRAMES - 1 - k)
      : STRIP
    const { shots } = await runner.run(
      it.controls,
      FRAMES,
      { tail, w: TW, h: TH },
      move,
      it.mod,
    )
    const slug = `${String(i).padStart(3, '0')}-${it.name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`
    const files: string[] = []
    if (VIDEO) {
      const file = `${slug}.mp4`
      await writeVideo(shots, TW, TH, `${outDir}/${file}`)
      files.push(file)
    } else {
      for (const [k, s] of shots.entries()) {
        const file = `${slug}-${k}.jpg`
        await writeJpeg(s, TW, TH, `${outDir}/${file}`)
        files.push(file)
      }
    }
    const { mean, sd } = spread(shots.at(-1)!)
    // Motion across the whole strip rather than between the last two frames: a
    // look that pulses on a slow cycle sits still between adjacent frames and
    // is not still at all.
    const motion =
      shots.slice(1).reduce((s, f, k) => s + meanAbs(f, shots[k]), 0) /
      (shots.length - 1)
    manifest.push({
      name: it.name,
      blurb: it.blurb,
      files,
      dep: Number(meanAbs(shots.at(-1)!, ref.shots[0]).toFixed(2)),
      motion: Number(motion.toFixed(2)),
      mean: Number(mean.toFixed(1)),
      sd: Number(sd.toFixed(1)),
    })
    console.log(
      `${(i + 1).toString().padStart(3)}/${items.length} ${it.name.padEnd(22)} dep ${manifest.at(-1)!.dep} motion ${manifest.at(-1)!.motion} mean ${manifest.at(-1)!.mean} sd ${manifest.at(-1)!.sd}`,
    )
  }
  await Deno.writeTextFile(
    `${outDir}/manifest.json`,
    JSON.stringify(
      { mode, tw: TW, th: TH, video: VIDEO, items: manifest },
      null,
      2,
    ),
  )
  console.log(`\n${items.length} tiles → ${outDir}/manifest.json`)
}

await main()

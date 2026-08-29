// Render a batch of looks headless and lay them out as a contact sheet you can
// say yes or no to, one tile at a time.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     rolls --n=16 --seed=7      random rolls, the app's own draw
//     presets                    every built-in preset
//     presets --group='Tape wear'
//     presets --only=vhs,fmFold   a named shortlist
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
import { Runner, meanAbs, spread } from './render'

import type { Controls } from '../../src/core/controls'

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

interface Item {
  name: string
  blurb: string
  controls: Controls
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

async function main(): Promise<void> {
  const mode = Deno.args.find(a => !a.startsWith('--')) ?? 'rolls'
  const outDir = arg('out') ?? 'docs/sheet'
  const { PRESETS, presetControls, blendPresets, randomPresetMix } =
    await presetsModule()
  await Deno.mkdir(outDir, { recursive: true })

  const items: Item[] = []
  if (mode === 'presets') {
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
  const ref = await runner.run({ ...DEFAULT_CONTROLS }, FRAMES, {
    tail: [0],
    w: TW,
    h: TH,
  })
  const manifest: Record<string, unknown>[] = []
  for (const [i, it] of items.entries()) {
    const { shots } = await runner.run(it.controls, FRAMES, {
      tail: STRIP,
      w: TW,
      h: TH,
    })
    const slug = `${String(i).padStart(3, '0')}-${it.name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}`
    const files: string[] = []
    for (const [k, s] of shots.entries()) {
      const file = `${slug}-${k}.jpg`
      await writeJpeg(s, TW, TH, `${outDir}/${file}`)
      files.push(file)
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
    JSON.stringify({ mode, tw: TW, th: TH, items: manifest }, null, 2),
  )
  console.log(`\n${items.length} tiles → ${outDir}/manifest.json`)
}

await main()

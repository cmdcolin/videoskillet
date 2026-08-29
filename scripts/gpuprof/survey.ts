// Does a knob do anything, and does a preset go anywhere? Both questions
// answered headless, off the same graph `gpuprof` times — so the answer costs
// minutes instead of a Firefox that takes the screen for an hour.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/survey.ts \
//     sliders [--base=vhs] [--source=detail] [--only=a,b] [--frames=N]
//     presets [--source=detail]
//
// Two modes:
//
//   sliders  every control, both ends and a midpoint
//            (--base= starts from a preset that opens the path; --source=detail
//            swaps flat bars for fine structure)
//   presets  every preset, against clean
//
// Four numbers per arm, on a 64x48 downscale of the tube face:
//
//   dep     mean channel departure from the reference arm, 0-255. How much of
//           the picture moved. Zero means the knob changed nothing.
//   p99     the departure of the worst 1% of the frame. An edge fault lives on
//           a few hundred pixels; `dep` alone calls that nothing. High p99 with
//           low dep is a detail, not a look.
//   motion  mean channel difference between the last two frames. What the look
//           does over time — a roll, a boil, a loop still developing. A patch
//           can be worth having at dep 3 if motion is 20.
//   mean/sd luma level and spread, for the arms that "departed" by collapsing
//           to black or walling out to white.
//
// A dead knob usually means a dependency rather than a dead pass: `fmStreakUs`
// cannot smear a fold that `fmOverdev` is not making, and nothing in the camera
// loop does anything until `fbGain` is up. Read a zero row as "does nothing
// from this base", and re-run with `--base=` a preset that opens the path
// before concluding anything about the control itself.

import { Runner, meanAbs, p99Abs, spread } from './render'

import type { ControlKey, Controls } from '../../src/core/controls'

interface Slider {
  key: ControlKey
  label: string
  min: number
  max: number
  fine?: boolean
}
interface Preset {
  name: string
  group: string
  patch: Partial<Controls>
}
interface UiModules {
  ALL_SLIDERS: Slider[]
  PRESETS: Preset[]
  presetControls: (patch: Partial<Controls>) => Controls
}

// Loaded by URL for the same reason `main.ts` does it: the UI layer's type
// graph reaches React and Web MIDI, which `deno check` would then follow.
async function ui(): Promise<UiModules> {
  const controls = (await import(
    new URL('../../src/ui/controls.ts', import.meta.url).href
  )) as { ALL_SLIDERS: Slider[] }
  const presets = (await import(
    new URL('../../src/ui/presets.ts', import.meta.url).href
  )) as Pick<UiModules, 'PRESETS' | 'presetControls'>
  return { ...controls, ...presets }
}

function arg(name: string): string | undefined {
  return Deno.args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
}

const CAP = { tail: [0, 1], w: 64, h: 48 }
const FRAMES = Number(arg('frames') ?? 150)

interface Row {
  name: string
  extra: string
  dep: number
  p99: number
  motion: number
  mean: number
  sd: number
}

const fmt = (rows: Row[], head: string): void => {
  console.log(
    'name'.padEnd(24) +
      head.padEnd(12) +
      'dep'.padStart(8) +
      'p99'.padStart(8) +
      'motion'.padStart(9) +
      'mean'.padStart(8) +
      'sd'.padStart(7),
  )
  for (const r of rows)
    console.log(
      r.name.padEnd(24) +
        r.extra.padEnd(12) +
        r.dep.toFixed(2).padStart(8) +
        r.p99.toFixed(1).padStart(8) +
        r.motion.toFixed(2).padStart(9) +
        r.mean.toFixed(1).padStart(8) +
        r.sd.toFixed(1).padStart(7),
    )
}

async function main(): Promise<void> {
  const mode = Deno.args.find(a => !a.startsWith('--')) ?? 'sliders'
  const { ALL_SLIDERS, PRESETS, presetControls } = await ui()
  const runner = await Runner.create(
    arg('source') === 'detail' ? 'detail' : 'bars',
  )

  const baseName = arg('base')
  const found = PRESETS.find(p => p.name === baseName)
  if (baseName !== undefined && found === undefined)
    throw new Error(`no preset ${baseName}`)
  const base = presetControls(found?.patch ?? {})
  const ref = await runner.run(base, FRAMES, CAP)
  const refSpread = spread(ref.shots[0])
  console.log(
    `# ${mode}, ${FRAMES} frames, source ${arg('source') ?? 'bars'}, base ${baseName ?? 'stock'} (motion ${meanAbs(ref.shots[0], ref.shots[1]).toFixed(2)}, mean ${refSpread.mean.toFixed(1)}, sd ${refSpread.sd.toFixed(1)})`,
  )

  const rows: Row[] = []
  const row = (name: string, extra: string, shots: Float32Array[]): Row => {
    const { mean, sd } = spread(shots[0])
    return {
      name,
      extra,
      dep: meanAbs(shots[0], ref.shots[0]),
      p99: p99Abs(shots[0], ref.shots[0]),
      motion: meanAbs(shots[0], shots[1]),
      mean,
      sd,
    }
  }

  if (mode === 'presets') {
    for (const p of PRESETS) {
      if (p.name === 'clean') continue
      const { shots } = await runner.run(presetControls(p.patch), FRAMES, CAP)
      rows.push(row(p.name, p.group.slice(0, 11), shots))
      console.error(`  ${rows.length}/${PRESETS.length} ${p.name}`)
    }
  } else {
    const only = arg('only')?.split(',')
    for (const s of ALL_SLIDERS) {
      if (only !== undefined && !only.includes(s.key)) continue
      const at = base[s.key]
      // Three probes, and the honest ones: both ends of the range, plus the
      // midpoint of whichever half is longer — a knob whose effect is a step
      // near one end is missed by an evenly spaced sweep of any length.
      const mid = at - s.min > s.max - at ? (s.min + at) / 2 : (at + s.max) / 2
      let best: Row | undefined
      for (const v of [s.min, s.max, mid]) {
        if (v === at) continue
        const { shots } = await runner.run({ ...base, [s.key]: v }, FRAMES, CAP)
        const r = row(
          `${s.key}${s.fine === true ? ' *' : ''}`,
          `@${Number(v.toPrecision(3))}`,
          shots,
        )
        if (best === undefined || r.dep + r.p99 > best.dep + best.p99) best = r
      }
      if (best !== undefined) rows.push(best)
    }
  }

  rows.sort((a, b) => a.dep + a.motion - (b.dep + b.motion))
  fmt(rows, mode === 'presets' ? 'group' : 'worst at')
  if (mode !== 'presets')
    console.log('\n* = already flagged `fine: true` in the control table')
}

await main()

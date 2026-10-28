// Renders a fixed set of looks on the app's own engine and compares each final
// frame with a reference image in `scripts/render/golden/`. Run it through
// `pnpm render:golden`, which builds the bundle and pins Deno to Mesa's
// software Vulkan driver, so a laptop and CI render on the same rasteriser.
//
//   pnpm render:golden            compare, and exit 1 on a mismatch
//   pnpm render:golden --update   rewrite the references
//
// A reference is the frame box-filtered down to 125x80, which averages out
// float noise between driver versions and keeps each file to 30 KB. A failure
// writes `<case>.actual.ppm` and `<case>.diff.ppm` beside the reference.

import './runtime.ts'
import type { Controls } from '../../src/core/controls.ts'

const {
  ACTIVE_HEIGHT,
  ACTIVE_WIDTH,
  DEFAULT_CONTROLS,
  Engine,
  PRESET_BY_NAME,
  presetControls,
  smpteBarsPixels,
} = await import('./build/engine.js')

interface Case {
  name: string
  preset?: string
  set?: Partial<Controls>
  noise?: number
  caption?: string
}

const CASES: Case[] = [
  { name: 'stock' },
  { name: 'vhs', preset: 'vhs' },
  { name: 'wornTape', preset: 'wornTape' },
  { name: 'mistunedRf', preset: 'mistunedRf' },
  { name: 'verticalHoldGone', preset: 'verticalHoldGone' },
  { name: 'bentScan', preset: 'bentScan' },
  { name: 'misconverged', preset: 'misconverged' },
  { name: 'falseColour', preset: 'falseColour' },
  { name: 'scrambledChannel', preset: 'scrambledChannel' },
  { name: 'chromaRails', preset: 'chromaRails' },
  { name: 'mixerLoop', preset: 'mixerLoop' },
  { name: 'tvStatic', noise: 1 },
  {
    name: 'overmodulatedChyron',
    preset: 'overmodulatedChyron',
    caption: 'HELLO WORLD',
  },
  { name: 'bentFontRom', preset: 'bentFontRom', caption: 'HELLO WORLD' },
]

const FRAMES = 30
const SEED = 1
const SCALE = 6
const W = Math.floor(ACTIVE_WIDTH / SCALE)
const H = Math.floor(ACTIVE_HEIGHT / SCALE)
// A pixel counts as changed past this many levels on any channel, and a case
// fails when more than `MAX_CHANGED` of its pixels change or the mean moves by
// more than `MAX_MEAN`.
const PIXEL_LEVELS = 16
const MAX_CHANGED = 0.005
const MAX_MEAN = 0.4

const here = new URL('.', import.meta.url)
const goldenDir = new URL('golden/', here)
const update = Deno.args.includes('--update')
const only = Deno.args.find(a => a.startsWith('--only='))?.slice(7)

const shrink = (rgba: Uint8Array): Uint8Array => {
  const out = new Uint8Array(W * H * 3)
  const area = SCALE * SCALE
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let dy = 0; dy < SCALE; dy++) {
          const row = (y * SCALE + dy) * ACTIVE_WIDTH
          for (let dx = 0; dx < SCALE; dx++) {
            sum += rgba[(row + x * SCALE + dx) * 4 + c]
          }
        }
        out[(y * W + x) * 3 + c] = Math.round(sum / area)
      }
    }
  }
  return out
}

const ppm = (rgb: Uint8Array): Uint8Array => {
  const head = new TextEncoder().encode(`P6\n${W} ${H}\n255\n`)
  const file = new Uint8Array(head.length + rgb.length)
  file.set(head)
  file.set(rgb, head.length)
  return file
}

const readPpm = async (url: URL): Promise<Uint8Array | null> => {
  let file: Uint8Array
  try {
    file = await Deno.readFile(url)
  } catch {
    return null
  }
  const head = `P6\n${W} ${H}\n255\n`
  if (new TextDecoder().decode(file.subarray(0, head.length)) !== head) {
    throw new Error(`${url.pathname} is not a ${W}x${H} P6 image`)
  }
  return file.subarray(head.length)
}

const compare = (a: Uint8Array, b: Uint8Array) => {
  const diff = new Uint8Array(a.length)
  let total = 0
  let changed = 0
  for (let p = 0; p < a.length; p += 3) {
    let worst = 0
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[p + c] - b[p + c])
      total += d
      worst = Math.max(worst, d)
    }
    if (worst > PIXEL_LEVELS) {
      changed++
      diff[p] = 255
    } else {
      diff[p + 1] = worst * 8
    }
  }
  return {
    mean: total / a.length,
    changed: changed / (W * H),
    diff,
  }
}

const canvas = new OffscreenCanvas(ACTIVE_WIDTH, ACTIVE_HEIGHT)
const engine = await Engine.create(canvas as never)
engine.pauseLoop()
const bars = new Uint8Array(smpteBarsPixels().buffer.slice(0))

const render = async (c: Case): Promise<Uint8Array> => {
  if (c.preset !== undefined && !PRESET_BY_NAME.has(c.preset)) {
    throw new Error(`no preset named ${c.preset}`)
  }
  const base =
    c.preset === undefined
      ? { ...DEFAULT_CONTROLS }
      : presetControls(PRESET_BY_NAME.get(c.preset)!.patch)
  engine.setImagePixels(bars, ACTIVE_WIDTH, ACTIVE_HEIGHT)
  engine.setNoiseSource(c.noise ?? 0)
  engine.setCaption(c.caption ?? '')
  engine.startTake({ fps: 60, seed: SEED })
  engine.applyControls({ ...base, ...c.set })
  for (let i = 0; i < FRAMES; i++) engine.step()
  return await engine.readFrame()
}

const cases = CASES.filter(c => only === undefined || c.name === only)
if (cases.length === 0) {
  console.error(`no case named ${only}`)
  Deno.exit(2)
}

if (update) await Deno.mkdir(goldenDir, { recursive: true })
const failures: string[] = []
let first: Uint8Array | null = null
for (const c of cases) {
  const frame = await render(c)
  first ??= frame
  const small = shrink(frame)
  const file = new URL(`${c.name}.ppm`, goldenDir)
  if (update) {
    await Deno.writeFile(file, ppm(small))
    console.log(`wrote ${c.name}`)
    continue
  }
  const want = await readPpm(file)
  if (want === null) {
    failures.push(`${c.name}: no reference (run with --update)`)
    continue
  }
  const r = compare(small, want)
  const ok = r.changed <= MAX_CHANGED && r.mean <= MAX_MEAN
  const line = `${c.name}: mean ${r.mean.toFixed(2)}, changed ${(r.changed * 100).toFixed(2)}%`
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`)
  if (!ok) {
    failures.push(line)
    await Deno.writeFile(new URL(`${c.name}.actual.ppm`, goldenDir), ppm(small))
    await Deno.writeFile(new URL(`${c.name}.diff.ppm`, goldenDir), ppm(r.diff))
  }
}

const again = await render(cases[0])
if (first !== null && !again.every((v, i) => v === first![i])) {
  failures.push(
    `${cases[0].name}: a second take differs from the first, so startTake no longer resets everything`,
  )
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failed:\n  ${failures.join('\n  ')}`)
  if (!update)
    console.error('actual and diff images are in scripts/render/golden/')
  Deno.exit(1)
}
Deno.exit(0)

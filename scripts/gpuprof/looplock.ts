// Why does a feedback look land where it lands? Two failures answer to two
// different numbers, and a contact sheet shows neither.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/looplock.ts \
//     [--only=a,b] [--group='Feedback loops'] [--frames=240] [--nomod]
//     [--source=bars|detail] [--set=cfbMix=0.9]
//
// A loop that reads as tame and a loop that reads as chaos are usually the same
// loop: the mixer loop crossfades the whole waveform, sync tip included, so
// past a certain mix the separator stops finding a line start and everything
// the loop was building is thrown across a torn raster. `lock` and `age` are
// that; `loop` is the other question — how much of what is on the glass the
// loop is responsible for, as opposed to the chroma gain and the phosphor the
// same patch also set.
//
//   loop   mean departure (0-255) from the same patch with both loop mixes at
//          zero. The loop's own contribution, isolated from the rest of the
//          patch. Under ~8 the loop is decoration on a look that would survive
//          without it.
//   grow   departure between an early frame and the last one. A loop still
//          finding structure four seconds in scores high; one that reached its
//          fixed point in half a second scores near its own motion.
//   motion adjacent-frame difference, as survey.ts reports it.
//   lock   percent of lines the sync separator found an edge on, straight off
//          the separator's own per-line verdict. 100 is a raster with a line
//          start on every line; below ~95 the picture is tearing.
//   age    lines since the separator last saw an edge, at the foot of the
//          frame. Caps at 5000. Nonzero at all means the flywheel finished the
//          frame free-running, and the walk it does then is what turns a loop
//          into noise.
//   hjit   sd of the per-line horizontal offsets the deflection actually used,
//          in samples. Line-to-line tearing, whether or not lock survived.
//   vroll  |vertical phase error|, in lines. Past a couple the frame is rolling.

import { LINES } from '../../src/core/signal/constants'
import { Runner, drivable, meanAbs, panner, spread, undrivable } from './render'

import type { ControlKey, Controls } from '../../src/core/controls'
import type { LooseRouting } from './render'

const V_PHASE = LINES
const LOCK_AGE = LINES + 7
const TIMING_LEN = LINES * 2 + 10

interface Preset {
  name: string
  displayName?: string
  group: string
  patch: Partial<Controls>
  mod?: readonly LooseRouting[]
}
interface PresetsModule {
  PRESETS: Preset[]
  presetControls: (patch: Partial<Controls>) => Controls
}

function arg(name: string): string | undefined {
  return Deno.args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
}

const FRAMES = Number(arg('frames') ?? 240)
const NOMOD = Deno.args.includes('--nomod')
const GROUP = arg('group') ?? 'Feedback loops'
const W = 64
const H = 48
// The last frame, four back for motion, and 200 back for growth — far enough
// in that a loop winding up from black has finished winding up.
const TAIL = [0, 4, 200]

interface Row {
  name: string
  loop: number
  grow: number
  motion: number
  lock: number
  age: number
  hjit: number
  vroll: number
  mean: number
  sd: number
}

// The graph's timing buffer, frame by frame. Copied to a mapped buffer per
// probe rather than accumulated on the GPU: this harness reads a handful of
// frames per arm and the copy is 4 KB.
class Lock {
  readonly locks: number[] = []
  readonly ages: number[] = []
  readonly hjits: number[] = []
  readonly vrolls: number[] = []

  private constructor(
    private readonly timingRead: GPUBuffer,
    private readonly measureRead: GPUBuffer,
  ) {}

  static create(device: GPUDevice): Lock {
    const map = (size: number) =>
      device.createBuffer({
        size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })
    return new Lock(map(TIMING_LEN * 4), map(LINES * 16))
  }

  reset(): void {
    this.locks.length = 0
    this.ages.length = 0
    this.hjits.length = 0
    this.vrolls.length = 0
  }

  async sample(device: GPUDevice, g: Probed): Promise<void> {
    const enc = device.createCommandEncoder()
    enc.copyBufferToBuffer(g.timingBuf, 0, this.timingRead, 0, TIMING_LEN * 4)
    enc.copyBufferToBuffer(g.syncMeasureBuf, 0, this.measureRead, 0, LINES * 16)
    device.queue.submit([enc.finish()])
    await this.timingRead.mapAsync(GPUMapMode.READ)
    const t = new Float32Array(this.timingRead.getMappedRange().slice(0))
    this.timingRead.unmap()
    await this.measureRead.mapAsync(GPUMapMode.READ)
    const m = new Float32Array(this.measureRead.getMappedRange().slice(0))
    this.measureRead.unmap()
    let found = 0
    for (let row = 0; row < LINES; row++) {
      if (m[row * 4] > -999) found++
    }
    this.locks.push((100 * found) / LINES)
    this.hjits.push(spread(t.subarray(0, LINES)).sd)
    this.vrolls.push(Math.abs(t[V_PHASE]))
    this.ages.push(t[LOCK_AGE])
  }
}

interface Probed {
  timingBuf: GPUBuffer
  syncMeasureBuf: GPUBuffer
}

const avg = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length

async function main(): Promise<void> {
  const presets = (await import(
    new URL('../../src/ui/presets.ts', import.meta.url).href
  )) as PresetsModule
  const only = arg('only')?.split(',')
  const items = presets.PRESETS.filter(
    p =>
      (only === undefined ? p.group === GROUP : only.includes(p.name)) &&
      p.group !== undefined,
  )
  const extra = arg('set')
  const runner = await Runner.create(
    arg('source') === 'detail' ? 'detail' : 'bars',
  )
  const lock = Lock.create(runner.device)
  const animate = panner(runner.srcA)
  const rows: Row[] = []
  for (const [i, p] of items.entries()) {
    console.log(`  ${i + 1}/${items.length} ${p.name}`)
    const c = presets.presetControls(p.patch)
    if (extra !== undefined) {
      for (const kv of extra.split(',')) {
        const [k, v] = kv.split('=')
        c[k as ControlKey] = Number(v)
      }
    }
    const mod = NOMOD ? undefined : drivable(p.name, p.mod)
    const cap = { tail: TAIL, w: W, h: H }
    lock.reset()
    const probe = async (f: number, g: Probed) => {
      if (f > FRAMES - 40 && f % 8 === 0) {
        await lock.sample(runner.device, g)
      }
    }
    const on = await runner.run(c, FRAMES, cap, animate, mod, probe)
    // The same patch with both loops unpatched. Everything else the preset
    // sets is still there, so what the difference isolates is the loop.
    const off = await runner.run(
      { ...c, fbMix: 0, cfbMix: 0 },
      FRAMES,
      cap,
      animate,
      mod,
    )
    const s = spread(on.shots[0])
    rows.push({
      name: p.name,
      loop: meanAbs(on.shots[0], off.shots[0]),
      grow: meanAbs(on.shots[0], on.shots[2]),
      motion: meanAbs(on.shots[0], on.shots[1]),
      lock: avg(lock.locks),
      age: avg(lock.ages),
      hjit: avg(lock.hjits),
      vroll: avg(lock.vrolls),
      mean: s.mean,
      sd: s.sd,
    })
  }
  const n = (x: number, w: number, d = 2) => x.toFixed(d).padStart(w)
  console.log(
    `\n# ${items.length} looks, ${FRAMES} frames, panned source${NOMOD ? ', no routings' : ''}`,
  )
  console.log(
    'name                    loop    grow  motion    lock     age    hjit   vroll    mean      sd',
  )
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(22)}${n(r.loop, 6)}${n(r.grow, 8)}${n(r.motion, 8)}${n(r.lock, 8, 1)}${n(r.age, 8, 1)}${n(r.hjit, 8)}${n(r.vroll, 8)}${n(r.mean, 8, 1)}${n(r.sd, 8, 1)}`,
    )
  }
  if (undrivable.length > 0) {
    console.log(`\ndropped routings on: ${undrivable.join(', ')}`)
  }
}

await main()

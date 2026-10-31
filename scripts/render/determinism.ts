// Renders presets in two or more concurrent processes and requires the same
// frames from each. Run it through `pnpm render:determinism`, which builds the bundle and
// pins Deno to lavapipe the way `pnpm render:golden` does.
//
//   pnpm render:determinism                   stock and the loop presets
//   pnpm render:determinism --all             stock and every preset
//   pnpm render:determinism --runs=3          three runs (default 2)
//   pnpm render:determinism --only=railSlam   named cases, comma-separated
//   pnpm render:determinism --frames=5,30     hash these frames
//
// lavapipe hands a dispatch's workgroups to a pool of `LP_NUM_THREADS`
// threads. A pass whose lanes read memory that lanes in another workgroup
// write in the same dispatch therefore depends on which workgroup ran first,
// and that order changes with the size of the pool. Each run gets a different
// pool size where there are cores enough to give one. With the store_prev race
// of 9fa43843 put back, railSlam differed between 16 and 8 threads on every
// attempt, and between two takes at 16 threads on about one in three. A
// race-free pass is bit-identical at every pool size, so this check needs no
// reference images.
//
// The golden check renders each case once and compares it with a reference
// within a tolerance, so it cannot tell a race from a change in the picture.

import { openStage, PRESET_BY_NAME } from './take.ts'

import type { Case } from './take.ts'

const flag = (name: string) =>
  Deno.args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)

const MARK = 'HASH'
const runs = Number(flag('runs') ?? 2)
const at = (flag('frames') ?? '10,20,30').split(',').map(Number)
const only = flag('only')?.split(',')

// The presets that switch on a loop: the camera feedback, the mixer loop or
// the frame-store strobe. Their passes hold a picture from one frame to the
// next, and stock does not run them.
const LOOP_KEYS = ['fbMix', 'cfbMix', 'strobeHz'] as const
const runsALoop = (p: {
  patch: Partial<Record<(typeof LOOP_KEYS)[number], number>>
  mod?: readonly { target: string }[]
}) =>
  LOOP_KEYS.some(
    k => (p.patch[k] ?? 0) > 0 || (p.mod ?? []).some(m => m.target === k),
  )

const picked = (name: string, byDefault: boolean) =>
  only === undefined
    ? byDefault || Deno.args.includes('--all')
    : only.includes(name)

const cases: Case[] = [
  ...(picked('stock', true) ? [{ name: 'stock' }] : []),
  ...[...PRESET_BY_NAME.values()]
    .filter(p => picked(p.name, runsALoop(p)))
    .map(p => ({ name: p.name, preset: p.name, motion: true })),
]

const sha = async (frame: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', frame)), b =>
    b.toString(16).padStart(2, '0'),
  ).join('')

// One run: render each case and print its frame hashes on a marked line.
async function hashRun() {
  const shoot = await openStage()
  for (const c of cases) {
    const hashes = await Promise.all((await shoot(c, at)).map(sha))
    console.log(`${MARK} ${c.name} ${hashes.join(' ')}`)
  }
}

// The pool for run `r`: every core for the first, then a share of them.
const poolFor = (r: number) =>
  Math.max(1, Math.ceil(navigator.hardwareConcurrency / (r + 1)))

async function* lines(stream: ReadableStream<Uint8Array<ArrayBuffer>>) {
  let rest = ''
  for await (const chunk of stream.pipeThrough(new TextDecoderStream())) {
    const parts = (rest + chunk).split('\n')
    rest = parts.pop() ?? ''
    yield* parts
  }
  if (rest !== '') yield rest
}

async function compareRuns() {
  const started = performance.now()
  const seen = new Map<string, string[][]>()
  const failures: string[] = []

  const judge = (name: string, takes: string[][]) => {
    const split = at.filter((_, i) => new Set(takes.map(t => t[i])).size > 1)
    if (split.length === 0) {
      console.log(`ok   ${name}`)
    } else {
      const line = `${name}: runs differ at frame ${split.join(', ')}`
      console.log(`FAIL ${line}`)
      takes.forEach((t, r) => {
        const hashes = t.map(h => h.slice(0, 12)).join(' ')
        console.log(`       ${poolFor(r)} threads: ${hashes}`)
      })
      failures.push(line)
    }
  }

  const run = async (r: number) => {
    const child = new Deno.Command(Deno.execPath(), {
      args: [
        'run',
        '-A',
        '--config',
        new URL('../gpuprof/deno.json', import.meta.url).pathname,
        new URL(import.meta.url).pathname,
        '--hash-run',
        ...Deno.args,
      ],
      env: { LP_NUM_THREADS: String(poolFor(r)) },
      stdout: 'piped',
    }).spawn()
    for await (const line of lines(child.stdout)) {
      const [mark, name, ...hashes] = line.split(' ')
      if (mark === MARK && hashes.length === at.length) {
        const takes = seen.get(name) ?? Array.from({ length: runs }, () => [])
        takes[r] = hashes
        seen.set(name, takes)
        if (takes.every(t => t.length > 0)) judge(name, takes)
      } else {
        console.error(`run ${r + 1}: ${line}`)
      }
    }
    const { code } = await child.status
    if (code !== 0) failures.push(`run ${r + 1} exited with code ${code}`)
  }

  const pools = Array.from({ length: runs }, (_, r) => poolFor(r))
  if (new Set(pools).size < runs) {
    console.warn(
      `${navigator.hardwareConcurrency} cores give ${runs} runs only ${new Set(pools).size} pool sizes, so runs that share one compare takes and not pool sizes`,
    )
  }
  console.log(
    `${cases.length} cases, ${runs} runs on ${pools.join(', ')} threads, frames ${at.join(', ')}\n`,
  )
  await Promise.all(Array.from({ length: runs }, (_, r) => run(r)))
  const unjudged = cases.filter(
    c => seen.get(c.name)?.some(t => t.length === 0) ?? true,
  )
  if (unjudged.length > 0) {
    failures.push(`never compared: ${unjudged.map(c => c.name).join(', ')}`)
  }

  const seconds = ((performance.now() - started) / 1000).toFixed(0)
  console.log(`\ndone in ${seconds}s`)
  if (failures.length > 0) {
    console.error(`\n${failures.length} failed:\n  ${failures.join('\n  ')}`)
  }
  return failures.length === 0
}

if (!(Number.isInteger(runs) && runs >= 2)) {
  console.error('--runs needs a whole number of at least 2')
  Deno.exit(2)
} else if (!at.every(n => Number.isInteger(n) && n > 0)) {
  console.error('--frames needs positive whole frame numbers')
  Deno.exit(2)
} else if (cases.length === 0) {
  console.error(`no case named ${only}`)
  Deno.exit(2)
} else if (Deno.args.includes('--hash-run')) {
  await hashRun()
  Deno.exit(0)
} else {
  Deno.exit((await compareRuns()) ? 0 : 1)
}

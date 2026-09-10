// The figures on the rendering page, made by the thing the page is about.
//
//   node scripts/renderdocs.mjs [name...]
//   node scripts/renderdocs.mjs --check     which figures are missing
//
// Every image under `docs/img/render-*.webp` is one frame of an actual render,
// produced by running `scripts/render/main.ts` with the arguments printed
// beside it on the page. That is the point of generating them rather than
// grabbing them by hand: a reader can paste the command and get the picture,
// and a change that breaks the renderer breaks these before it reaches anyone.
//
// Distinct from `docshots.mjs`, which drives the app in a browser to photograph
// its UI. Nothing here opens a browser at all.
//
// Needs Deno, ffmpeg, and the engine bundle (`pnpm render:build`, which the
// `pnpm render` script runs anyway).

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const OUT = 'docs/img'

// The frame each grabs is deliberately late in its render. A feedback look has
// to build, a servo has to hunt, and the first frames of anything with a loop
// in it are the loop still filling up — so an early grab shows a look that has
// not happened yet.
const FIGURES = [
  {
    name: 'render-link',
    // The README's "Wiggity" demo, whole, exactly as it is published. It names
    // its own sources, so nothing is passed in.
    args: [
      '--look=https://videoskillet.com/app/?p=je.CoDoBwEEAbAEAKwCAfABAKCZAgXgAw2IIwSIAyFYBrAKEjwGmAEEuB4ZVADsBgr4OiSMCQDEAQDgAgAkAUQEBAAQA9wCAMXBAgCJngIAlf4DAI3tAw&mod=bendUs:lorenz:0.390279:0.27759,hvRing:sine:0.037599:0.090209&srcb=synth&src=sweep',
      '--seconds=4',
    ],
    frame: 200,
  },
  {
    name: 'render-sweep',
    // The multiburst through a tape path: the gratings above the deck's luma
    // bandwidth are erased, which is the pattern doing the job it exists for.
    // `vhs` rather than `wornTape`: the point is the bandwidth, and a worn
    // deck's noise buries the gratings it is supposed to be erasing.
    args: ['--pattern=sweep', '--preset=vhs', '--seconds=2'],
    frame: 100,
  },
  {
    name: 'render-still',
    // A photograph down a tape path. The still the app's own figures use, so
    // this is the same picture readers have already seen clean.
    args: ['public/sample.jpg', '--preset=wornTape', '--seconds=3'],
    frame: 150,
  },
]

const run = (cmd, args) =>
  execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })

const names = process.argv.slice(2).filter(a => !a.startsWith('--'))
const check = process.argv.includes('--check')
const wanted = FIGURES.filter(f => names.length === 0 || names.includes(f.name))

if (check) {
  const missing = FIGURES.filter(f => !existsSync(`${OUT}/${f.name}.webp`))
  if (missing.length > 0) {
    console.error(
      `missing: ${missing.map(m => m.name).join(', ')} — run node scripts/renderdocs.mjs`,
    )
    process.exit(1)
  }
  console.log(`${FIGURES.length} figures present`)
  process.exit(0)
}

const tmp = mkdtempSync(join(tmpdir(), 'renderdocs-'))
try {
  for (const fig of wanted) {
    const mov = join(tmp, `${fig.name}.mov`)
    process.stdout.write(`  ${fig.name} … `)
    run('deno', [
      'run',
      '-A',
      '--config',
      'scripts/gpuprof/deno.json',
      'scripts/render/main.ts',
      ...fig.args,
      mov,
      '--quiet',
    ])
    // One frame, scaled to the 4:3 the raster describes — the file carries a
    // non-square pixel aspect and a still has nowhere to put one.
    run('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      mov,
      '-vf',
      `select=eq(n\\,${fig.frame}),scale=754:565`,
      '-frames:v',
      '1',
      '-c:v',
      'libwebp',
      '-quality',
      '82',
      `${OUT}/${fig.name}.webp`,
    ])
    console.log('done')
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

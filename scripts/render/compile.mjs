// Build the offline renderer as a single executable.
//
//   node scripts/render/compile.mjs                     (via pnpm render:compile)
//   node scripts/render/compile.mjs --target=aarch64-apple-darwin
//   node scripts/render/compile.mjs --all --out=dist-bin
//
// The binary carries the renderer, the engine bundle, the app that `serve`
// hosts, and a Deno runtime. ffmpeg and ffprobe stay outside it, and a GPU
// driver Deno's WebGPU can reach is still required — see docs/CLI.md.
//
// Two builds are inputs: `pnpm render:build` for the engine bundle and
// `pnpm build` for the app under `dist/`. Only the first is run from here,
// because it is this script's own; the app build takes astro and vite and
// belongs to the release, so a missing one is reported rather than started.
//
// `deno compile` cross-compiles, so one Linux runner builds every platform. That
// is what the release workflow does with `--all`.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

export const TARGETS = [
  'x86_64-unknown-linux-gnu',
  'aarch64-unknown-linux-gnu',
  'x86_64-apple-darwin',
  'aarch64-apple-darwin',
  'x86_64-pc-windows-msvc',
]

const flag = name => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' })

// The name a target's file gets. Windows takes the `.exe` `deno compile` adds
// on its own, so the extension is left off here and the archive step below
// looks for both.
export const binaryName = target =>
  target === undefined ? 'videoskillet' : `videoskillet-${target}`

// What `serve` hosts, carried inside the executable. The instrument and its
// bundle, plus the files in `public/` that the app itself fetches — the cat,
// the test clip, the icons, the worker.
//
// The website is not in here. The landing page, the guide and the demo reel are
// 12 of dist's 15 MB and none of it is the instrument, which is what somebody
// running a local server wants; `serve` sends the root to /app/ instead. A
// `deno compile --include` of the whole directory would put a copy of the site
// in every platform's archive to answer a page nobody asked this program for.
export const ASSETS = [
  'dist/app',
  'dist/assets',
  'dist/favicon.svg',
  'dist/manifest.webmanifest',
  'dist/sw.js',
  'dist/sample.jpg',
  'dist/sample-b.jpg',
  'dist/test.mp4',
  'dist/icon-192.png',
  'dist/icon-512.png',
  'dist/icon-maskable-512.png',
  'dist/apple-touch-icon.png',
]

export function compile({ target, outDir }) {
  for (const asset of ASSETS) {
    if (!existsSync(join(ROOT, asset))) {
      throw new Error(
        `${asset} is missing — \`serve\` hosts the app out of the binary, so run \`pnpm build\` before compiling`,
      )
    }
  }
  mkdirSync(join(ROOT, outDir), { recursive: true })
  run('deno', [
    'compile',
    '-A',
    '--unstable-webgpu',
    '--config',
    'scripts/gpuprof/deno.json',
    ...ASSETS.flatMap(a => ['--include', a]),
    ...(target === undefined ? [] : ['--target', target]),
    '--output',
    join(outDir, binaryName(target)),
    'scripts/render/main.ts',
  ])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = flag('out') ?? 'bin'
  // The bundle is an input to every target, so it is built once. `--no-bundle`
  // is the release workflow, which builds it in a job of its own and hands it
  // over as an artifact — that job has node, this one need not.
  if (!process.argv.includes('--no-bundle')) {
    run('npx', ['vite', 'build', '--config', 'vite.render.config.ts'])
  }
  const targets = process.argv.includes('--all') ? TARGETS : [flag('target')]
  for (const target of targets) compile({ target, outDir })
}

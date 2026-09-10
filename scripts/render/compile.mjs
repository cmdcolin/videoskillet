// Build the offline renderer as a single executable.
//
//   node scripts/render/compile.mjs                     (via pnpm render:compile)
//   node scripts/render/compile.mjs --target=aarch64-apple-darwin
//   node scripts/render/compile.mjs --all --out=dist-bin
//
// The binary carries the renderer, the engine bundle and a Deno runtime. ffmpeg
// and ffprobe stay outside it, and a GPU driver Deno's WebGPU can reach is still
// required — see docs/RENDERING.md.
//
// `deno compile` cross-compiles, so one Linux runner builds every platform. That
// is what the release workflow does with `--all`.

import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
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

export function compile({ target, outDir }) {
  mkdirSync(join(ROOT, outDir), { recursive: true })
  run('deno', [
    'compile',
    '-A',
    '--unstable-webgpu',
    '--config',
    'scripts/gpuprof/deno.json',
    ...(target === undefined ? [] : ['--target', target]),
    '--output',
    join(outDir, binaryName(target)),
    'scripts/render/main.ts',
  ])
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = flag('out') ?? 'bin'
  // The bundle is an input to every target, so it is built once.
  run('npx', ['vite', 'build', '--config', 'vite.render.config.ts'])
  const targets = process.argv.includes('--all') ? TARGETS : [flag('target')]
  for (const target of targets) compile({ target, outDir })
}

// Builds the renderer's engine bundle and runs a Deno script against it on
// lavapipe, Mesa's software Vulkan driver. Pinning the driver is what lets a
// reference written on one machine hold on another: the same rasteriser runs
// on a laptop and on a CI runner, which has no GPU at all. Deno has to be told
// the Vulkan backend by name, since it otherwise prefers a GL adapter that
// lacks the texture view formats the engine needs.
//
//   node scripts/render/lavapipe.mjs <script.ts> [args]
//   GOLDEN_GPU=1 node scripts/render/lavapipe.mjs …    on whatever GPU Deno picks
//
// `pnpm render:golden` runs golden.ts through it and `pnpm render:determinism`
// runs determinism.ts.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'

const ICD_DIRS = ['/usr/share/vulkan/icd.d', '/etc/vulkan/icd.d']

const lavapipe = () => {
  for (const dir of ICD_DIRS.filter(d => existsSync(d))) {
    const hit = readdirSync(dir).find(f => /^lvp_icd.*\.json$/.test(f))
    if (hit !== undefined) return `${dir}/${hit}`
  }
  return null
}

const run = (cmd, args, env = process.env) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env })
  if (r.error !== undefined) throw r.error
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const env = { ...process.env, DENO_WEBGPU_BACKEND: 'vulkan' }
if (process.env.GOLDEN_GPU === undefined) {
  const icd = lavapipe()
  if (icd === null) {
    console.error(
      'no lavapipe driver found; install mesa-vulkan-drivers, or set GOLDEN_GPU=1 to use the GPU',
    )
    process.exit(2)
  }
  env.VK_ICD_FILENAMES = icd
}

run('node', [
  'node_modules/vite/bin/vite.js',
  'build',
  '--config',
  'vite.render.config.ts',
  '--logLevel',
  'warn',
])
run(
  'deno',
  [
    'run',
    '-A',
    '--config',
    'scripts/gpuprof/deno.json',
    ...process.argv.slice(2),
  ],
  env,
)

import pkg from './package.json' with { type: 'json' }
import { wgsl } from './vite-plugin-wgsl.ts'
import { ytdlp } from './vite-plugin-ytdlp.ts'

import { execSync } from 'node:child_process'

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// What the app's two vite hosts share: astro.config.mjs for the dev server and
// the build, vite.config.ts for vitest and `scripts/docgen.mjs`.
export const appPlugins = () => [wgsl(), ytdlp()]

export const appDefine = {
  __APP_VERSION__: JSON.stringify(pkg.version),
  __GIT_SHA__: JSON.stringify(gitSha()),
}

// React Compiler memoizes components and hook results itself, so the UI
// doesn't hand-maintain useMemo/useCallback around the engine handoffs.
export const reactCompiler = {
  logDiagnostics: true,
  reportDiagnostics: true,
  eslintSuppressionRules: [],
}

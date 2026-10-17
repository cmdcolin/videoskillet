import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

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

// The app's plugins and tests. Astro (astro.config.mjs) owns the dev server and
// the build; `vitest` and `scripts/docgen.mjs` read this file for the plugins.
export default defineConfig({
  // React Compiler memoizes components and hook results itself, so the UI
  // doesn't hand-maintain useMemo/useCallback around the engine handoffs.
  plugins: [
    wgsl(),
    react({
      compiler: {
        logDiagnostics: true,
        reportDiagnostics: true,
        eslintSuppressionRules: [],
      },
    }),
    ytdlp(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(gitSha()),
  },
  // **`pnpm test` must not run other checkouts' tests.** Work here happens in
  // `git worktree` copies under `.claude/worktrees/`, which are full checkouts
  // with their own `src/` — and vitest's default `include` is a glob over the
  // whole tree, so a run from the primary checkout collects every worktree's
  // suite as well as its own. Measured: 374 test files and 6746 tests against
  // this checkout's 68 and 1357.
  //
  // That is not merely slow. It means a half-finished branch someone else is
  // working on can fail *your* test run, in files you have never opened, and
  // the failure names a path that looks like yours because every worktree has
  // the same layout.
  //
  // Spread over the defaults rather than replacing them, so `node_modules` and
  // `dist` stay excluded — passing a bare array here silently drops both.
  test: {
    // `site/` is the other project's (vitest.astro.config.ts) — its tests
    // import `.astro` components, which only Astro's plugins can transform.
    // `functions/` has its own dependencies and runs under `pnpm test:rules`.
    exclude: [
      ...configDefaults.exclude,
      '**/.claude/**',
      'site/**',
      'functions/**',
    ],
    setupFiles: ['./src/testSetup.ts'],
    testTimeout: 30000,
  },
})

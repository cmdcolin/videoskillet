import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

import { appDefine, appPlugins, reactCompiler } from './vite.shared.ts'

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
//
// `site/` is the other project's (vitest.astro.config.ts) — its tests import
// `.astro` components, which only Astro's plugins can transform. `functions/`
// has its own dependencies and runs under `pnpm test:rules`.
const exclude = [
  ...configDefaults.exclude,
  '**/.claude/**',
  'site/**',
  'functions/**',
]

// A test that mounts components is named `*.dom.test.tsx` and runs in jsdom.
// Everything else stays on bare node, which is faster to start. The split
// also decides whether the React Compiler runs: plugin-react compiles a module
// only for a client environment, and vitest gives jsdom one and node a server
// one.
const DOM_TESTS = 'src/**/*.dom.test.tsx'

// The app's plugins and tests. Astro (astro.config.mjs) owns the dev server and
// the build; `vitest` and `scripts/docgen.mjs` read this file.
export default defineConfig({
  plugins: [...appPlugins(), react({ compiler: reactCompiler })],
  define: appDefine,
  test: {
    exclude,
    setupFiles: ['./src/testSetup.ts'],
    testTimeout: 30000,
    projects: [
      {
        extends: true,
        test: { name: 'node', exclude: [...exclude, DOM_TESTS] },
      },
      {
        extends: true,
        test: { name: 'dom', include: [DOM_TESTS], environment: 'jsdom' },
      },
    ],
  },
})

import { defineConfig } from 'vite'

import pkg from './package.json' with { type: 'json' }
import { wgsl } from './vite-plugin-wgsl.ts'

import { execSync } from 'node:child_process'

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// The engine, bundled for a JS runtime with no bundler in it.
//
// `scripts/render/main.ts` runs the signal path under Deno's wgpu, and the only
// thing standing between Deno and `core/gpu/pipeline.ts` is that the pass graph
// reaches its twenty-odd shaders through Vite's `?raw`. So the shaders are
// resolved here, once, and what Deno imports is the app's own `Engine` rather
// than a second transcription of the pass order — see `scripts/render/entry.ts`.
//
// **No React and no DOM in this build.** The entry re-exports core plus the two
// pure look-parsers from `ui/` (`packed.ts`, `presets.ts`), and `core/` may not
// import the app at all — oxlint enforces that. So what lands here is the
// simulator, the control table, and the arithmetic that turns a link into a
// board. A React import appearing in this bundle means something crossed a line
// that is supposed to be checked.
export default defineConfig({
  plugins: [wgsl()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(gitSha()),
  },
  build: {
    outDir: 'scripts/render/build',
    emptyOutDir: true,
    target: 'esnext',
    // Read by a person exactly once, when the renderer disagrees with the tab.
    minify: false,
    lib: {
      entry: 'scripts/render/entry.ts',
      formats: ['es'],
      fileName: () => 'engine.js',
    },
  },
})

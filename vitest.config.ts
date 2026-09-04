import { defineConfig } from 'vitest/config'

// Two suites, one `pnpm test`. The app's lives in `vite.config.ts` beside the
// build it is testing; the site's needs Astro's vite plugins to transform
// `.astro`, which the app build must not have.
export default defineConfig({
  test: { projects: ['./vite.config.ts', './vitest.astro.config.ts'] },
})

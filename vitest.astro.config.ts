import { getViteConfig } from 'astro/config'

// The site's own components, rendered through Astro rather than read off a
// built file. `getViteConfig` is what teaches vitest to transform `.astro`, and
// it is a separate project because the app's config must not carry Astro's
// plugins into the app build.
export default getViteConfig({
  test: {
    name: 'site',
    include: ['site/**/*.test.ts'],
    exclude: ['**/.claude/**', '**/node_modules/**'],
    testTimeout: 30000,
  },
})

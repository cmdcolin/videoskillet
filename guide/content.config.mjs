import { glob } from 'astro/loaders'
import { defineCollection } from 'astro:content'

// The markdown stays where it is: `docs/` is what GitHub renders and what
// `scripts/docgen.mjs` writes into. Ids keep the path so `docs/adr/0004-….md`
// and the page config name the same entry.
const docs = defineCollection({
  loader: glob({
    base: 'docs',
    pattern: '**/*.md',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
})

export const collections = { docs }

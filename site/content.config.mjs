import { glob } from 'astro/loaders'
import { defineCollection } from 'astro:content'

import { postSchema } from './lib/posts'

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

const posts = defineCollection({
  loader: glob({ base: 'site/posts', pattern: '*.md' }),
  schema: postSchema,
})

export const collections = { docs, posts }

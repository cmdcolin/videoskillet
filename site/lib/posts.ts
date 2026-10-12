// CROSS_REPO_SYNC_FILE(posts)
// The blog's posts are markdown files written by hand. `scripts/blogdraft.mjs`
// drafts one from the commits since the last post.
import { z } from 'astro/zod'

export const postSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  summary: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  look: z.string().optional(),
  draft: z.boolean().default(false),
})

export type PostData = z.infer<typeof postSchema>

export const published = (post: { data: PostData }) => !post.data.draft

export const isoDay = (date: Date) => date.toISOString().slice(0, 10)

export function longDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function newestFirst<T extends { id: string; data: PostData }>(
  posts: T[],
) {
  return posts.toSorted(
    (a, b) =>
      b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id),
  )
}

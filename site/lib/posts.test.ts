// CROSS_REPO_SYNC_FILE(posts-test)
import { expect, test } from 'vitest'

import { isoDay, longDate, newestFirst, postSchema } from './posts.ts'

const post = (id: string, date: string | Date) => ({
  id,
  data: postSchema.parse({
    title: id,
    date,
    summary: '',
    image: '/a.webp',
    imageAlt: '',
  }),
})

test('newest post first, and posts on one day in id order', () => {
  const sorted = newestFirst([
    post('b', '2026-10-01'),
    post('c', '2026-10-11'),
    post('a', '2026-10-11'),
  ])
  expect(sorted.map(p => p.id)).toEqual(['a', 'c', 'b'])
})

test('a quoted or unquoted frontmatter date reads back as the same day', () => {
  expect(isoDay(post('a', '2026-10-11').data.date)).toBe('2026-10-11')
  expect(isoDay(post('a', new Date('2026-10-11')).data.date)).toBe('2026-10-11')
})

test('a post date reads as a long date whatever the local timezone', () => {
  expect(longDate(post('a', '2026-10-01').data.date)).toBe('October 1, 2026')
})

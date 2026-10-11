import { experimental_AstroContainer } from 'astro/container'
import { expect, test } from 'vitest'

import About from '../pages/about.astro'
import Blog from '../pages/blog.astro'
import Landing from '../pages/index.astro'

import { readFileSync } from 'node:fs'

test('the bar links the about page and the blog, and the about page links privacy', async () => {
  const container = await experimental_AstroContainer.create()
  const landing = await container.renderToString(Landing)
  const about = await container.renderToString(About)
  const bar = landing.slice(landing.indexOf('class="barNav"'))
  const nav = bar.slice(0, bar.indexOf('</nav>'))
  expect(nav).toContain('href="/about/"')
  expect(nav).toContain('href="/blog/"')
  expect(about).toContain('href="/privacy/"')
})

test('the blog opens on the newest day in the changelog', async () => {
  const container = await experimental_AstroContainer.create()
  const blog = await container.renderToString(Blog)
  const newest = /^## \[[\d.]+\]\(.*\) - ([\d-]+)$/m.exec(
    readFileSync('CHANGELOG.md', 'utf8'),
  )?.[1]
  expect(/<article class="post" id="([\d-]+)"/.exec(blog)?.[1]).toBe(newest)
})

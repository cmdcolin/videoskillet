import { experimental_AstroContainer } from 'astro/container'
import { expect, test } from 'vitest'

import About from '../pages/about.astro'
import Landing from '../pages/index.astro'

import { existsSync, readFileSync, readdirSync } from 'node:fs'

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

test('every published post points at an image that exists', () => {
  for (const file of readdirSync('site/posts').filter(f => f.endsWith('.md'))) {
    const text = readFileSync(`site/posts/${file}`, 'utf8')
    if (/^draft: true$/m.test(text)) continue
    const image = /^image: (.+)$/m.exec(text)?.[1]
    expect(image, file).toMatch(/^\//)
    expect(existsSync(`public${image}`), `${file}: ${image}`).toBe(true)
  }
})

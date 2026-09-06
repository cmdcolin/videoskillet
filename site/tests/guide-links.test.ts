import { experimental_AstroContainer } from 'astro/container'
import { beforeAll, expect, test } from 'vitest'

import { GUIDE_URL } from '../../src/ui/links'
import { ALL, href, slug } from '../lib/pages.mjs'
import Landing from '../pages/index.astro'

import { readFileSync } from 'node:fs'

// The landing page and the app menu are the two places a stranger walks into the
// guide, and they walk in by page address and section anchor. Nothing else
// checks them: the guide is rendered from markdown that has no idea these links
// exist, so a renamed page or a reworded heading breaks them silently.
let into: string[] = []

beforeAll(async () => {
  const container = await experimental_AstroContainer.create()
  const page = await container.renderToString(Landing)
  into = [...page.matchAll(/(?:href|src)="\/guide\/([^"]*)"/g)].map(m => m[1])
})

const headings = (file: string) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => /^###? /.test(line))
    .map(line => slug(line.replace(/^#+ /, '')))

test('the landing page links into the guide at all', () => {
  expect(into.length).toBeGreaterThan(0)
})

test('every page the landing page links to is a page the guide renders', () => {
  for (const link of into) {
    const [path] = link.split('#')
    if (path !== '' && !path.startsWith('img/')) {
      expect(
        ALL.map(spec => href(spec.slug)),
        `the landing page links to /guide/${path}`,
      ).toContain(`/guide/${path}`)
    }
  }
})

// No floor on the count: the page carries no guide figure today, and the two
// tests above already fail loudly if the extraction stops matching anything.
test('every figure the landing page pulls out of the guide exists', () => {
  const figures = into.filter(link => link.startsWith('img/'))
  for (const figure of figures) {
    expect(
      readFileSync(`docs/${figure}`).length,
      `docs/${figure}`,
    ).toBeGreaterThan(0)
  }
})

// No floor here either, for the reason the figure test gives: the page links to
// the guide's front door and nothing deeper since the How it works section came
// out of it, and a page that deep-links to nothing is a layout decision rather
// than an extraction that has stopped working.
test('every section the landing page deep-links to is a heading that exists', () => {
  const anchored = into.filter(link => link.includes('#'))
  for (const link of anchored) {
    const [path, hash] = link.split('#')
    const spec = ALL.find(page => href(page.slug) === `/guide/${path}`)
    if (spec === undefined) {
      expect.fail(
        `the landing page deep-links to /guide/${path}, which is no page`,
      )
    } else {
      expect(headings(spec.file), `/guide/${link}`).toContain(hash)
    }
  }
})

test('the app menu opens the guide at its root', () => {
  expect(GUIDE_URL).toBe('https://videoskillet.com/guide/')
})

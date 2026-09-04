import { expect, test } from 'vitest'

import { ALL, slug } from '../../guide/lib/pages.mjs'
import { GUIDE_URL } from './links'

import { existsSync, readFileSync } from 'node:fs'

// The landing page and the app menu are the two places a stranger walks into the
// guide, and they walk in by page filename and section anchor. Nothing else
// checks them: the guide is rendered from markdown that has no idea these links
// exist, so a renamed page or a reworded heading breaks them silently.
const landing = readFileSync('index.html', 'utf8')
const into = [...landing.matchAll(/(?:href|src)="\/guide\/([^"]*)"/g)].map(
  m => m[1],
)

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
        ALL.map(spec => spec.out),
        `index.html links to /guide/${path}`,
      ).toContain(path)
    }
  }
})

test('every figure the landing page pulls out of the guide exists', () => {
  const figures = into.filter(link => link.startsWith('img/'))
  expect(figures.length).toBeGreaterThan(0)
  for (const figure of figures) {
    expect(existsSync(`docs/${figure}`), `docs/${figure}`).toBe(true)
  }
})

test('every section the landing page deep-links to is a heading that exists', () => {
  const anchored = into.filter(link => link.includes('#'))
  expect(anchored.length).toBeGreaterThan(0)
  for (const link of anchored) {
    const [path, hash] = link.split('#')
    const out = path === '' ? 'index.html' : path
    const spec = ALL.find(page => page.out === out)
    if (spec === undefined) {
      expect.fail(`index.html deep-links to /guide/${path}, which is no page`)
    } else {
      expect(headings(spec.file), `/guide/${link}`).toContain(hash)
    }
  }
})

test('the app menu opens the guide at its root', () => {
  expect(GUIDE_URL).toBe('https://videoskillet.com/guide/')
})

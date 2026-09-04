import { experimental_AstroContainer } from 'astro/container'
import { beforeAll, expect, test } from 'vitest'

import { demos, gallery, hero, showcase } from '../../scripts/demos.mjs'
import { beatSecs, NARROW, slides } from '../../scripts/reel.mjs'
import Landing from '../pages/index.astro'

import { readFileSync } from 'node:fs'

// The page rendered, rather than a file read off disk. It used to be the second
// — `demogen.mjs` wrote the stage, the cards and the hero into `index.html` and
// these tests string-sliced them back out, because a generated block in a
// checked-in file is a thing a person can also edit. The page maps over the
// same two lists itself now, so what is worth checking is what generation
// cannot settle: that a slide has recordings behind it at all, that the stage
// advances on each slide's own length, and that exactly one still is fetched
// eagerly.
let page = ''
let stage = ''

beforeAll(async () => {
  const container = await experimental_AstroContainer.create()
  page = await container.renderToString(Landing)
  stage = page.slice(
    page.indexOf('<div class="stage">'),
    page.indexOf('<div class="slideBar">'),
  )
})

const bytes = (path: string) =>
  readFileSync(`public/${path.replace(/^\//, '')}`).length

test('the hero shows the demo flagged hero, as a still', () => {
  expect(/class="heroShot"\s+src="([^"]+)"/.exec(page)?.[1]).toBe(hero.poster)
  expect(page).not.toContain('class="heroVid"')
  expect(bytes(hero.poster)).toBeGreaterThan(0)
})

// The stylesheet is read off disk rather than out of the render: vitest resolves
// `?raw` on a `.css` file to an empty string — vite's CSS pipeline takes it
// before the `raw` query is honoured — while the same import on the `.js` gives
// its source. The build inlines both (`dist/index.html` carries the rule), so
// what is checked here is the rule, and that the page still inlines a
// stylesheet at all.
const stylesheet = readFileSync('site/styles/landing.css', 'utf8')

test('a reader who asked for no motion gets the stills and the tabs', () => {
  expect(page).toContain("veil.className = 'stageVeil'")
  expect(page).toContain('<style')
  expect(
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.stageVeil\s*\{/.test(
      stylesheet,
    ),
  ).toBe(true)
  expect(page).toContain('class="slideTabs"')
})

test('the carousel has slides', () => {
  expect(slides.length).toBeGreaterThan(0)
})

test.each(slides)('$name has all four recordings', slide => {
  expect(bytes(slide.clip)).toBeGreaterThan(0)
  expect(bytes(slide.still)).toBeGreaterThan(0)
  expect(bytes(slide.narrowClip)).toBeGreaterThan(0)
  expect(bytes(slide.narrowStill)).toBeGreaterThan(0)
})

test.each(slides)('$name reaches the stage', slide => {
  expect(stage).toContain(`data-src="${slide.clip}"`)
  expect(stage).toContain(`data-src-narrow="${slide.narrowClip}"`)
  expect(stage).toContain(`data-name="${slide.name}"`)
  expect(stage).toContain(slide.alt.slice(0, 60))
  expect(page).toContain(slide.caption.slice(0, 40))
})

const total = (act: { secs?: number }[]) =>
  act.reduce((sum, beat) => sum + beatSecs(beat), 0)

test.each(slides)('$name is held for its own length', slide => {
  const at = (attr: string) =>
    new RegExp(`data-name="${slide.name}"[^>]*${attr}="([\\d.]+)"`, 's').exec(
      stage,
    )?.[1]
  expect(Number(at('data-secs'))).toBeCloseTo(total(slide.act), 1)
  expect(Number(at('data-secs-narrow'))).toBeCloseTo(total(slide.narrowAct), 1)
})

test('one still is fetched, and the rest wait for their slide', () => {
  expect([...stage.matchAll(/<img[^>]+\ssrc="/g)]).toHaveLength(1)
  expect([...stage.matchAll(/<img[^>]+data-src="/g)]).toHaveLength(
    slides.length - 1,
  )
})

test('the narrow breakpoint is written down once, where the page reads it', () => {
  expect(/<source\s+media="([^"]+)"/.exec(stage)?.[1]).toBe(NARROW.at)
  expect(stage).toContain(`srcset="${slides[0].narrowPoster}"`)
})

test('the stage opens on the first slide, and every slide is in it once', () => {
  expect(/class="slide on"\s+data-name="([^"]+)"/.exec(stage)?.[1]).toBe(
    slides[0].name,
  )
  expect([...stage.matchAll(/class="slide[^"]*"\s+data-name=/g)]).toHaveLength(
    slides.length,
  )
  expect([...page.matchAll(/class="slideNote(?: on)?"/g)]).toHaveLength(
    slides.length,
  )
  expect([...page.matchAll(/class="slideNote on"/g)]).toHaveLength(1)
})

test('there are demos, and one of them can be a slide', () => {
  expect(demos.length).toBeGreaterThan(3)
  expect(showcase.length).toBeGreaterThan(0)
  expect(gallery.length).toBeGreaterThan(0)
})

test.each(demos)('$name has a recording and a still', demo => {
  expect(bytes(demo.clip)).toBeGreaterThan(0)
  expect(bytes(demo.still)).toBeGreaterThan(0)
})

test.each(gallery)('$name is a card on the page', demo => {
  expect(page).toContain(demo.href.replaceAll('&', '&amp;'))
  expect(page).toContain(`data-src="${demo.clip}"`)
})

// A card's own sentence, and the only place on the page that says which
// mechanism a picture is of. A demo kept out of the gallery still carries one,
// so that turning it back on is one flag rather than a flag and a caption.
test.each(demos)('$name says which mechanism it is', demo => {
  expect(demo.says.length).toBeGreaterThan(20)
  expect(demo.says.endsWith('.')).toBe(true)
})

test.each(gallery)('$name has its line under the name', demo => {
  expect(page).toContain(demo.says.replaceAll("'", '&#39;'))
})

// Off the page, still in the README: `demos` is what the README prints, so a
// demo dropped from the gallery has to stay in the list rather than the file.
test('a demo kept out of the gallery is still a demo', () => {
  for (const demo of demos.filter(d => !d.gallery)) {
    expect(page).not.toContain(`data-src="${demo.clip}"`)
    expect(readFileSync('README.md', 'utf8')).toContain(demo.url)
  }
})

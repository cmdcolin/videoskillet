import { expect, test } from 'vitest'

import { demos, hero, showcase } from '../../scripts/demos.mjs'

import { readFileSync } from 'node:fs'

// The demo list is `demos.json`, and both places that show it — the README's
// "Cool demos" and the landing page's gallery — are generated from it by
// `scripts/demogen.mjs`. So the drift this used to hunt for is gone by
// construction, and what is left to check is narrower and worth more:
//
//  - that the generated blocks in the checked-in files are the ones the current
//    `demos.json` produces, which `pnpm demos:check` decides and `pnpm build`
//    runs. Without it a demo added to the JSON and never generated is a demo
//    nobody sees, and one renamed is a card whose clip 404s.
//  - that every demo has a recording. Nothing generates those — `demoreel.mjs`
//    drives a browser to make them — so a demo can be listed, rendered into
//    both pages, and still be a black tile.
const landing = readFileSync('index.html', 'utf8')

const bytes = (path: string) =>
  readFileSync(`public/${path.replace(/^\//, '')}`).length

test('the demo list is not empty', () => {
  // Deliberately not a count. Which demos are worth showing is a judgement that
  // changes; what must never happen silently is the list emptying and the
  // gallery going out as a heading over empty space.
  expect(demos.length).toBeGreaterThan(3)
})

test('the carousel has a look to sit on', () => {
  // `showcase` is what a reel slide resolves a look through (scripts/reel.mjs),
  // so an empty list is a carousel whose first slide cannot be recorded.
  expect(showcase.length).toBeGreaterThan(0)
})

test.each(demos)('$name is recorded', ({ clip, still }) => {
  // A missing still is an empty black tile rather than an error, and a missing
  // clip is a card that never starts — neither raises anything at build time.
  expect({ clip: bytes(clip) > 0, still: bytes(still) > 0 }).toEqual({
    clip: true,
    still: true,
  })
})

test.each(demos)('$name is on the page', ({ href, clip }) => {
  // The generator's own check compares whole files; this says which demo went
  // missing when one does, which is the thing worth reading in a failure.
  expect({
    href: landing.includes(href.replaceAll('&', '&amp;')),
    clip: landing.includes(`data-src="${clip}"`),
  }).toEqual({ href: true, clip: true })
})

test('the hero plays the first demo listed', () => {
  // In the markup rather than set by script, because it is what a reader sees
  // before a line of it runs — and a reader who asked for reduced motion sees
  // only the still it names.
  expect(/class="heroVid"\s+data-clip="([^"]+)"/.exec(landing)?.[1]).toBe(
    hero.clip,
  )
})

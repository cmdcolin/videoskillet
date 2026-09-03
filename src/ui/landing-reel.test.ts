import { expect, test } from 'vitest'

import { hero } from '../../scripts/demos.mjs'
import { beatSecs, heroBackdrop, NARROW, slides } from '../../scripts/reel.mjs'

import { readFileSync } from 'node:fs'

// The carousel is `scripts/reel.mjs` — recordings of the app's own window —
// and `demogen.mjs` writes the stage, the tabs' slides and the captions from
// it. So the drift worth checking here is what generation cannot settle:
//
//  - that a slide has a recording at all. Nothing generates those:
//    `appreel.mjs` drives a browser for a minute a slide to make them, so a
//    slide can be listed, rendered into the page and still be a black frame.
//  - that the page advances on each slide's own length. The stage reads
//    `data-secs` off the markup and holds the slide for that long plus a beat
//    to read the line, and a wrong number cuts a drag off halfway.
//  - that a slide's caption reached the page. The notes are stacked in the
//    markup with one shown, so a missing one is not a missing element — it is
//    the wrong line under the wrong slide.
const landing = readFileSync('index.html', 'utf8')
const stage = landing.slice(
  landing.indexOf('<div class="stage">'),
  landing.indexOf('<div class="slideBar">'),
)

const bytes = (path: string) =>
  readFileSync(`public/${path.replace(/^\//, '')}`).length

test('the hero plays the first demo listed, in its own encode', () => {
  // In the markup rather than set by script, because it is what a reader sees
  // before a line of it runs — and a reader who asked for reduced motion sees
  // only the still it names.
  //
  // Its own encode, because the hero is the one clip fetched before anybody has
  // scrolled anywhere and it plays scrimmed down to a fifth of itself. Nothing
  // but this would notice the file going missing: `demoreel.mjs` writes it as a
  // side effect of recording the first demo, so re-recording a *different* demo
  // and deleting the old file would leave the hero blank.
  expect({
    clip: /class="heroVid"\s+data-clip="([^"]+)"/.exec(landing)?.[1],
    ofTheFirstDemo: heroBackdrop.clip.startsWith(hero.clip.slice(0, -4)),
    recorded: bytes(heroBackdrop.clip) > 0,
  }).toEqual({
    clip: heroBackdrop.clip,
    ofTheFirstDemo: true,
    recorded: true,
  })
})

test('the carousel has slides', () => {
  // Not a count: which moves are worth showing is a judgement that changes.
  // What must never happen quietly is the list emptying and the page going out
  // with a bordered black box in the middle of it.
  expect(slides.length).toBeGreaterThan(0)
})

test.each(slides)(
  '$file is recorded, in both frames',
  ({ clip, still, narrowClip, narrowStill }) => {
    // Two takes each: the window as a desktop shows it, and the app's portrait
    // layout at a phone's width. A missing narrow take is a slide that plays
    // nothing on exactly the devices it was recorded for.
    expect({
      clip: bytes(clip) > 0,
      still: bytes(still) > 0,
      narrowClip: bytes(narrowClip) > 0,
      narrowStill: bytes(narrowStill) > 0,
    }).toEqual({
      clip: true,
      still: true,
      narrowClip: true,
      narrowStill: true,
    })
  },
)

test.each(slides)(
  '$file is on the page',
  ({ name, clip, narrowClip, alt, caption }) => {
    expect({
      clip: stage.includes(`data-src="${clip}"`),
      narrowClip: stage.includes(`data-src-narrow="${narrowClip}"`),
      named: stage.includes(`data-name="${name}"`),
      // The stills are the only account of the window a reader who cannot see
      // it gets, so an empty alt here is not decoration — it is a slide that
      // says nothing.
      described: stage.includes(alt.slice(0, 60)),
      // Wrapped by the formatter, so the whole caption is not one string in the
      // file; its opening clause is enough to say which line went missing.
      captioned: landing.includes(caption.slice(0, 40)),
    }).toEqual({
      clip: true,
      narrowClip: true,
      named: true,
      described: true,
      captioned: true,
    })
  },
)

test.each(slides)('$file holds the stage for its own length', slide => {
  // Both of them, because the portrait take can run a beat longer: it scrolls
  // to what the wide frame can already see.
  const attr = (name: string) =>
    Number(
      new RegExp(`data-name="${slide.name}"[^>]*${name}="([\\d.]+)"`, 's').exec(
        stage,
      )?.[1],
    )
  const length = (act: typeof slide.act) =>
    act.reduce((total, beat) => total + beatSecs(beat), 0)
  expect(attr('data-secs')).toBeCloseTo(length(slide.act), 1)
  expect(attr('data-secs-narrow')).toBeCloseTo(length(slide.narrowAct), 1)
})

test('only the slide showing has fetched its still', () => {
  // The other two arrive on a `data-src` when their tab is reached. They are
  // 100K apiece of app window, and `loading="lazy"` does not defer them: the
  // stage sits near enough to the fold that the browser fetches them anyway.
  expect({
    eager: [...stage.matchAll(/<img[^>]+\ssrc="/g)].length,
    deferred: [...stage.matchAll(/<img[^>]+data-src="/g)].length,
  }).toEqual({ eager: 1, deferred: slides.length - 1 })
})

test('the stage says where the portrait recordings take over', () => {
  // The breakpoint is written down once, in the first slide's `<source>`: the
  // browser picks the still through it, the stage takes its shape from the
  // still, and the script reads the same string back off the element to pick
  // the clips. Losing it would leave a phone playing a 1112px window in a box
  // shaped like a phone.
  expect({
    media: /<source\s+media="([^"]+)"/.exec(stage)?.[1],
    srcset: stage.includes(`srcset="${slides[0].narrowPoster}"`),
  }).toEqual({ media: NARROW.at, srcset: true })
})

test('the carousel opens on its first slide', () => {
  // Only the first slide carries `on` — and only its caption does, so a reader
  // with no script sees one line rather than three.
  expect({
    // Whitespace-tolerant: the formatter breaks a <figure> across lines once
    // it carries enough attributes, and it has since the portrait take gave
    // every slide a second length.
    slide: /class="slide on"\s+data-name="([^"]+)"/.exec(stage)?.[1],
    slides: [...stage.matchAll(/class="slide[^"]*"\s+data-name=/g)].length,
    notes: [...landing.matchAll(/class="slideNote(?: on)?"/g)].length,
    open: [...landing.matchAll(/class="slideNote on"/g)].length,
  }).toEqual({
    slide: slides[0].name,
    slides: slides.length,
    notes: slides.length,
    open: 1,
  })
})

import { expect, test } from 'vitest'

import { readFileSync } from 'node:fs'

// The landing page's demo gallery is the README's "Cool demos" list, recorded.
// Each card is an <a> into the app carrying that demo's exact query, and each
// one was generated from the README rather than typed — but generated once, so
// nothing stops the two drifting afterwards.
//
// A drift here is silent in the worst way. These queries are packed looks: an
// edited or half-copied one still decodes, still opens, and still shows
// *something*, so a card that no longer matches the clip playing on it is a
// card nobody can spot by looking at the page.
const query = (url: string) => url.slice(url.indexOf('?'))

const readmeQueries = new Set(
  [
    ...readFileSync('README.md', 'utf8')
      .slice(readFileSync('README.md', 'utf8').indexOf('## Cool demos'))
      .matchAll(/^- (.+)\n\s+(https?:\/\/\S+)$/gm),
  ].map(m => query(m[2])),
)

const landing = readFileSync('index.html', 'utf8')

// One match per card, carrying the three things that have to agree: where it
// sends you, the clip it plays, and the still it shows until that clip is
// fetched. Reading them together is what makes the check meaningful — a card
// whose href and clip come from different demos is exactly the drift this is
// here for, and matching them separately would not see it.
//
// The href is HTML-escaped in the file and the README's is not, so the
// comparison is made after unescaping. Matched across newlines throughout,
// because oxfmt breaks a card's attributes onto their own lines once the packed
// href makes the tag long enough — which it always does.
const cards = [
  ...landing.matchAll(
    /class="demo"\s+href="\/app\/([^"]+)"[\s\S]*?data-src="([^"]+)"[\s\S]*?poster="([^"]+)"/g,
  ),
].map(m => ({
  query: m[1].replaceAll('&amp;', '&'),
  clip: m[2],
  poster: m[3],
}))

const heroClip = /class="heroVid"[\s\S]*?src="([^"]+)"/.exec(landing)?.[1]

test('the landing page shows a gallery at all', () => {
  // Deliberately not a count. The gallery is generated from the README, and
  // which demos are worth showing is a judgement that changes; what must never
  // happen silently is the generator emitting nothing and the section going out
  // as a heading over empty space.
  expect(cards.length).toBeGreaterThan(3)
})

test('the hero clip is not also a card', () => {
  // The hero is one of these same recordings. Showing it twice on one page is
  // the mistake that looks intentional, so it is worth pinning.
  expect(cards.map(c => c.clip)).not.toContain(heroClip)
})

test.each(cards)('$clip came from the README', ({ query: q }) => {
  expect(readmeQueries.has(q)).toBe(true)
})

test.each(cards)('$clip has a clip and a poster', ({ clip, poster }) => {
  // A missing poster is an empty black tile rather than an error, and a missing
  // clip is a card that never starts — neither raises anything at build time.
  // The clip is page-relative and the poster root-absolute, because vite
  // rewrites one and not the other; both name the same directory in `public/`.
  for (const path of [clip, poster]) {
    const bytes = readFileSync(`public/${path.replace(/^\//, '')}`).length
    expect({ path, hasBytes: bytes > 0 }).toEqual({ path, hasBytes: true })
  }
})

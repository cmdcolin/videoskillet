// The demo list, and everything derived from it.
//
// `demos.json` is the one place a demo is written down. It used to be the
// README's "Cool demos" bullets, which the recorder parsed and the landing page
// had been generated from *once* — and a list that is generated once is a list
// that drifts. It had, within a day: a card opening a look its own clip was not
// a recording of, because the README's link was edited and the page's was not;
// a clip named `woggity.mp4` behind a card called Ponderorb; and a demo added to
// the README that no page showed at all. `landing-demos.test.ts` caught the
// first of those and could never have caught the last two.
//
// So the README section and the gallery are both generated now, by
// `demogen.mjs`, and the recorder reads the same file. What a demo is:
//
//   name   what it is called, on the card and in the README. The recording is
//          named after it, so renaming a demo renames its files — which the
//          generator's --check will tell you about before a card goes blank.
//   query  the packed look, from its sigil onwards — `?p=…` or `#src=…`. Both
//          are links the app writes: it moves what it was handed into the
//          fragment once it owns the bar, so a look copied out of the address
//          bar arrives with either, and `paramsOf` in core/gpu/env reads
//          whichever is there. The origin is not stored: every published link
//          is videoskillet.com, and two of these were pasted from a dev server
//          and published pointing at localhost.
//   showcase
//          whether the carousel under the hero shows it. The carousel is a few
//          looks worth stopping on beside a shot of the app's window, so this
//          is a short list and the gallery below is the long one — a demo joins
//          the carousel by turning this on and running `pnpm demos`.
//   gallery
//          whether it gets a card on the landing page. A look can be worth a
//          line in the README and not worth a card: `Ponderorb` and
//          `Fuzzy color bars feedback` are camera loops that have reached a
//          fixed point, so every frame of their eight seconds is the same frame
//          — a card that a reader hovers and nothing happens on. Off the page,
//          still in the list, still a link that opens.
//   says   one clause under the name, saying which mechanism is on screen. The
//          gallery is the page's argument that these faults come out of a
//          signal path rather than a filter, and a wall of pictures with names
//          like "Wonkitize me" over them does not make it. Read off the look
//          itself — the controls it carries that stock does not — so a caption
//          is a description of the board and not a guess at the picture.
//
// Order is the order everything shows in: the carousel plays its members in it,
// the gallery lists all of them in it, and the README prints it.
//
// There was a `hero` flag here too, naming the one still the header showed and
// the link preview was grounded in. The header is the headline itself now
// (`scripts/heroplate.mjs`) and so is the card, so no demo stands in for the
// page any more and nothing read the flag.
import { readFileSync } from 'node:fs'

export const APP = 'https://videoskillet.com/app/'

// Where the clips live, which is the bucket the carousel's already go to
// (`reel.mjs`) under a prefix of their own. Fifteen loops of a moving picture
// is fifteen megabytes, and a git history is the wrong place to keep a file
// that is rewritten whenever its look is re-recorded — the stills stay in
// `public/demos`, the mp4s go up with `aws s3 cp` at the end of a take
// (`demoreel.mjs`). The page reads the clip URL straight off `data-src`, so an
// absolute URL is fine where a root-absolute path would not be.
export const S3_PREFIX = 's3://myloveydove.com/videoskillet/demos/'
export const CLIPS = 'https://myloveydove.com/videoskillet/demos/'

export const slug = name =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')

// Annotated because `JSON.parse` hands back `any`, and `landing-demos.test.ts`
// imports this module: without a shape here, the tests over it are unchecked.
/** @type {{ name: string, query: string, says: string, showcase: boolean, gallery: boolean }[]} */
const listed = JSON.parse(readFileSync('demos.json', 'utf8'))

// `still` is page-relative and `poster` is not, which is not an oversight: vite
// rewrites the asset attributes it knows — `src` and `poster` become
// `./demos/…` under this project's relative base — and it has never heard of a
// data attribute, so a root-absolute one would survive the build unchanged and,
// on a deploy under a sub-path, give a card a working still over a clip that
// 404s. The landing page is the root, so both spellings name the same file.
//
// `clip` sidesteps all of that by being somewhere else entirely.
export const demos = listed.map(demo => {
  const file = slug(demo.name)
  // The origin belongs to this file, not to an entry — a demo is copied out of
  // the address bar, and what lands on the clipboard is the whole url. Left
  // alone that concatenates: `.../app/https://videoskillet.com/app/?p=…`, a
  // published link that opens nothing, in a block nobody proofreads because it
  // is generated. The comment above said the origin is not stored; this is what
  // makes that true rather than hoped for.
  //
  // Either sigil passes. This used to demand a `?` and reject everything else
  // as an origin, which also rejected the form the app itself hands you: once
  // it owns the address bar it writes the look into the fragment, so half the
  // links a person copies begin `#`.
  if (!demo.query.startsWith('?') && !demo.query.startsWith('#')) {
    throw new Error(
      `${demo.name}: query must start with '?' or '#', not an origin — got ${demo.query.slice(0, 40)}…`,
    )
  }
  return {
    ...demo,
    file,
    url: `${APP}${demo.query}`,
    href: `/app/${demo.query}`,
    clip: `${CLIPS}${file}.mp4`,
    still: `demos/${file}.webp`,
    poster: `/demos/${file}.webp`,
  }
})

export const showcase = demos.filter(demo => demo.showcase)

// The cards, in order. `demos` is still the whole list — the README prints it,
// and a demo off the page keeps its link there.
export const gallery = demos.filter(demo => demo.gallery)

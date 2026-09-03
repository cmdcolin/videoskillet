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
//   query  the packed look, `?p=…` onwards. The origin is not stored: every
//          published link is videoskillet.com, and two of these were pasted
//          from a dev server and published pointing at localhost.
//   reel   whether the hero plays it. The hero is a sampler of the gallery, and
//          this is the half of it that survives the scrim over it — three of
//          these recordings are dark tape transfers that read as an empty black
//          band behind the wash the hero's display type needs.
//
// Order is the order everything shows in: the reel plays its members in it, the
// gallery lists all of them in it, and the README prints it.
import { readFileSync } from 'node:fs'

export const APP = 'https://videoskillet.com/app/'

export const slug = name =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')

// Annotated because `JSON.parse` hands back `any`, and `landing-demos.test.ts`
// imports this module: without a shape here, the tests over it are unchecked.
/** @type {{ name: string, query: string, reel: boolean }[]} */
const listed = JSON.parse(readFileSync('demos.json', 'utf8'))

// `clip` and `still` are page-relative and `poster` is not, which is not an
// oversight: vite rewrites the asset attributes it knows — `src` and `poster`
// become `./demos/…` under this project's relative base — and it has never
// heard of a data attribute, so a root-absolute one would survive the build
// unchanged and, on a deploy under a sub-path, give a card a working still over
// a clip that 404s. The landing page is the root, so both spellings name the
// same file here.
export const demos = listed.map(demo => {
  const file = slug(demo.name)
  return {
    ...demo,
    file,
    url: `${APP}${demo.query}`,
    href: `/app/${demo.query}`,
    clip: `demos/${file}.mp4`,
    still: `demos/${file}.webp`,
    poster: `/demos/${file}.webp`,
  }
})

export const reel = demos.filter(demo => demo.reel)

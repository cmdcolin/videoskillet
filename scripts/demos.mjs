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
//   showcase
//          whether the carousel under the hero shows it. The carousel is a few
//          looks worth stopping on beside a shot of the app's window, so this
//          is a short list and the gallery below is the long one — a demo joins
//          the carousel by turning this on and running `pnpm demos`.
//   hero   the still behind the title, and the ground of the link preview
//          (`ogimage.mjs`), which are one picture so that the page and the card
//          standing in for it when it is shared are the same look. Exactly one
//          demo carries it.
//
// Order is the order everything shows in: the carousel plays its members in it,
// the gallery lists all of them in it, and the README prints it. The hero used
// to be the first of them, which is a different job asked of one line: the head
// of the gallery is picked for what opens a list, and the hero for what a
// title can be read over — a quiet corner and a bright far side. `hero` above
// is those two coming apart.
import { readFileSync } from 'node:fs'

export const APP = 'https://videoskillet.com/app/'

export const slug = name =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')

// Annotated because `JSON.parse` hands back `any`, and `landing-demos.test.ts`
// imports this module: without a shape here, the tests over it are unchecked.
/** @type {{ name: string, query: string, showcase: boolean, hero?: boolean }[]} */
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
  // The origin belongs to this file, not to an entry — a demo is copied out of
  // the address bar, and what lands on the clipboard is the whole url. Left
  // alone that concatenates: `.../app/https://videoskillet.com/app/?p=…`, a
  // published link that opens nothing, in a block nobody proofreads because it
  // is generated. The comment above said the origin is not stored; this is what
  // makes that true rather than hoped for.
  if (!demo.query.startsWith('?')) {
    throw new Error(
      `${demo.name}: query must start with '?', not an origin — got ${demo.query.slice(0, 40)}…`,
    )
  }
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

export const showcase = demos.filter(demo => demo.showcase)

const flagged = demos.filter(demo => demo.hero)
if (flagged.length !== 1) {
  throw new Error(
    `exactly one demo carries "hero": true in demos.json — got ${flagged.length}${flagged.length === 0 ? '' : ` (${flagged.map(d => d.name).join(', ')})`}`,
  )
}
export const hero = flagged[0]

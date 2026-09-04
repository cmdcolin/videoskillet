// The demo list and the reel, rendered into the places that show them.
//
// `demos.json` is the source of the looks; this writes the README's "Cool
// demos" bullets, the landing page's hero still and its gallery. `reel.mjs` is
// the source of the carousel — recordings of the app's own window — and this
// writes the stage, the tabs' slides and the captions under them. Nobody edits
// those four blocks: a demo is added by adding it to `demos.json`, recording it
// with `demoreel.mjs`, and running this; a carousel slide by adding it to
// `reel.mjs`, recording it with `appreel.mjs`, and running this.
//
// Run: pnpm demos, or `--check` to fail when a checked-in copy is stale, which
// is what `pnpm build` runs. See `demos.mjs` for what a demo is, and `reel.mjs`
// for what a slide is.
import { demos, hero } from './demos.mjs'
import { FRAME, NARROW, slides } from './reel.mjs'

import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join } from 'node:path'

const README = 'README.md'
const LANDING = 'index.html'

const fillBlock = (path, text, name, body) => {
  const open = `<!-- generated:${name} -->`
  const close = `<!-- /generated:${name} -->`
  const from = text.indexOf(open)
  const to = text.indexOf(close)
  if (from === -1 || to === -1) {
    throw new Error(`no generated:${name} block in ${path}`)
  }
  return `${text.slice(0, from + open.length)}\n${body}\n${text.slice(to)}`
}

const readmeBlock = demos
  .map(demo => `- ${demo.name}\n  ${demo.url}`)
  .join('\n\n')

// Escaped, because a packed look is full of `&` and this is going into an
// attribute. The still is an <img> under the clip rather than the <video>'s own
// `poster`, so that it can carry `loading="lazy"` — a poster is fetched the
// moment its <video> is laid out, and twelve of those were most of a megabyte
// nobody had scrolled to yet.
const card = demo => `<li>
  <a class="demo" href="${demo.href.replaceAll('&', '&amp;')}">
    <span class="shot">
      <img
        class="still"
        src="${demo.poster}"
        alt=""
        width="640"
        height="512"
        loading="lazy"
        decoding="async"
      />
      <video
        data-src="${demo.clip}"
        muted
        loop
        playsinline
        preload="none"
        aria-hidden="true"
      ></video>
    </span>
    <span class="name">${demo.name}<span class="open">open →</span></span>
  </a>
</li>`

// The picture behind the title. A still rather than the clip this used to be:
// it played at 55% opacity under a scrim that closes to the page colour, so a
// fifth of it reached the screen anyway, and a header that moves under a reader
// is a distraction from the words in front of it. The moving account of the
// program is the stage below, where it can be looked at.
//
// The gallery card's own still, at 8K, which is the whole cost of the header
// now — against the 149K of poster and clip it replaces. Upscaled hard by
// `object-fit: cover`, and that is the treatment rather than a fault in it:
// `ogimage.mjs` grounds the link preview in the same file the same way, and
// what the upscale buys is a soft field for display type to sit on.
//
// `alt=""` because it is a backdrop. What it is a picture of is on the card
// for the same look further down the page, with its name under it.
const heroBlock = `<img
  class="heroShot"
  src="${hero.poster}"
  alt=""
  width="640"
  height="512"
  fetchpriority="high"
/>`

// The carousel: the stage, the bar under it and the captions under that, all
// three from the same list. The tabs are the one part not written here — the
// page builds them from whatever slides the stage ends up holding, so a slide
// arrives with its own way in, and they are the only control on the stage now
// that it plays on its own.
//
// `alt` is real prose rather than the gallery's `alt=""`, because these stills
// are not decoration standing in for a clip of the same thing: they are the
// only account of what the window looks like that reaches a reader who cannot
// see it, or who asked for no motion.
//
// Only the first slide's still is fetched by the markup. `loading="lazy"` does
// not defer the other two — the stage is near enough to the fold that the
// browser loads them anyway — and at 106K and 89K they were most of what the
// page spent before anybody had touched a tab. So they arrive the way the clips
// do, on a `data-src` the page sets when their slide is the one showing. Which
// is also why that attribute is page-relative: vite rewrites `src`, and has
// never heard of a data attribute.
//
// `data-secs` is how long the slide's own recording runs, summed off its
// timeline rather than measured off the file — the page advances on it, and a
// stage on a fixed clock cuts a drag off halfway. The portrait take can be a
// beat longer (it scrolls to what the wide one can already see), so it carries
// its own.
//
// Every slide is recorded twice, and the *first* one is where the breakpoint
// between the two is written into the page: the browser picks its still through
// `<source media>`, the stage takes its shape from whichever it picked, and the
// script reads that same media string back off the element to pick the clips.
// One declaration, three things that have to agree.
const slide = (
  s,
  first,
) => `<figure class="slide${first ? ' on' : ''}" data-name="${s.name}" data-secs="${s.secs}" data-secs-narrow="${s.narrowSecs}">
  ${
    first
      ? `<picture>
    <source
      media="${NARROW.at}"
      srcset="${s.narrowPoster}"
      width="${NARROW.out.width}"
      height="${NARROW.out.height}"
    />
    <img
      class="still"
      src="${s.poster}"
      alt="${s.alt.replaceAll('"', '&quot;')}"
      width="${FRAME.out.width}"
      height="${FRAME.out.height}"
      decoding="async"
    />
  </picture>`
      : `<img
    class="still"
    data-src="${s.still}"
    data-src-narrow="${s.narrowStill}"
    alt="${s.alt.replaceAll('"', '&quot;')}"
    width="${FRAME.out.width}"
    height="${FRAME.out.height}"
    decoding="async"
  />`
  }
  <video
    data-src="${s.clip}"
    data-src-narrow="${s.narrowClip}"
    muted
    loop
    playsinline
    preload="none"
    aria-hidden="true"
  ></video>
</figure>`

const carouselBlock = `<div class="stage">
${slides.map((s, i) => slide(s, i === 0)).join('\n')}
</div>
<div class="slideBar">
  <div class="slideTabs" role="group" aria-label="what the stage shows"></div>
</div>
<div class="slideNotes">
${slides
  .map((s, i) => `<p class="slideNote${i === 0 ? ' on' : ''}">${s.caption}</p>`)
  .join('\n')}
</div>`

const landing = [
  ['hero', heroBlock],
  ['carousel', carouselBlock],
  ['gallery', demos.map(card).join('\n')],
].reduce(
  (text, [name, body]) => fillBlock(LANDING, text, name, body),
  readFileSync(LANDING, 'utf8'),
)

// Formatted here rather than left to `pnpm format`, and that is the difference
// between a check that holds and one that cries wolf: oxfmt reflows both of
// these files, so a file this script emitted and a file oxfmt has since touched
// are not the same bytes, and --check would report every clean tree as stale.
// Emitting what the formatter would have produced anyway settles it in one
// place — which is also why the blocks above are written at whatever indent
// reads well here and left for oxfmt to set.
//
// Resolved through node rather than spelled as `node_modules/.bin/oxfmt`, which
// is only there in a full checkout: a `git worktree` copy has no node_modules of
// its own, and node's own lookup walks up into the one it shares.
const require = createRequire(import.meta.url)
const oxfmtPkg = require.resolve('oxfmt/package.json')
const OXFMT = join(dirname(oxfmtPkg), require(oxfmtPkg).bin.oxfmt)

const format = (path, text) => {
  const scratch = `.demogen-scratch${extname(path)}`
  writeFileSync(scratch, text)
  try {
    execFileSync(OXFMT, [scratch], { stdio: 'ignore' })
    return readFileSync(scratch, 'utf8')
  } finally {
    rmSync(scratch, { force: true })
  }
}

const pages = [
  {
    path: README,
    text: format(
      README,
      fillBlock(README, readFileSync(README, 'utf8'), 'demos', readmeBlock),
    ),
  },
  { path: LANDING, text: format(LANDING, landing) },
]

if (process.argv.includes('--check')) {
  const stale = pages.filter(
    page => readFileSync(page.path, 'utf8') !== page.text,
  )
  if (stale.length > 0) {
    console.error(
      `stale — run \`pnpm demos\`: ${stale.map(page => page.path).join(', ')}`,
    )
    process.exit(1)
  }
  console.log(`current: ${pages.map(page => page.path).join(', ')}`)
} else {
  for (const page of pages) {
    writeFileSync(page.path, page.text)
  }
  console.log(`${demos.length} demos, ${slides.length} slides in the carousel`)
}

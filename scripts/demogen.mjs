// The demo list, rendered into the two places that show it.
//
// `demos.json` is the source; this writes the README's "Cool demos" bullets,
// the landing page's hero reel and the landing page's gallery. Nobody edits
// those three blocks — a demo is added by adding it to `demos.json`, recording
// it with `demoreel.mjs`, and running this.
//
// Run: pnpm demos, or `--check` to fail when a checked-in copy is stale, which
// is what `pnpm build` runs. See `demos.mjs` for what a demo is.
import { demos, reel } from './demos.mjs'

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

// Two layers, and only the first one carries a look: it is what a reader sees
// before a line of script runs, and the still is the whole of it — no `src` and
// no `autoplay`, so a reader who asked for reduced motion is never sent a clip
// they did not ask to see.
const heroBlock = `<video
  class="heroVid on"
  data-clip="${reel[0].clip}"
  poster="${reel[0].poster}"
  muted
  loop
  playsinline
  preload="none"
  aria-hidden="true"
  tabindex="-1"
></video>
<video
  class="heroVid"
  muted
  loop
  playsinline
  preload="none"
  aria-hidden="true"
  tabindex="-1"
></video>`

// The dots are the roster: nothing else on the page lists what the reel plays,
// which is the point — the control and the list it scrubs are one thing.
const reelBlock = `<p class="reelName">${reel[0].name}</p>
<div class="reelDots">
${reel
  .map(
    demo => `  <button
    class="dot"
    type="button"
    data-clip="${demo.clip}"
    data-still="${demo.still}"
    data-name="${demo.name}"
    aria-label="Show ${demo.name}"
  ></button>`,
  )
  .join('\n')}
</div>`

const landing = [
  ['hero', heroBlock],
  ['reel', reelBlock],
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
  console.log(`${demos.length} demos, ${reel.length} in the reel`)
}

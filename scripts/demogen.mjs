// The demo list, rendered into the README's "Cool demos" bullets.
//
// `demos.json` is the source of the looks. The landing page reads it directly
// now — `site/components/Gallery.astro` and `Hero.astro` map over the same
// list, and `Carousel.astro` over `reel.mjs` — so the three blocks this used to
// write into `index.html` are gone, and with them the question of whether the
// checked-in copy was current. What is left is the README, which is markdown in
// a repo rather than a page a component can render.
//
// A demo is added by adding it to `demos.json`, recording it with
// `demoreel.mjs`, and running this.
//
// Run: pnpm demos, or `--check` to fail when the checked-in copy is stale, which
// is what `pnpm build` runs. See `demos.mjs` for what a demo is.
import { demos } from './demos.mjs'

import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join } from 'node:path'

const README = 'README.md'

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

// Formatted here rather than left to `pnpm format`, and that is the difference
// between a check that holds and one that cries wolf: oxfmt reflows this file,
// so a file this script emitted and a file oxfmt has since touched are not the
// same bytes, and --check would report every clean tree as stale. Emitting what
// the formatter would have produced anyway settles it in one place.
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

const text = format(
  README,
  fillBlock(README, readFileSync(README, 'utf8'), 'demos', readmeBlock),
)

if (process.argv.includes('--check')) {
  if (readFileSync(README, 'utf8') === text) {
    console.log(`current: ${README}`)
  } else {
    console.error(`stale — run \`pnpm demos\`: ${README}`)
    process.exit(1)
  }
} else {
  writeFileSync(README, text)
  console.log(`${demos.length} demos in ${README}`)
}

// Layout check for the docs site: load every built guide page at a desktop and
// a phone width, screenshot it, and fail if anything but a deliberate scroll
// container is wider than the viewport.
//
// Usage: node scripts/guidecheck.mjs [distDir] [outDir]
//   distDir defaults to dist — run `pnpm guide` first.
//   outDir defaults to /tmp/guidecheck.
//
// Served over http rather than opened over file://, because every link and
// figure in the guide is site-absolute: a page opened off the filesystem looks
// for `/guide/img/…` at the root of it and measures a page with no diagrams in
// it.
//
// The phone arm is the one worth running. The desktop layout has slack in it;
// 390px does not, and the things that break there — a nav row that wraps three
// deep, a two-column table crushed to two words a line — are invisible on a
// laptop.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { serveDist } from './static.mjs'

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [distArg = 'dist', outArg = '/tmp/guidecheck'] = process.argv.slice(2)
const root = resolve(distArg)
const dir = join(root, 'guide')
const out = resolve(outArg)
const PORT = 8098
mkdirSync(out, { recursive: true })

// Whatever the builder emitted, so a page added to the guide is covered here
// without being named twice. Each one is a directory with an index in it, apart
// from the guide's own front page, which is the directory they all sit in.
const pages = [
  { name: 'index', path: '/guide/' },
  ...readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() && existsSync(join(dir, e.name, 'index.html')))
    .map(e => ({ name: e.name, path: `/guide/${e.name}/` })),
]

const WIDTHS = [
  { name: 'desktop', width: 1352, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]

const server = await serveDist(root, PORT)
const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: true,
})
const page = await browser.newPage()
let bad = 0
for (const vp of WIDTHS) {
  await page.setViewport({ width: vp.width, height: vp.height })
  for (const p of pages) {
    await page.goto(`http://localhost:${PORT}${p.path}`, { waitUntil: 'load' })
    await new Promise(r => setTimeout(r, 250))
    const m = await page.evaluate(() => {
      const de = document.documentElement
      // Content wider than the viewport is fine inside something that scrolls
      // on purpose — a table wrapper, a code block, the nav row. Anywhere else
      // it is the page itself overflowing, which is the thing worth failing on.
      const scroller = el => el.closest('.tablewrap, pre, .pages, .toc')
      const over = [...document.querySelectorAll('body *')]
        .filter(
          el =>
            scroller(el) === null &&
            el.getBoundingClientRect().right > innerWidth + 1,
        )
        .map(el => `${el.tagName.toLowerCase()}.${el.className || '-'}`)
      const wraps = [...document.querySelectorAll('.tablewrap')]
      return {
        scrollW: de.scrollWidth,
        clientW: de.clientWidth,
        docH: de.scrollHeight,
        over: [...new Set(over)].slice(0, 6),
        wraps: wraps.length,
        // leaky: escaping the viewport rather than clipping, which defeats the
        // point of the wrapper. scrolling: has more to show, as intended.
        leaky: wraps.filter(
          w => w.getBoundingClientRect().right > innerWidth + 1,
        ).length,
        scrolling: wraps.filter(w => w.scrollWidth > w.clientWidth + 1).length,
      }
    })
    const overflow =
      m.scrollW > m.clientW + 1 || m.over.length > 0 || m.leaky > 0
    if (overflow) bad++
    console.log(
      `${overflow ? 'OVERFLOW' : '   ok   '} ${vp.name.padEnd(7)} ${p.name.padEnd(17)} ` +
        `scrollW=${m.scrollW} clientW=${m.clientW} h=${m.docH} ` +
        `tables=${m.scrolling}/${m.wraps} scrolling` +
        (m.leaky > 0 ? ` LEAKY=${m.leaky}` : '') +
        (m.over.length > 0 ? ` :: ${m.over.join(', ')}` : ''),
    )
    await page.screenshot({ path: `${out}/${vp.name}-${p.name}.png` })
  }
}
await browser.close()
server.close()
console.log(
  bad === 0
    ? `\nno horizontal overflow — shots in ${out}`
    : `\n${bad} page/width pair(s) overflow — shots in ${out}`,
)
process.exit(bad === 0 ? 0 : 1)

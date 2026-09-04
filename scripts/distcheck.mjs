import puppeteer from 'puppeteer-core'

// Loads every page of a built `dist/` in a browser and fails on a 404, a
// console error or a broken image.
//
// Everything else about a build is checked by looking at files: `pnpm build`
// proves the pages were emitted, the tests prove the data reached them, and
// `guidecheck.mjs` proves the guide does not overflow. None of that opens a
// page and watches what it asks the network for — which is how the fatal
// screen postered its clip with `demos/wonkitize-me.jpg`, a file that had never
// existed, and said nothing about it anywhere except a 404 in a log nobody was
// reading.
//
// Static server rather than `pnpm preview`, because what is being checked is
// the directory the deploy uploads: a page that only works because a dev server
// rewrote something for it is a page that is broken on Pages.
//
// Run: node scripts/distcheck.mjs [dir]  (default dist)
import { FIREFOX } from './browser.mjs'

import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'

const root = process.argv[2] ?? 'dist'
const PORT = 8099

// Only what the site actually serves. An extension missing here arrives as
// application/octet-stream, which a browser declines rather than renders — so a
// new asset type is a line in this table, not a mystery.
const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
}

const PAGES = ['/', '/guide/', '/guide/faq.html', '/app/', '/vote/', '/stream/']

if (!existsSync(join(root, 'index.html'))) {
  console.error(`no ${root}/index.html — run \`pnpm build\` first`)
  process.exit(1)
}

const server = createServer((req, res) => {
  const asked = new URL(req.url ?? '/', 'http://dist')
  let file = join(root, decodeURIComponent(asked.pathname))
  if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, 'index.html')
  }
  if (existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    })
    res.end(readFileSync(file))
  } else {
    res.writeHead(404)
    res.end(`no ${asked.pathname} in ${root}`)
  }
})
await new Promise(resolve => server.listen(PORT, resolve))

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: true,
})

let bad = 0
for (const path of PAGES) {
  const page = await browser.newPage()
  const errors = []
  const missing = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 200))
  })
  page.on('pageerror', err =>
    errors.push(`pageerror: ${String(err).slice(0, 200)}`),
  )
  page.on('response', res => {
    if (res.status() >= 400) {
      missing.push(
        `${res.status()} ${res.url().replace(`http://localhost:${PORT}`, '')}`,
      )
    }
  })
  await page.goto(`http://localhost:${PORT}${path}`, {
    waitUntil: 'load',
    timeout: 30000,
  })
  // The stage and the gallery fetch on scroll-into-view and on a timer, so a
  // page that has merely loaded has not yet asked for everything it will.
  await new Promise(resolve => setTimeout(resolve, 2500))
  const seen = await page.evaluate(() => ({
    broken: [...document.images].filter(
      img => img.currentSrc !== '' && img.naturalWidth === 0,
    ).length,
    background: getComputedStyle(document.body).backgroundColor,
    images: [...document.images].filter(img => img.currentSrc !== '').length,
  }))
  const ok = errors.length === 0 && missing.length === 0 && seen.broken === 0
  if (!ok) bad++
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'} ${path.padEnd(17)} images=${seen.images} broken=${seen.broken} bg=${seen.background}`,
  )
  for (const line of missing.slice(0, 6))
    console.log(`         missing: ${line}`)
  for (const line of errors.slice(0, 6))
    console.log(`         console: ${line}`)
  await page.close()
}

await browser.close()
server.close()

// The app itself opens on its "cannot run" screen here — headless Firefox has no
// WebGPU — and that is a page like any other: it has a video, a poster and a
// link, and all three have to resolve. What this cannot check is the instrument
// behind it; that is what the harnesses in sweep.mjs are for.
console.log(
  bad === 0
    ? `\nevery page in ${root} loads clean`
    : `\n${bad} page(s) with problems in ${root}`,
)
process.exit(bad === 0 ? 0 : 1)

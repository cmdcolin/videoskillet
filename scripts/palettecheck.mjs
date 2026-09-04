// Verification harness: the palette sets a control from a typed value.
//
// ⌘K, type "head switch 9", ↵ — and the check is the address bar, since
// useUrlState mirrors the live board into it. What this is really covering is
// the reading in ui/paletteQuery.ts against the actual control table, which the
// unit tests can only do one slider at a time.
//
// Usage: node scripts/palettecheck.mjs [url]

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'

// The app, seeded with a named param. useUrlState mirrors the board back in
// whichever form the link arrived in (ui/urlParams.ts § writeSessionParams), so
// a session that starts with ?set= keeps writing ?set= — and the check reads the
// address bar instead of unpacking ?p= by hand.
const base = process.argv[2] ?? 'http://localhost:5173/app/'
const url = `${base}${base.includes('?') ? '&' : '?'}set=noiseIre:1`

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
    'media.navigator.streams.fake': true,
    'media.navigator.permission.disabled': true,
  },
})
const page = await browser.newPage()
await page.setViewport({ width: 1352, height: 900 })
let failure = ''
page.on('pageerror', err => {
  failure ||= `pageerror: ${String(err).slice(0, 200)}`
})
await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 6000))

const palette = async query => {
  await page.keyboard.down('Control')
  await page.keyboard.press('k')
  await page.keyboard.up('Control')
  await page.waitForSelector('dialog[aria-label="command palette"]')
  await page.keyboard.type(query)
  // The list re-sorts per keystroke; let the last one land before ↵.
  await new Promise(r => setTimeout(r, 300))
  const rows = await page.$$eval(
    'dialog[aria-label="command palette"] button',
    els => els.slice(0, 3).map(e => e.textContent?.replace(/\s+/g, ' ').trim()),
  )
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 1500))
  const href = await page.evaluate(() => location.href)
  return { rows, url: href }
}

// Every case is `query` -> the param the address bar must carry afterwards.
const CASES = [
  { query: 'head switch 9', want: 'headSwitchShiftUs:9' },
  { query: 'combiner ring', want: 'synthMix:2' },
]

for (const c of CASES) {
  const got = await palette(c.query)
  const set = decodeURIComponent(new URL(got.url).searchParams.get('set') ?? '')
  const ok = set.split(',').includes(c.want)
  console.log(`${ok ? 'ok  ' : 'FAIL'} “${c.query}” -> set=${set || '(none)'}`)
  console.log(`     top row: ${got.rows[0] ?? '(no rows)'}`)
  if (!ok) failure ||= `“${c.query}” did not set ${c.want} (set=${set})`
}

await page.evaluate(() => window.vf?.destroy())
await browser.close()
if (failure) {
  console.error('FAILED:', failure)
  process.exit(1)
}
console.log('palette sets a control from a typed value')

// Verification harness: the address bar, both directions.
//
// Four things, and each one has broken in a way that looked like success from
// the outside — an app that ignores a link still shows a picture.
//
//   1. A link written before any of this (`?p=` on the query) still opens.
//   2. The bar canonicalizes: whatever a session arrived on, it comes to rest on
//      the readable form in the hash.
//   3. That form is the live look — turn a knob and it says so.
//   4. A hash pasted into a tab that is already open applies. This is the one
//      the move to `#` put at risk: a query is a new document and a hash is not,
//      so nothing but the `hashchange` handler makes it work.
//
// Usage: node scripts/linkcheck.mjs [url]

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'

const base = process.argv[2] ?? 'http://localhost:5173/app/'

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

const settle = ms => new Promise(r => setTimeout(r, ms))
const href = () => page.evaluate(() => location.href)
// The look the bar is carrying, as `key:value` entries.
const look = async () => {
  const url = new URL(await href())
  return new URLSearchParams(url.hash.replace(/^#/, '')).get('set')
}
const check = (name, ok, saw) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` — saw ${saw}`}`)
  if (!ok) failure ||= `${name} (saw ${saw})`
}

// 1 and 2: an old-form link opens, and the bar comes to rest readable.
await page.goto(`${base}?preset=vhs`, { waitUntil: 'networkidle0' })
await settle(7000)
const afterLoad = await href()
check(
  'an old ?preset= link opens and the bar moves to the hash',
  afterLoad.includes('#set=') && !afterLoad.includes('?preset='),
  afterLoad,
)
const vhs = await look()
check(
  'the readable form carries the preset it opened',
  vhs !== null && vhs.includes('lumaMHz:'),
  vhs,
)

// 3: the bar follows the board.
await page.keyboard.down('Control')
await page.keyboard.press('k')
await page.keyboard.up('Control')
await page.waitForSelector('dialog[aria-label="command palette"]')
await page.keyboard.type('head switch 9')
await settle(300)
await page.keyboard.press('Enter')
await settle(900)
const turned = await look()
check(
  'a control set from the palette reaches the bar',
  turned !== null && turned.split(',').includes('headSwitchShiftUs:9'),
  turned,
)

// 4: a hash arriving in a tab that is already open.
await page.evaluate(() => {
  location.hash = 'set=noiseIre:12&mod='
})
await settle(7000)
const pasted = await look()
check(
  'a hash pasted into an open tab applies',
  pasted !== null && pasted.split(',').includes('noiseIre:12'),
  pasted,
)
// …and the look it replaced is gone rather than merged under it.
check(
  'and replaces the look it landed on',
  pasted !== null && !pasted.includes('headSwitchShiftUs'),
  pasted,
)

await page.evaluate(() => window.vf?.destroy())
await browser.close()
if (failure) {
  console.error('FAILED:', failure)
  process.exit(1)
}
console.log('the address bar reads and writes')

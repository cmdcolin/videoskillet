// Do the panel's buttons share one height?
//
//   npx vite --port 5401 --strictPort
//   node scripts/buttonheights.mjs [url]
//
// Needs a dev server already running (see docs/DEVELOPMENT.md).
//
// The masthead, the look bar and the preset chips sit in rows beside one
// another, and each took its height from its own padding until they differed
// by five pixels. `--btn-pad-y` and `--btn-lh` in theme.css set the one box;
// this reads every outlined, filled and chip button on three screens (the
// panel, the unfolded preset catalog, the MIDI dialog) and fails when one
// measures differently. A button that is meant to differ belongs in EXEMPT.

import { launchFirefox } from './browser.mjs'

const url = process.argv[2] ?? 'http://localhost:5401/app/'
const TOLERANCE = 0.5
const CLASSES = ['_outline_', '_chromeBtn_', '_btn_', '_chip_', '_moreChip_']
const EXEMPT = []

const browser = await launchFirefox()
const page = await browser.newPage()
await page.setViewport({ width: 1352, height: 900 })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 12000))

const measure = () =>
  page.evaluate(
    (classes, exempt) =>
      [...document.querySelectorAll('button')]
        .filter(b => classes.some(c => b.className.includes(c)))
        .map(b => ({
          label: (b.textContent || b.getAttribute('aria-label') || '')
            .trim()
            .slice(0, 20),
          cls: b.className.split(' ').find(c => c.includes('_')) ?? '',
          height: Math.round(b.getBoundingClientRect().height * 10) / 10,
        }))
        .filter(b => b.height > 0 && !exempt.includes(b.label)),
    CLASSES,
    EXEMPT,
  )

const clickByText = text =>
  page.evaluate(t => {
    const b = [...document.querySelectorAll('button')].find(x =>
      new RegExp(t).test(x.textContent.trim()),
    )
    b?.click()
    return Boolean(b)
  }, text)

const screens = [
  ['panel', async () => {}],
  ['catalog', () => clickByText('^\\+ \\d+ more')],
  ['midi', () => clickByText('^midi')],
]

const all = []
for (const [name, open] of screens) {
  await open()
  await new Promise(r => setTimeout(r, 1500))
  for (const b of await measure()) all.push({ screen: name, ...b })
}

const heights = all.map(b => b.height).sort((a, b) => a - b)
const median = heights[Math.floor(heights.length / 2)]
const outliers = all.filter(b => Math.abs(b.height - median) > TOLERANCE)
console.log(`${all.length} buttons, median ${median}px`)
console.table(outliers)
await browser.close()
process.exit(outliers.length ? 1 : 0)

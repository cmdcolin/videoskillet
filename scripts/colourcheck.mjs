// Does a patch make colour, and how much? The question docs/CURATION.md keeps
// having to answer by eye — its "ring modulation does not make rainbows"
// section is six candidates built on a guess about where a product lands — and
// the one a contact sheet is bad at, because a saturated source hides colour
// that was manufactured and a still frame hides colour that is turning.
//
//   node scripts/colourcheck.mjs [url] [outDir] [--src=clip-haunted-house]
//   node scripts/colourcheck.mjs --arms=cfbRing:1,cfbRingSrc:1
//
// Pick the source to suit the claim. A monochrome one settles the strong form
// of the question outright: `clip-haunted-house` is a 1929 film, so any hue on
// screen was made by the chain and `sat` on a clean arm reads 0.018. Against
// `clip-test` (colour bars at 0.487) the same patch cannot show a gain, and a
// harness that only ever ran there would call a colour mechanism inert.
//
// Four numbers per arm, off a 256x192 downscale of the canvas:
//
//   sat      mean (max-min)/max per pixel. How saturated the frame is.
//   hues     how many of twelve hue sectors hold at least 2% of the coloured
//            pixels. One hue everywhere and a whole wheel both score high on
//            sat and are not the same look — a carrier on frequency lands on
//            one phase (3 sectors), detuned it spreads (8, then 12).
//   colour%  share of pixels saturated enough to have a hue at all.
//   luma     mean level, which is what catches an arm that "made colour" by
//            going black. That is not hypothetical: the loop's chroma-only
//            return was a dead frame at luma 0.007 until it got a recombiner.
//
// One page load drives every arm through `window.vf.applyControls`, so a sheet
// of ten costs one WebGPU session rather than ten. Every key any arm sets is
// zeroed between arms, so an arm never measures the one before it.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const flag = name => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const positional = args.filter(a => !a.startsWith('--'))
const url = positional[0] ?? 'http://localhost:5199/'
const outDir = positional[1] ?? 'colourcheck'
const src = flag('src') ?? 'clip-haunted-house'

// A patch as `key:value,key:value`, the same spelling `?set=` takes.
const parse = s =>
  Object.fromEntries(
    s
      .split(',')
      .filter(Boolean)
      .map(kv => {
        const [k, v] = kv.split(':')
        return [k, Number(v)]
      }),
  )

// The shipped sheet: a loop with one thing changed per arm. `--arms=` replaces
// it with a single patch of your own.
const custom = flag('arms')
const LOOP = {
  cfbMix: 0.85,
  cfbGain: 1.02,
  cfbDelayUs: 0.9,
  cfbLines: 2,
  chromaGain: 1.6,
}
const ARMS =
  custom === undefined
    ? [
        ['clean', {}, {}],
        ['loop, no ring', LOOP, {}],
        ['ring on program', LOOP, { cfbRing: 1 }],
        ['ring on oscillator', LOOP, { cfbRing: 1, cfbRingSrc: 1 }],
        [
          'oscillator +12kHz',
          LOOP,
          { cfbRing: 1, cfbRingSrc: 1, cfbCarrierKHz: 12 },
        ],
        [
          'oscillator +120kHz',
          LOOP,
          { cfbRing: 1, cfbRingSrc: 1, cfbCarrierKHz: 120 },
        ],
        ['return: chroma', LOOP, { cfbReturn: 1 }],
        ['return: luma', LOOP, { cfbReturn: 2 }],
        ['read clock +0.3%', LOOP, { cfbClockPct: 0.3 }],
      ]
    : [
        ['clean', {}, {}],
        ['patch', {}, parse(custom)],
      ]

// Every key any arm above sets, at its stock value. An arm is a fresh board
// plus its own patch, never the last arm plus a difference.
const STOCK = {
  cfbMix: 0,
  cfbGain: 1,
  cfbDelayUs: 0.15,
  cfbLines: 0,
  cfbRing: 0,
  cfbRingSrc: 0,
  cfbCarrierKHz: 0,
  cfbReturn: 0,
  cfbClockPct: 0,
  chromaGain: 1,
  aGain: 1,
  bGain: 0,
  bRing: 0,
  busClip: 0,
  bDetuneHz: 0,
  synthOver: 0,
  synthFm: 0,
  synthFmSrc: 0,
  fbMix: 0,
}

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
let failure = ''
page.on('pageerror', err => {
  failure ||= String(err).slice(0, 200)
  console.log('[pageerror]', String(err).slice(0, 300))
})
// A moving picture: a loop fed a frozen frame converges and reports as doing
// nothing, which is the opposite of what it does on live video.
await page.goto(`${url}?src=${src}&srcb=none`, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 8000))

const measure = (board, patch) =>
  page.evaluate(
    async (board, patch) => {
      window.vf.applyControls({ ...board, ...patch })
      // Long enough for a loop to reach whatever it reaches: the ones worth
      // measuring are still developing after a second.
      for (let i = 0; i < 150; i++) {
        window.vf.step()
        if (i % 15 === 0) await new Promise(r => setTimeout(r, 12))
      }
      const cv = document.querySelector('canvas')
      const oc = new OffscreenCanvas(256, 192)
      const g = oc.getContext('2d')
      g.drawImage(cv, 0, 0, 256, 192)
      const d = g.getImageData(0, 0, 256, 192).data
      const sect = new Array(12).fill(0)
      let sat = 0
      let lum = 0
      let coloured = 0
      const n = 256 * 192
      for (let i = 0; i < n; i++) {
        const r = d[i * 4] / 255
        const gr = d[i * 4 + 1] / 255
        const b = d[i * 4 + 2] / 255
        const mx = Math.max(r, gr, b)
        const mn = Math.min(r, gr, b)
        const s = mx > 0.02 ? (mx - mn) / mx : 0
        sat += s
        lum += 0.299 * r + 0.587 * gr + 0.114 * b
        // A demodulator handed an unsaturated sample reports an essentially
        // arbitrary phase, so a hue is only counted where there is one.
        if (s > 0.25 && mx > 0.06) {
          let h = 0
          if (mx === mn) h = 0
          else if (mx === r) h = ((gr - b) / (mx - mn) + 6) % 6
          else if (mx === gr) h = (b - r) / (mx - mn) + 2
          else h = (r - gr) / (mx - mn) + 4
          sect[Math.min(11, Math.floor((h / 6) * 12))]++
          coloured++
        }
      }
      return {
        sat: sat / n,
        lum: lum / n,
        frac: coloured / n,
        hues:
          coloured > n * 0.01
            ? sect.filter(c => c > coloured * 0.02).length
            : 0,
      }
    },
    board,
    patch,
  )

mkdirSync(outDir, { recursive: true })
console.log(`source: ${src}\n`)
console.log('arm                       sat    hues   colour%    luma')
const rows = []
for (const [name, board, patch] of ARMS) {
  const s = await measure({ ...STOCK, ...board }, patch)
  rows.push([name, s])
  console.log(
    `${name.padEnd(22)} ${s.sat.toFixed(3).padStart(7)} ${String(s.hues).padStart(6)} ${(100 * s.frac).toFixed(1).padStart(9)} ${s.lum.toFixed(3).padStart(7)}`,
  )
  await page.screenshot({
    path: join(outDir, `${name.replace(/[^a-z0-9]+/gi, '-')}.png`),
  })
}
writeFileSync(join(outDir, 'rows.json'), JSON.stringify(rows, null, 2))
// Stop the render loop before teardown; otherwise close() SIGKILLs Firefox's
// GPU process mid-frame and drops a minidump into the throwaway profile.
await page.evaluate(() => window.vf?.destroy())
await browser.close()
if (failure !== '') {
  console.error(`page error during run: ${failure}`)
  process.exit(1)
}

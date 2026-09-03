// Does a patch make colour, and how much? The question docs/CURATION.md keeps
// having to answer by eye — its "ring modulation does not make rainbows"
// section is six candidates built on a guess about where a product lands — and
// the one a contact sheet is bad at, because a saturated source hides colour
// that was manufactured and a still frame hides colour that is turning.
//
//   node scripts/colourcheck.mjs [url] [outDir] [--src=] [--srcb=]
//   node scripts/colourcheck.mjs --arms=cfbRing:1,cfbRingSrc:1
//   node scripts/colourcheck.mjs --arms-file=sheet.json
//
// `--arms-file=` is how to run a sheet of your own without editing this file:
// a JSON array of [name, board, patch] triples, board and patch both plain
// control objects. Worth knowing because this repo is worked in by more than
// one agent at a time and an uncommitted edit here does not reliably survive
// somebody else's commit — keep the sheet in a scratch directory instead.
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
//   fringe   mean colour difference between neighbouring pixels, in an opponent
//            space, x1000. Two patches can hold the same `sat` and look nothing
//            alike: cross-colour on detail puts its colour on edges and scores
//            high here, while a narrow chroma band pools the same energy into
//            large soft fields and scores low. Read it as "splashes or
//            speckle" — it is the column to watch when the ask is big flat
//            colour rather than rainbow edging. It measures edge *contrast*
//            and not edge count, so read it beside the screenshot: a
//            posterizer with a handful of enormous hard-edged fields scores
//            like speckle and looks nothing like it. Low fringe proves
//            flatness; high fringe does not prove fringing — read `edge%`
//            beside it, which is the same question asked as a count.
//   edge%    share of pixels sitting on a colour boundary at all. This is the
//            column that separates four enormous fields from confetti, because
//            a few huge regions cross very few pixels however hard their edges
//            are. Flat colour is high `sat` with low `edge%`.
//   motion   mean channel difference over four frames, 0-255. A still picture
//            reads zero; a loop still developing, or an LFO turning a palette,
//            does not. Everything else here is one frame, and a one-frame sheet
//            calls an evolving look and a frozen one the same thing.
//
// One page load drives every arm through `window.vf.applyControls`, so a sheet
// of ten costs one WebGPU session rather than ten. Every key any arm sets is
// zeroed between arms, so an arm never measures the one before it.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const flag = name => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const positional = args.filter(a => !a.startsWith('--'))
const url = positional[0] ?? 'http://localhost:5199/app/'
const outDir = positional[1] ?? 'colourcheck'
const src = flag('src') ?? 'clip-haunted-house'
const srcb = flag('srcb') ?? 'none'

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
const sheet = flag('arms-file')
const fromFile =
  sheet === undefined
    ? undefined
    : JSON.parse(readFileSync(sheet, 'utf8')).map(([n, b, p]) => [
        n,
        b ?? {},
        p ?? {},
      ])
const LOOP = {
  cfbMix: 0.85,
  cfbGain: 1.02,
  cfbDelayUs: 0.9,
  cfbLines: 2,
  chromaGain: 1.6,
}
// The default sheet is the one docs/CURATION.md's ring-modulation section
// carries: what the loop's multiplier does against the program, against its
// own oscillator, and detuned. Run it on the monochrome default source and the
// first three rows are that section's claim reproduced.
const DEFAULT_ARMS = [
  ['clean', {}, {}],
  ['loop, no ring', LOOP, {}],
  ['ring on program', LOOP, { cfbRing: 1 }],
  ['ring on oscillator', LOOP, { cfbRing: 1, cfbRingSrc: 1 }],
  ['oscillator +12kHz', LOOP, { cfbRing: 1, cfbRingSrc: 1, cfbCarrierKHz: 12 }],
  [
    'oscillator +120kHz',
    LOOP,
    { cfbRing: 1, cfbRingSrc: 1, cfbCarrierKHz: 120 },
  ],
  ['return: chroma', LOOP, { cfbReturn: 1 }],
  ['return: luma', LOOP, { cfbReturn: 2 }],
  ['read clock +0.3%', LOOP, { cfbClockPct: 0.3 }],
]
const ARMS =
  fromFile ??
  (custom === undefined
    ? DEFAULT_ARMS
    : [
        ['clean', {}, {}],
        ['patch', {}, parse(custom)],
      ])

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
  demodMHz: 0.6,
  combMode: 0,
  chromaTail: 0,
  accLagLines: 0,
  matrixClip: 0,
  crtSat: 1,
  crtSpot: 0.6,
  crtBloom: 0.2,
  colorUnderMix: 0,
  chromaNoiseIre: 0,
  synthOver: 0,
  synthAHz: 15834,
  synthBHz: 60,
  synthMix: 0,
  demodAxisDeg: 90,
  phosphor: 0,
  phosphorBleed: 0.15,
  phosphorSkew: 0,
  crtPurity: 0,
  crtPuritySize: 0.3,
  crtPurityX: 0.3,
  crtPurityY: 0.35,
  chromaTail: 0,
  vir: 0,
  virLag: 45,
  diffGain: 0,
  diffPhaseDeg: 0,
  dubGens: 1,
  synthHueDeg: 0,
  synthColorSrc: 0,
  synthColorMode: 0,
  capLumaMHz: 0,
  bGenlock: 0,
  bKey: 0,
  bKeyFill: 0,
  bKeyAcceptDeg: 0,
  bKeyHueDeg: 241,
  bKeySoft: 0.08,
  bKeyClip: 0.06,
  bKeyMatteY: 0.5,
  bKeyMatteSat: 0.3,
  bKeyMatteHueDeg: 0,
  synthShape: 2,
  synthColor: 0,
  synthLevel: 1,
  synthFm: 0,
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
await page.goto(`${url}?src=${src}&srcb=${srcb}`, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 8000))

const measure = (board, patch) =>
  page.evaluate(
    async (board, patch) => {
      const grab = () => {
        const cv = document.querySelector('canvas')
        const oc = new OffscreenCanvas(256, 192)
        const g = oc.getContext('2d')
        g.drawImage(cv, 0, 0, 256, 192)
        return g.getImageData(0, 0, 256, 192).data
      }
      const run = async n => {
        for (let i = 0; i < n; i++) {
          window.vf.step()
          if (i % 15 === 0) await new Promise(r => setTimeout(r, 12))
        }
      }
      window.vf.applyControls({ ...board, ...patch })
      // Long enough for a loop to reach whatever it reaches: the ones worth
      // measuring are still developing after a second.
      await run(150)
      const d = grab()
      // Four more frames, then a second look. Adjacent frames would report a
      // slow sweep as motionless; four is short enough that a still picture
      // still reads zero.
      await run(4)
      const e = grab()
      const sect = new Array(12).fill(0)
      let sat = 0
      let lum = 0
      let coloured = 0
      let fringe = 0
      let edges = 0
      let motion = 0
      const n = 256 * 192
      // Opponent axes, so a brightness edge with no colour change costs
      // nothing here and only a *colour* edge scores.
      const opp = i => [d[i * 4] - d[i * 4 + 1], d[i * 4 + 1] - d[i * 4 + 2]]
      for (let i = 0; i < n; i++) {
        const r = d[i * 4] / 255
        const gr = d[i * 4 + 1] / 255
        const b = d[i * 4 + 2] / 255
        const mx = Math.max(r, gr, b)
        const mn = Math.min(r, gr, b)
        const s = mx > 0.02 ? (mx - mn) / mx : 0
        sat += s
        lum += 0.299 * r + 0.587 * gr + 0.114 * b
        motion +=
          (Math.abs(d[i * 4] - e[i * 4]) +
            Math.abs(d[i * 4 + 1] - e[i * 4 + 1]) +
            Math.abs(d[i * 4 + 2] - e[i * 4 + 2])) /
          3
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
        if (i % 256 !== 255) {
          const [a0, b0] = opp(i)
          const [a1, b1] = opp(i + 1)
          const step = (Math.abs(a1 - a0) + Math.abs(b1 - b0)) / 2
          fringe += step
          // How many pixels sit on a colour boundary at all, as against how
          // hard those boundaries are. Four enormous fields cross a handful of
          // pixels; speckle crosses most of them.
          if (step > 24) edges++
        }
      }
      return {
        sat: sat / n,
        lum: lum / n,
        frac: coloured / n,
        fringe: (1000 * fringe) / (255 * n),
        edges: edges / n,
        motion: motion / n,
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
console.log(
  'arm                       sat    hues   colour%    luma   fringe    edge%  motion',
)
const rows = []
for (const [name, board, patch] of ARMS) {
  const s = await measure({ ...STOCK, ...board }, patch)
  rows.push([name, s])
  console.log(
    `${name.padEnd(22)} ${s.sat.toFixed(3).padStart(7)} ${String(s.hues).padStart(6)} ${(100 * s.frac).toFixed(1).padStart(9)} ${s.lum.toFixed(3).padStart(7)} ${s.fringe.toFixed(1).padStart(8)} ${(100 * s.edges).toFixed(1).padStart(8)} ${s.motion.toFixed(2).padStart(7)}`,
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

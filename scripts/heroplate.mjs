#!/usr/bin/env node
import puppeteer from 'puppeteer-core'
import { createServer as createVite } from 'vite'

import { CHROME, FIREFOX } from './browser.mjs'

// Renders the landing page's headline as a title card that has been through the
// program: the words are set in the site's own typeface, photographed to a
// plate, and handed to the app as a source picture, so the fringing on the
// stems and the sync furniture at the edges are the signal path acting on real
// letterforms rather than a filter drawn over them.
//
//   node scripts/heroplate.mjs        # public/hero-title.webp, -narrow.webp
//   node scripts/heroplate.mjs --check
//
// Two renders because an image cannot rewrap. Both break the headline in the
// same two lines — the type is what changes: the narrow one is set small enough
// that a portrait header, which crops a picture at the sides, still has the
// whole of both lines inside it.
//
// Needs Firefox Nightly (WebGPU), Chrome (the plate) and ImageMagick's `magick`.
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The look, as the app's own query string writes it. `vhs` underneath for the
// tape the words arrive on; the rest is layered on top by hand.
//
// Nothing here displaces geometry. The stock feedback presets all carry a
// shiftX or a rotate, and on text those spiral the words into an unreadable
// smear within a few laps, so what is below is signal-domain only.
const PRESET = 'vhs'
const SET = [
  // The words have to stay words. `vhs` alone takes the luma to 2.8 MHz and
  // 150 ns of jitter, which on a photograph is tape and on a stem is mush, so
  // the bandwidth is opened back up and the timebase steadied under it.
  'lumaMHz:3.4',
  'tbJitterNs:70',
  'tbWowNs:150',
  // And colour has to stay colour. `vhs` runs the whole chroma path under the
  // luma at a 0.5 MHz demod, which is the right bandwidth for a face and far
  // too little for a mark whose only colour is a few thin strokes.
  'demodMHz:0.9',
  'colorUnderMix:0.6',
  'underJitterDeg:2',
  // Colour off the edges: a coarse reconstruction lattice and a dead comb, so
  // the stems fringe rather than the field tinting.
  'chromaCoarse:3',
  'chromaGain:1.5',
  'svideoBleed:0.3',
  'combMode:0',
  'scDetuneKHz:0.5',
  // Sync furniture, at the two edges it belongs on.
  'syncBendUs:1.4',
  'headSwitchShiftUs:2.4',
  'headSwitchNoise:0.45',
  'bendUs:0.25',
  'bendShape:1',
  // The camera loop, at a mix low enough to be a halo rather than a second
  // copy of the words half a letter to the right.
  'fbMix:0.3',
  'fbZoom:1.012',
  'fbGain:1.02',
  'fbFocus:1',
  // And the mixer loop's ring modulator against the box's own subcarrier
  // oscillator, which is where the violet comes from: it translates the
  // letters' brightness up into the chroma band and brings it back as hue.
  // Every lap also arrives one delay late, so this is the knob that smears —
  // 0.4 mix and a quarter-microsecond is as much of it as the type survives.
  'cfbMix:0.4',
  'cfbGain:1',
  'cfbDelayUs:0.25',
  'cfbLines:1',
  'cfbRing:0.9',
  'cfbRingSrc:1',
  'cfbGenlock:1',
].join(',')

// The h1's own family and weight (site/styles/landing.css). Held here rather
// than read out of the page because the plate is drawn on a bare document: what
// matters is that these two agree, and the pair is one line to keep in step.
const FAMILY = "system-ui, -apple-system, 'Segoe UI', sans-serif"

// 4:3, which is the raster the words are going to be scanned onto. A plate of
// any other shape arrives pillarboxed and the type comes out smaller for it.
const PLATE_W = 1600
const PLATE_H = 1200

// The wide file keeps the whole raster: the header is a letterbox, so `cover`
// scales a 4:3 frame to the window's width and takes the crop out of the top
// and bottom — which is dark field either side of the words, and no loss. Crop
// it to 16:9 first and the same fit magnifies the type until the artifacts are
// bigger than the letters they are on.
//
// The narrow file cannot do that. A portrait header covering a 4:3 source takes
// its crop out of the sides instead, where the words end, so that one is cut to
// 3:4 with the type set small enough to survive it. Its crop is anchored to the
// bottom of the raster, keeping the head-switch band on the image's own edge —
// the flag along the top is the half worth losing.
const RENDERS = [
  {
    out: 'public/hero-title.webp',
    text: 'WebGPU analog<br>video emulation.',
    size: 100,
    aspect: 4 / 3,
    width: 2000,
  },
  {
    out: 'public/hero-title-narrow.webp',
    text: 'WebGPU analog<br>video emulation.',
    size: 95,
    aspect: 3 / 4,
    width: 1080,
  },
  // The link preview, whole. Not a ground with the brand composited over it
  // afterwards: the mark and the wordmark are drawn onto the plate with the
  // headline and go down the same path, so the icon's colours are the ones the
  // decoder made of them and the wordmark carries the same fringe as the words
  // above it. One picture, and every part of it is a picture of the program.
  //
  // Centred rather than bottom-anchored, because this crop is composed: the
  // plate lays the card out inside the band the crop keeps.
  {
    out: 'public/og.jpg',
    brand: true,
    text: 'WebGPU analog<br>video emulation.',
    size: 140,
    aspect: 1200 / 630,
    width: 1200,
    anchor: 'center',
  },
]

const check = process.argv.includes('--check')

// The site's own mark, drawn onto the plate rather than laid over the picture
// afterwards, so it arrives at the decoder as video like everything else.
const FAVICON = readFileSync('public/favicon.svg').toString('base64')

// Everything on a plate is full-swing white on black. That is the harshest
// thing a composite path can be handed — a vertical edge on every stem — and it
// is what makes the fringing, so nothing here is drawn in the greys the page
// would use.
const plateHtml = ({ text, size, brand = false }) => `<!doctype html><style>
  html, body { margin: 0; height: 100% }
  body { background: #000; display: grid; place-items: center }
  .card { display: flex; flex-direction: column; align-items: center; gap: 78px }
  p {
    margin: 0;
    color: #fff;
    font-family: ${FAMILY};
    font-weight: 700;
    font-size: ${size}px;
    line-height: 1.05;
    letter-spacing: -0.02em;
    text-align: center;
    -webkit-font-smoothing: antialiased;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 26px;
    color: #fff;
    font-family: ${FAMILY};
    font-weight: 700;
    font-size: 66px;
    letter-spacing: -0.01em;
  }
  /* Bigger than the wordmark's cap height, which a mark beside a word usually
     is not. The steam wisps are the only colour in it and they are 2.4 units
     wide in a 32-unit box: drawn at the size the page uses them, the chroma
     path has nothing left to carry by the time it has been through the tape. */
  .brand img { width: 122px; height: 122px }
</style><div class="card"><p>${text}</p>${
  brand
    ? `<div class="brand">
         <img src="data:image/svg+xml;base64,${FAVICON}" />videoskillet.js
       </div>`
    : ''
}</div>`

const scratch = mkdtempSync(join(tmpdir(), 'heroplate-'))

// The plate is drawn in Chrome and the signal path is driven in Firefox: only
// Firefox Nightly has WebGPU on the Linux box this is maintained from
// (CLAUDE.md § Testing WebGPU), and only Chrome renders the site's type the way
// the page does. Two browsers, one for what each is here for.
const chrome = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
})
const chromePage = await chrome.newPage()
await chromePage.setViewport({ width: PLATE_W, height: PLATE_H })
const plates = new Map()
for (const render of RENDERS) {
  await chromePage.setContent(plateHtml(render), { waitUntil: 'load' })
  await chromePage.evaluate(() => document.fonts.ready)
  plates.set(render.out, await chromePage.screenshot({ type: 'png' }))
}
await chrome.close()

// The plate reaches the app as an address rather than as a file pick, because
// `?iurl=` is the only way in that a script can drive. `fetch` is what loads it
// (src/ui/useEngine.ts), so the header below is what makes it loadable at all.
let serving = null
const plateServer = createServer((_, res) => {
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(serving)
})
await new Promise(r => plateServer.listen(0, r))
const platePort = plateServer.address().port

// The app's own dev server, started here rather than borrowed: this worktree is
// shared, and a server someone else is editing against reloads mid-capture.
const vite = await createVite({ server: { port: 0 }, logLevel: 'warn' })
await vite.listen()
const appPort = vite.httpServer.address().port

const firefox = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
  },
})
const page = await firefox.newPage()
await page.setViewport({ width: 1352, height: 900 })
let failure = ''
page.on('pageerror', err => {
  failure ||= String(err).slice(0, 200)
})

const iurl = encodeURIComponent(`http://localhost:${platePort}/plate.png`)
const stale = []
for (const render of RENDERS) {
  serving = plates.get(render.out)
  const url = `http://localhost:${appPort}/app/?iurl=${iurl}&srcb=none&preset=${PRESET}&set=${SET}`
  await page.goto(url, { waitUntil: 'networkidle0' })
  // Real time for the device to come up and the first pictures to land, then
  // frames stepped deterministically: an occluded window throttles rAF, and the
  // loop below needs laps to develop the colour rather than wall-clock.
  await new Promise(r => setTimeout(r, 3500))
  await page.evaluate(async () => {
    for (let i = 0; i < 150; i++) {
      window.vf?.step()
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 15))
    }
  })
  const shot = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    if (canvas === null) return null
    const off = document.createElement('canvas')
    off.width = canvas.width
    off.height = canvas.height
    off.getContext('2d').drawImage(canvas, 0, 0)
    return off.toDataURL('image/png')
  })
  if (shot === null) {
    failure ||= 'no canvas: the app never came up'
    break
  }
  const framePath = join(scratch, 'frame.png')
  writeFileSync(framePath, Buffer.from(shot.split(',')[1], 'base64'))
  const target = check ? join(scratch, 'candidate.webp') : render.out
  // The canvas is taller than the picture it is showing, so the frame comes
  // back with a black bar above and below the 4:3 raster. That is cropped away
  // first, then the raster is cropped again to the render's own shape.
  //
  // The resize is what keeps the file affordable: this is a 754-sample line
  // blown up several times over, the grain is what webp spends its bytes on,
  // and past these widths it is encoding noise nobody can see.
  const [w, h] = execFileSync('magick', [
    framePath,
    '-format',
    '%w %h',
    'info:',
  ])
    .toString()
    .split(' ')
    .map(Number)
  const rasterH = Math.round((w * 3) / 4)
  const rasterY = Math.round((h - rasterH) / 2)
  const cropW = Math.min(w, Math.round(rasterH * render.aspect))
  const cropH = Math.min(rasterH, Math.round(w / render.aspect))
  execFileSync('magick', [
    framePath,
    '-crop',
    `${cropW}x${cropH}+${Math.round((w - cropW) / 2)}+${
      render.anchor === 'center'
        ? rasterY + Math.round((rasterH - cropH) / 2)
        : rasterY + rasterH - cropH
    }`,
    '+repage',
    '-resize',
    `${render.width}x`,
    '-quality',
    // webp is spending its bytes on grain and can be pushed hard; the link
    // preview is a jpeg because that is what the card's meta names, and jpeg
    // at the same number turns the fringing into blocks.
    render.out.endsWith('.jpg') ? '90' : '62',
    target,
  ])
  if (check) {
    // Byte equality would fail on a re-render that is visually the same frame:
    // the loop is developed by stepping, and a lap either way moves pixels. So
    // what is checked is that the file is there and is a picture of the right
    // shape — a headline whose copy has changed since the last render comes
    // back a different size long before it comes back a different colour.
    const shape = f =>
      existsSync(f)
        ? execFileSync('magick', ['identify', '-format', '%wx%h', f]).toString()
        : 'missing'
    if (shape(render.out) !== shape(target)) stale.push(render.out)
  }
}

await firefox.close()
await vite.close()
plateServer.close()
rmSync(scratch, { recursive: true, force: true })

if (failure !== '') {
  console.error(`heroplate: ${failure}`)
  process.exit(1)
}
if (stale.length > 0) {
  console.error(
    `heroplate: stale, re-run \`pnpm heroplate\`:\n  ${stale.join('\n  ')}`,
  )
  process.exit(1)
}
console.log(
  check
    ? 'heroplate: up to date'
    : RENDERS.map(r => `wrote ${r.out}`).join('\n'),
)

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { demos, hero } from './demos.mjs'

// Renders the link-preview image (public/og.jpg): one of the landing page's
// own demo stills (public/demos/<slug>.webp — see demos.mjs) as the ground,
// with the brand laid over it through a real browser rather than composited
// with ImageMagick, so the mark, the fonts and the gradients are the ones the
// site itself renders. Reuses the still rather than a fresh capture so the
// image stays the exact look the landing page already shows for that demo.
//
// Usage: node scripts/ogimage.mjs [look]   (default: the demo flagged `hero`)
//   (needs Firefox Nightly + ImageMagick's `magick` on PATH)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The demo flagged `hero` in demos.json, which is the same still the landing
// page's header shows — one look, so the page and the card that stands in for
// it when the link is shared are a picture of the same thing. A name on the
// command line overrides it, for trying one out before flagging it.
const lookName = process.argv[2] ?? hero.name
const OUT = 'public/og.jpg'

const look = demos.find(d => d.name === lookName)
if (!look) throw new Error(`no demo named "${lookName}" in demos.json`)

const scratch = mkdtempSync(join(tmpdir(), 'ogimage-'))

// Cover-crop the still to the OG aspect ratio. The still is 640x512 (5:4),
// narrower than 1200x630 (~1.9:1), so this also upscales it — a soft ground
// rather than a sharp one, which is the point: text sits on top of it, not
// beside it, and the blur keeps the picture from competing with the mark.
const framePath = join(scratch, 'frame.png')
execFileSync('magick', [
  `public/${look.still}`,
  '-resize',
  '1200x630^',
  '-gravity',
  'center',
  '-extent',
  '1200x630',
  framePath,
])
const frame = readFileSync(framePath).toString('base64')
const favicon = readFileSync('public/favicon.svg').toString('base64')

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
      }
      .og {
        position: relative;
        width: 1200px;
        height: 630px;
        overflow: hidden;
        background: #0e0e11;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      }
      .og img.bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter: saturate(1.15) contrast(1.08);
      }
      /* Same idea as the hero's own scrim (index.html .heroScrim): one wash,
         angled to clear the top-right of the picture so the look still reads
         as itself, and grounded at the bottom the way the hero is. */
      .scrim {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(
            100deg,
            rgb(14 14 17 / 95%) 0%,
            rgb(14 14 17 / 86%) 30%,
            rgb(14 14 17 / 25%) 56%,
            rgb(14 14 17 / 0%) 72%
          ),
          linear-gradient(to top, rgb(14 14 17 / 85%) 0%, rgb(14 14 17 / 0%) 34%);
      }
      .scan {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          to bottom,
          rgb(0 0 0 / 13%) 0px,
          rgb(0 0 0 / 13%) 1px,
          transparent 1px,
          transparent 3px
        );
        mix-blend-mode: multiply;
      }
      .body {
        position: relative;
        height: 630px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 0 0 0 64px;
        color: #e6e6ee;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
        font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        font-size: 22px;
        color: #c6c6d6;
        letter-spacing: 0.02em;
      }
      .brand img {
        width: 40px;
        height: 40px;
      }
      h1 {
        font-size: 64px;
        line-height: 1.08;
        letter-spacing: -0.02em;
        margin: 30px 0 0;
        max-width: 740px;
        font-weight: 700;
      }
      p.req {
        font-size: 22px;
        color: #a6a6ba;
        margin: 24px 0 0;
        max-width: 620px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <div class="og">
      <img class="bg" src="data:image/png;base64,${frame}" />
      <div class="scrim"></div>
      <div class="scan"></div>
      <div class="body">
        <p class="brand">
          <img src="data:image/svg+xml;base64,${favicon}" />videoskillet.js
        </p>
        <h1>WebGPU analog video emulation.</h1>
        <p class="req">Real-time NTSC / VHS glitches.</p>
      </div>
    </div>
  </body>
</html>
`

const htmlPath = join(scratch, 'og.html')
writeFileSync(htmlPath, html)

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' })
  const el = await page.$('.og')
  const pngPath = join(scratch, 'og.png')
  await el.screenshot({ path: pngPath })
  execFileSync('magick', [pngPath, '-quality', '90', OUT])
} finally {
  await browser.close().catch(() => {})
}

rmSync(scratch, { recursive: true, force: true })
console.log(`${OUT} — ${lookName}`)

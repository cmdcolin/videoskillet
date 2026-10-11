#!/usr/bin/env node
import puppeteer from 'puppeteer-core'
import { createServer as createVite } from 'vite'

import { CHROME, FIREFOX } from './browser.mjs'
import {
  BUTTONS,
  PAD_X,
  PAD_Y,
  SCALE,
  STRIDE,
  framesOf,
} from './buttonglitch.mjs'
import { PRESET, SET } from './herolook.mjs'
import { appUp } from './until.mjs'

// Renders the landing page's buttons through the program, one fault each, as
// strips of frames the page plays on hover. Each button is drawn with the site's
// own stylesheets, scaled up onto a plate, handed to the app as source A, and
// stepped through the fault in scripts/buttonglitch.mjs while the harness keeps
// every other frame.
//
//   node scripts/buttonplate.mjs              # public/btn/*.webp
//   node scripts/buttonplate.mjs --only=app   # one button
//   node scripts/buttonplate.mjs --sheet=DIR  # also a contact sheet per button
//
// Needs Firefox Nightly (WebGPU), Chrome (the plate) and ImageMagick's `magick`.
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The hero's look without its mixer loop. The ring modulator in that loop is
// what turns the headline violet, and a button has a colour of its own to keep:
// the page swaps the sprite in over the real button, so its first frame has to
// be the same green.
const BUTTON_LOOK = 'cfbMix:0'

const PLATE_W = 1600
const PLATE_H = 1200
// The share of the plate's width the button takes.
const FILL = 0.7

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('=')),
)
const buttons = BUTTONS.filter(
  b => args.only === undefined || b.name === args.only,
)
const sheet = args.sheet

const css = [
  'src/tokens.css',
  'site/styles/tokens.css',
  'site/styles/site.css',
  'site/styles/landing.css',
]
  .map(f => readFileSync(f, 'utf8'))
  .join('\n')

const plateHtml = ({ label, primary }) => `<!doctype html><style>${css}
  html, body { margin: 0; height: 100%; background: #000 }
  body { display: grid; place-items: center }
  .heroCta .btn { transition: none }
</style><p class="heroCta"><a class="btn${primary ? ' primary' : ''}">${label}</a></p>`

const scratch = mkdtempSync(join(tmpdir(), 'buttonplate-'))

const chrome = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
})
const chromePage = await chrome.newPage()
await chromePage.setViewport({ width: PLATE_W, height: PLATE_H })
const plates = new Map()
for (const b of buttons) {
  await chromePage.setContent(plateHtml(b), { waitUntil: 'load' })
  const box = await chromePage.evaluate(async fill => {
    await document.fonts.ready
    const btn = document.querySelector('.btn')
    const css = btn.getBoundingClientRect()
    document.querySelector('.heroCta').style.zoom = String(
      (innerWidth * fill) / css.width,
    )
    await new Promise(r =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    )
    const on = btn.getBoundingClientRect()
    return {
      w: css.width,
      h: css.height,
      plate: { x: on.x, y: on.y, w: on.width, h: on.height },
    }
  }, FILL)
  const png = await chromePage.screenshot({ type: 'png' })
  plates.set(b.name, { png, box })
}
await chrome.close()

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

const vite = await createVite({ server: { port: 0 }, logLevel: 'warn' })
await vite.listen()
const appPort = vite.httpServer.address().port

const firefox = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  protocolTimeout: 480_000,
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
for (const b of buttons) {
  const { png, box } = plates.get(b.name)
  serving = png
  await page.goto(
    `http://localhost:${appPort}/app/?iurl=${iurl}&srcb=none&preset=${PRESET}&set=${SET},${BUTTON_LOOK}`,
    {
      waitUntil: 'domcontentloaded',
    },
  )
  if (!(await appUp(page, 20000))) {
    failure ||= 'the app never came up'
    break
  }
  await page.bringToFront()
  const lit = () => {
    const canvas = document.querySelector('canvas')
    if (canvas === null) return 0
    const off = new OffscreenCanvas(canvas.width, canvas.height)
    const ctx = off.getContext('2d')
    ctx.drawImage(canvas, 0, 0)
    const { data } = ctx.getImageData(0, 0, off.width, off.height)
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 360) count++
    }
    return count
  }
  const landed = await page
    .waitForFunction(`(${lit})() > 1000`, { timeout: 40000, polling: 250 })
    .then(
      () => true,
      () => false,
    )
  if (!landed) {
    failure ||= `the plate for ${b.name} never reached the canvas`
    break
  }
  // The plate's box, as a share of the plate: the page maps it onto the raster.
  const crop = {
    x: (box.plate.x - (PAD_X * box.plate.w) / box.w) / PLATE_W,
    y: (box.plate.y - (PAD_Y * box.plate.h) / box.h) / PLATE_H,
    w: (box.plate.w * (1 + (2 * PAD_X) / box.w)) / PLATE_W,
    h: (box.plate.h * (1 + (2 * PAD_Y) / box.h)) / PLATE_H,
  }
  const out = {
    w: Math.round((box.w + 2 * PAD_X) * SCALE),
    h: Math.round((box.h + 2 * PAD_Y) * SCALE),
  }
  const frames = await page.evaluate(
    async (peak, seconds, crop, out, stride) => {
      const vf = window.vf
      vf.pauseLoop()
      await new Promise(r =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      )
      vf.startTake({ fps: 60, seed: 1 })
      for (let i = 0; i < 40; i++) vf.step()
      const canvas = document.querySelector('canvas')
      // The canvas letterboxes the 4:3 raster, so the plate's box is mapped
      // onto the raster's band of it.
      const rasterH = (canvas.width * 3) / 4
      const rasterY = (canvas.height - rasterH) / 2
      const sx = crop.x * canvas.width
      const sy = rasterY + crop.y * rasterH
      const sw = crop.w * canvas.width
      const sh = crop.h * rasterH
      const off = document.createElement('canvas')
      off.width = out.w
      off.height = out.h
      const ctx = off.getContext('2d')
      const grab = () => {
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.w, out.h)
        return off.toDataURL('image/png')
      }
      const plan = {
        peak,
        frames: seconds * 60,
        cut: 0.5,
        onCut: () => {},
      }
      const grabbed = []
      vf.startFault(plan)
      for (let i = 0; i <= plan.frames; i++) {
        if (i % stride === 0) grabbed.push(grab())
        vf.step()
      }
      vf.endTake()
      vf.resumeLoop()
      return grabbed
    },
    b.peak,
    b.seconds,
    crop,
    out,
    STRIDE,
  )
  const dir = join(scratch, b.name)
  mkdirSync(dir, { recursive: true })
  const files = frames.map((f, i) => {
    const file = join(dir, `${String(i).padStart(3, '0')}.png`)
    writeFileSync(file, Buffer.from(f.split(',')[1], 'base64'))
    return file
  })
  mkdirSync('public/btn', { recursive: true })
  const target = `public/btn/${b.name}.webp`
  execFileSync('magick', [...files, '-append', '-quality', '55', target])
  if (sheet !== undefined) {
    mkdirSync(sheet, { recursive: true })
    execFileSync('magick', [
      'montage',
      ...files.filter((_, i) => i % 2 === 0),
      '-tile',
      '4x',
      '-geometry',
      '+4+4',
      '-background',
      '#0e0e11',
      join(sheet, `${b.name}.png`),
    ])
  }
  if (files.length !== framesOf(b)) {
    failure ||= `${b.name}: ${files.length} frames, the page expects ${framesOf(b)}`
  }
  console.log(`wrote ${target}: ${files.length} frames`)
}

await firefox.close()
await vite.close()
plateServer.close()
rmSync(scratch, { recursive: true, force: true })

if (failure !== '') {
  console.error(`buttonplate: ${failure}`)
  process.exit(1)
}

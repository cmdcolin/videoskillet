// The stills the home page's phone tour shows: the camera page at a phone's
// size, driven through a look, the tune sheet, a zoom, the mixer and the help.
//
// No phone is involved. The page's camera is `public/sample.jpg` panning on a
// canvas, standing in for getUserMedia, and the clip it mixes in is
// `public/sample-b.jpg` panning, encoded to an mp4 with ffmpeg and handed to
// the page's own file picker. So the shots are the real page on the real GPU
// path, and regenerating them needs nothing but this repo.
//
// Usage: node scripts/camshots.mjs [--out=public/phone] [--keep]
//   needs Firefox Nightly, ffmpeg and ImageMagick. Starts its own vite server.
//   `--keep` leaves the full-size pngs in the temp directory it prints.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'

import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}
const out = flag('out', 'public/phone')
const keep = argv.includes('--keep')
const PORT = 5297
const APP = `http://127.0.0.1:${PORT}`

// An iPhone's viewport, drawn at twice its size.
const WIDTH = 390
const HEIGHT = 844
const SCALE = 2

// Each still is a 3:4 crop of the screen, full width, ending a little under
// the part its card is about.
const CROP_H = (WIDTH * 4) / 3
const STILLS = {
  looks: { shot: 'look', under: 'nav[aria-label="Looks"]' },
  tune: { shot: 'tune', under: 'section[aria-label="Tune the look"]' },
  mix: { shot: 'inset', under: '[aria-label="Mixer"]' },
  zoom: { shot: 'zoom', under: '[aria-label="Zoom"]' },
  help: { shot: 'help', under: 'button[class*="hints"]' },
}
const MARGIN = 12

const dir = mkdtempSync(join(tmpdir(), 'camshots-'))
const clip = join(dir, 'clip.mp4')
execFileSync('ffmpeg', [
  ...['-v', 'error', '-loop', '1', '-i', 'public/sample-b.jpg', '-t', '6'],
  '-vf',
  "scale=1440:-2,zoompan=z='1.15':x='(iw-iw/1.15)*(0.5+0.5*sin(on/40))':y='(ih-ih/1.15)/2':d=1:s=960x540:fps=30,format=yuv420p",
  ...['-c:v', 'libx264', '-y', clip],
])

// vite's own binary, for the reason homeshot.mjs gives about astro's: killing
// a pnpm wrapper leaves its child holding the port.
const server = spawn(
  'node',
  [
    'node_modules/vite/bin/vite.js',
    '--port',
    String(PORT),
    '--strictPort',
    '--host',
    '127.0.0.1',
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] },
)
await new Promise((resolve, reject) => {
  let seen = ''
  server.stdout.on('data', chunk => {
    seen += chunk
    if (seen.includes(`:${PORT}`)) resolve()
  })
  server.on('exit', code => reject(new Error(`vite exited (${code})`)))
  setTimeout(() => reject(new Error('vite never came up')), 60000)
})

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
    'media.navigator.permission.disabled': true,
  },
})
const page = await browser.newPage()
await page.setViewport({
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
})
page.on('pageerror', err =>
  console.log('[pageerror]', String(err).slice(0, 300)),
)

// A phone held upright: a tall camera, panning slowly over the sample.
await page.evaluateOnNewDocument(src => {
  if (navigator.mediaDevices === undefined) return
  navigator.mediaDevices.getUserMedia = async () => {
    const img = new Image()
    img.src = src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 720
    c.height = 1280
    const g = c.getContext('2d')
    const h = c.height * 1.15
    const w = h * (img.width / img.height)
    const t0 = performance.now()
    const tick = () => {
      const t = (performance.now() - t0) / 1000
      g.drawImage(
        img,
        -(w - c.width) * (0.5 + 0.5 * Math.sin(t * 0.7)),
        -(h - c.height) / 2,
        w,
        h,
      )
      requestAnimationFrame(tick)
    }
    tick()
    return c.captureStream(30)
  }
}, `${APP}/sample.jpg`)

const settle = ms => new Promise(r => setTimeout(r, ms))
// Each shot keeps the bottom edge of every element a still is cropped to.
const shots = new Map()
const shoot = async name => {
  const path = join(dir, `${name}.png`)
  await page.screenshot({ path })
  const unders = Object.values(STILLS)
    .filter(s => s.shot === name)
    .map(s => s.under)
  const bottoms = await page.evaluate(
    sels =>
      Object.fromEntries(
        sels.map(s => [
          s,
          document.querySelector(s)?.getBoundingClientRect().bottom,
        ]),
      ),
    unders,
  )
  shots.set(name, { path, bottoms })
}
const click = async selector => {
  const el = await page.$(selector)
  if (el === null) throw new Error(`nothing matches ${selector}`)
  await el.click()
}
const clickText = async text => {
  const found = await page.evaluate(t => {
    const b = [...document.querySelectorAll('button')].find(
      e => e.textContent.trim() === t,
    )
    b?.click()
    return b !== undefined
  }, text)
  if (!found) throw new Error(`no button says ${text}`)
}
const setFader = v =>
  page.evaluate(v => {
    const el = document.querySelector('input[aria-label="fader"]')
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set
    set.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)

let failed
try {
  // A fresh vite server optimizes its dependencies on the first load and
  // reloads the page when it is done, so the page is waited for, not timed.
  await page.goto(`${APP}/cam/`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('xpath/.//button[text()="Start camera"]', {
    timeout: 60000,
  })
  await clickText('Start camera')
  await page.waitForSelector('button[class*="hints"]', { timeout: 30000 })
  await settle(3000)
  // A first visit opens on the help.
  await shoot('help')
  await click('button[class*="hints"]')
  await click('[data-look="theLightIsALapBehind"]')
  await settle(3000)
  await shoot('look')
  await click('button[title="the look\'s own knobs"]')
  await settle(1000)
  await shoot('tune')
  await click('button[aria-label="close"]')
  await click('button[aria-label="zoom 2×"]')
  await settle(2500)
  await shoot('zoom')
  await click('button[aria-label="zoom 1×"]')
  await clickText('normal')
  await click('button[title="mix a second picture in"]')
  const input = await page.$('input[type=file]')
  await input.uploadFile(clip)
  await settle(3000)
  await clickText('inset')
  await setFader(35)
  await settle(2500)
  await shoot('inset')
  await page.evaluate(() => window.vf?.destroy())
} catch (e) {
  failed = e
} finally {
  await browser.close()
  server.kill()
}
if (failed !== undefined) throw failed

for (const [name, { shot, under }] of Object.entries(STILLS)) {
  const { path, bottoms } = shots.get(shot)
  const bottom = bottoms[under]
  if (bottom === undefined) throw new Error(`${shot} has no ${under}`)
  const top = Math.min(Math.max(bottom + MARGIN - CROP_H, 0), HEIGHT - CROP_H)
  execFileSync('magick', [
    path,
    ...[
      '-crop',
      `${WIDTH * SCALE}x${CROP_H * SCALE}+0+${Math.round(top * SCALE)}`,
      '+repage',
    ],
    ...['-resize', '600x800', '-quality', '82'],
    join(out, `${name}.webp`),
  ])
  console.log(`wrote ${join(out, `${name}.webp`)}`)
}
if (keep) console.log(`pngs in ${dir}`)
else rmSync(dir, { recursive: true })

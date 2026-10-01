// What a repeated frame costs the H.264 encoder, against a fresh one. It
// decides whether a recorder can write a held frame as repeated samples, which
// keeps a wall-clock take strictly constant-framerate, or has to write it as
// one longer sample.
//
//   node scripts/repeatcost.mjs [port]
//
// Firefox Nightly on the dev box, 2026-09-30, `quality` mode:
//
//   1494x932  fresh 31.4 fps   repeat-only 97.3 fps, 150 B   1:1 mix 19.2 fresh/s, repeats 35 KB
//   754x480   fresh 60.8 fps   repeat-only 246 fps, 70 B     1:1 mix 44.5 fresh/s, repeats 13 KB
//
// A run of repeats is nearly free. A repeat between fresh frames costs about
// two thirds of a fresh one, because the encoder's B-frames code it against
// neighbours it does not match, so repeated samples cut a full-window take
// from about 31 fresh frames a second to about 19.
import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { appUp } from './until.mjs'

import process from 'node:process'

const port = process.argv[2] ?? '5311'
const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  defaultViewport: null,
  protocolTimeout: 900000,
  args: ['--width=1920', '--height=1080'],
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
  },
})
try {
  const page = (await browser.pages())[0] ?? (await browser.newPage())
  await page.goto(`http://localhost:${port}/app/?gpubudget=ignore`, {
    waitUntil: 'domcontentloaded',
  })
  console.log('up', await appUp(page, 20000))
  await page.bringToFront()
  await new Promise(r => setTimeout(r, 3000))
  const out = await page.evaluate(async () => {
    const cv = document.querySelector('canvas')
    const { candidatesFor } = await import('/src/ui/record.ts')
    const src = []
    for (let i = 0; i < 48; i++) {
      await new Promise(r => requestAnimationFrame(r))
      src.push(new VideoFrame(cv, { timestamp: 0 }))
    }
    const even = n => n - (n % 2)
    const sizes = [
      [even(cv.width), even(cv.height)],
      [754, 480],
    ]
    // Which source frame each output frame shows: every frame new, one frame
    // forever, or each new frame shown twice.
    const arms = {
      fresh: i => i % src.length,
      repeat: () => 0,
      mixed: i => (i >> 1) % src.length,
    }
    const N = 240
    const res = []
    for (const [w, h] of sizes) {
      const bitrate = Math.min(60e6, Math.max(16e6, w * h * 60 * 0.4))
      let codec = ''
      for (const c of candidatesFor(w, h)) {
        const cfg = { codec: c, width: w, height: h, bitrate, framerate: 60, avc: { format: 'avc' }, latencyMode: 'quality' }
        if ((await VideoEncoder.isConfigSupported(cfg)).supported) {
          codec = c
          break
        }
      }
      for (const [name, pick] of Object.entries(arms)) {
        const sizes = []
        const enc = new VideoEncoder({
          output: c => sizes.push(c.byteLength),
          error: e => console.log('enc error', String(e)),
        })
        enc.configure({ codec, width: w, height: h, bitrate, framerate: 60, avc: { format: 'avc' }, latencyMode: 'quality' })
        const t0 = performance.now()
        for (let i = 0; i < N; i++) {
          const f = new VideoFrame(src[pick(i)], {
            timestamp: Math.round((i * 1e6) / 60),
            duration: Math.round(1e6 / 60),
            visibleRect: { x: 0, y: 0, width: w, height: h },
          })
          enc.encode(f, { keyFrame: i % 120 === 0 })
          f.close()
          while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1))
        }
        await enc.flush()
        const dt = (performance.now() - t0) / 1000
        enc.close()
        // Bytes of the frames that repeat their predecessor, and of the rest,
        // keyframes left out.
        const rep = [],
          fresh = []
        for (let i = 1; i < sizes.length; i++) {
          if (i % 120 === 0) continue
          if (pick(i) === pick(i - 1)) rep.push(sizes[i])
          else fresh.push(sizes[i])
        }
        const avg = a => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : null)
        res.push({
          size: `${w}x${h}`,
          arm: name,
          fps: +(N / dt).toFixed(1),
          freshPerSec: +(new Set(Array.from({ length: N }, (_, i) => pick(i))).size === 1
            ? 0
            : (N / dt) * (name === 'mixed' ? 0.5 : 1)
          ).toFixed(1),
          repeatBytes: avg(rep),
          freshBytes: avg(fresh),
        })
      }
    }
    for (const f of src) f.close()
    return res
  })
  for (const r of out) console.log(JSON.stringify(r))
} finally {
  await browser.close()
}

// What a take on the camera page asks of a phone's encoder, and what happens
// when the encoder cannot keep up.
//
//   node scripts/camrec.mjs [--seconds=20] [--encode-fps=N] [--phone=xperia1]
//
// Written for a report of the camera page crashing while it recorded on a Sony
// Xperia. No phone is involved: the page runs at the phone's viewport in
// Firefox Nightly, with the fake camera camshots.mjs uses.
//
// `--encode-fps` stands in for a slow encoder. A phone's hardware H.264
// encoder takes portrait frames only up to 1080x1920 through Chrome, and a
// larger picture falls back to Chrome's software encoder, which a phone runs
// far slower than a desktop does. The shim holds each frame handed to
// `encode` and releases them to the real encoder at N a second, so
// `encodeQueueSize` grows exactly as it would in front of an encoder that
// slow. Without the flag the real encoder runs unthrottled.
//
// It prints the canvas and encoder config, the deepest the queue got, the
// megabytes of picture that queue held, the file's size, and the browser's
// peak resident memory.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'

import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}
const SECONDS = Number(flag('seconds', '20'))
const ENCODE_FPS = Number(flag('encode-fps', '0'))

// CSS viewports and device pixel ratios from the phones' own screens.
const PHONES = {
  xperia1: { width: 411, height: 960, scale: 4 },
  xperia10: { width: 412, height: 961, scale: 2.625 },
  xperia5: { width: 412, height: 960, scale: 2.625 },
}
const phone = PHONES[flag('phone', 'xperia1')]
if (phone === undefined) throw new Error(`phones: ${Object.keys(PHONES)}`)

const PORT = 5298
const APP = `http://127.0.0.1:${PORT}`

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

// Resident memory of the browser and every process under it, in MB.
const rssMb = () => {
  const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,rss='], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .map(r => r.trim().split(/\s+/).map(Number))
  const tree = new Set([browser.process().pid])
  for (let grew = true; grew;) {
    grew = false
    for (const [pid, ppid] of rows)
      if (tree.has(ppid) && !tree.has(pid)) {
        tree.add(pid)
        grew = true
      }
  }
  return (
    rows.filter(([pid]) => tree.has(pid)).reduce((s, r) => s + r[2], 0) / 1024
  )
}

const page = await browser.newPage()
await page.setViewport({
  width: phone.width,
  height: phone.height,
  deviceScaleFactor: phone.scale,
  isMobile: true,
  hasTouch: true,
})
page.on('pageerror', err =>
  console.log('[pageerror]', String(err).slice(0, 300)),
)

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

await page.evaluateOnNewDocument(encodeFps => {
  const Real = window.VideoEncoder
  if (Real === undefined) return
  const stats = (window.__rec = {
    config: null,
    encoded: 0,
    maxQueue: 0,
    maxHeldMb: 0,
    outBytes: 0,
  })
  window.VideoEncoder = class extends Real {
    #held = []
    #timer = 0
    constructor(init) {
      super({
        ...init,
        output: (chunk, meta) => {
          stats.outBytes += chunk.byteLength
          init.output(chunk, meta)
        },
      })
    }
    get encodeQueueSize() {
      return super.encodeQueueSize + this.#held.length
    }
    configure(config) {
      stats.config = config
      super.configure(config)
      if (encodeFps > 0)
        this.#timer = setInterval(() => {
          const next = this.#held.shift()
          if (next === undefined) return
          if (this.state === 'configured') super.encode(next.frame, next.opts)
          next.frame.close()
        }, 1000 / encodeFps)
    }
    encode(frame, opts) {
      stats.encoded++
      if (encodeFps > 0) this.#held.push({ frame: frame.clone(), opts })
      else super.encode(frame, opts)
      const queue = this.encodeQueueSize
      const mb = (queue * frame.codedWidth * frame.codedHeight * 4) / 2 ** 20
      stats.maxQueue = Math.max(stats.maxQueue, queue)
      stats.maxHeldMb = Math.max(stats.maxHeldMb, mb)
    }
    async flush() {
      while (this.#held.length > 0) {
        const next = this.#held.shift()
        if (this.state === 'configured') super.encode(next.frame, next.opts)
        next.frame.close()
      }
      clearInterval(this.#timer)
      return super.flush()
    }
    close() {
      clearInterval(this.#timer)
      for (const h of this.#held.splice(0)) h.frame.close()
      super.close()
    }
  }
}, ENCODE_FPS)

const settle = ms => new Promise(r => setTimeout(r, ms))
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
const click = async selector => {
  const el = await page.$(selector)
  if (el === null) throw new Error(`nothing matches ${selector}`)
  await el.click()
}

let failed
try {
  await page.goto(`${APP}/cam/`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('xpath/.//button[text()="Start camera"]', {
    timeout: 60000,
  })
  await clickText('Start camera')
  await page.waitForSelector('button[aria-label="take a photo"]', {
    timeout: 30000,
  })
  await settle(3000)
  await page.evaluate(() =>
    document.querySelector('button[class*="hints"]')?.click(),
  )
  await clickText('video')
  const canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    return `${c.width}x${c.height}`
  })
  const idle = rssMb()
  let peak = idle
  const poll = setInterval(() => {
    peak = Math.max(peak, rssMb())
  }, 250)
  await click('button[aria-label="start recording"]')
  await settle(SECONDS * 1000)
  await click('button[aria-label="stop recording"]')
  await page.waitForSelector('button[title^="save or share"]', {
    timeout: 120000,
  })
  await settle(1000)
  clearInterval(poll)
  const stats = await page.evaluate(() => window.__rec)
  const err = await page.evaluate(
    () => document.querySelector('p[class*="error"]')?.textContent ?? '',
  )
  const bytes = await page.evaluate(async () => {
    const src = document.querySelector(
      'button[title^="save or share"] video',
    )?.src
    if (src === undefined) return ''
    const buf = await (await fetch(src.split('#')[0])).arrayBuffer()
    let bin = ''
    for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b)
    return btoa(bin)
  })
  const probe = () => {
    const path = join(mkdtempSync(join(tmpdir(), 'camrec-')), 'take.mp4')
    writeFileSync(path, Buffer.from(bytes, 'base64'))
    return execFileSync(
      'ffprobe',
      [
        ...['-v', 'error', '-select_streams', 'v:0', '-count_frames'],
        ...['-show_entries', 'stream=nb_read_frames,duration'],
        ...['-of', 'csv=p=0', path],
      ],
      { encoding: 'utf8' },
    ).trim()
  }
  const { codec, width, height, framerate, bitrate } = stats.config
  console.log(
    [
      `phone        ${flag('phone', 'xperia1')} (${phone.width}x${phone.height} @${phone.scale})`,
      `canvas       ${canvas}`,
      `encoder      ${codec} ${width}x${height} @${framerate}fps ${(bitrate / 1e6).toFixed(1)} Mbps`,
      `encoder in   ${ENCODE_FPS > 0 ? `${ENCODE_FPS} frames/s (shim)` : 'unthrottled'}`,
      `take         ${SECONDS}s, ${stats.encoded} frames handed over`,
      `queue        max ${stats.maxQueue} frames, ${stats.maxHeldMb.toFixed(0)} MB of picture`,
      `file         ${(stats.outBytes / 2 ** 20).toFixed(1)} MB of video`,
      `ffprobe      ${bytes === '' ? 'no file' : probe()} (duration, frames)`,
      `browser rss  ${idle.toFixed(0)} MB idle, ${peak.toFixed(0)} MB peak`,
      ...(err === '' ? [] : [`error        ${err}`]),
    ].join('\n'),
  )
} catch (e) {
  failed = e
  await page.screenshot({ path: flag('fail-shot', '/tmp/camrec-fail.png') })
} finally {
  await browser.close()
  server.kill()
}
if (failed !== undefined) throw failed

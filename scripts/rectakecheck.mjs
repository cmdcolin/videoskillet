// Does a live take from the main app keep its time, its sound and the page's
// frame rate?
//
//   node scripts/rectakecheck.mjs [port] [--seconds=12] [--size=1280x800]
//
// Two takes through the app's own record key, each judged by ffprobe:
//
//   - silent: a fresh page that never built an audio graph, so the take runs on
//     the wall clock.
//   - with sound: the clip's own sound routed to the speakers the way the audio
//     picker's "video" does it, and the window narrowed halfway through, so the
//     frames after it reach the encoder through the rescale pass.
//
// The clip is generated here with ffmpeg into public/check/ (ignored): a white
// field for four frames and a 10 ms 1 kHz click, both on every whole second. A
// take with sound then says how far apart the picture and the sound came out.
// The bar is lip sync, 45 ms either way at the median, because the engine
// samples a `<video>` at render time and that alone spreads single flashes by
// a frame or two; agent-docs/handoffs/record-clip-audio.md has the
// measurements.
//
// The default window keeps the canvas small enough for Firefox's encoder to
// keep up. At a full 1920x1080 window it manages about 34 fps, so the take
// holds frames, and a four-frame flash can fall entirely inside a hold.
//
// Needs ffmpeg and ffprobe on PATH, a dev server on the port, and the window in
// front: a take records what the page renders, and an occluded window renders
// at 1 Hz. A window that stopped drawing measured nothing, so it exits
// STALL_EXIT (75) as sweep.mjs expects.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { appUp } from './until.mjs'

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}
const port = argv.find(a => !a.startsWith('--')) ?? '5199'
const SECONDS = Number(flag('seconds', '12'))
const [VW, VH] = flag('size', '1280x800').split('x').map(Number)
const STALL_EXIT = 75
let stalled = false
const FPS = 60
const RATE = 48000

const fail = []
const check = (name, ok, detail = '') => {
  console.log(
    `${ok ? '  ok' : 'FAIL'}  ${name}${detail === '' ? '' : ` — ${detail}`}`,
  )
  if (!ok) fail.push(name)
}

const CLIP = 'public/check/sync.mp4'
if (!existsSync(CLIP)) {
  mkdirSync('public/check', { recursive: true })
  const click = 'if(lt(mod(t\\,1)\\,0.01)\\,0.8*sin(2*PI*1000*t)\\,0)'
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=black:s=320x240:r=60:d=120',
    '-f',
    'lavfi',
    '-i',
    `aevalsrc='${click}|${click}':s=${RATE}:d=120`,
    '-filter_complex',
    "[0:v]drawbox=x=0:y=0:w=iw:h=ih:c=white:t=fill:enable='lt(mod(t,1),4/60)'[v]",
    '-map',
    '[v]',
    '-map',
    '1:a',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-g',
    '60',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    CLIP,
  ])
}

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  defaultViewport: null,
  protocolTimeout: 300000,
  args: [`--width=${VW}`, `--height=${VH}`],
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
    'media.autoplay.default': 0,
    'media.autoplay.blocking_policy': 0,
  },
})
const out = mkdtempSync(join(tmpdir(), 'rectakecheck-'))

// Stand in for the download the hook ends with: keep the Blob, and let no
// file land in the Downloads folder. Installed after load: under BiDi, any
// `evaluateOnNewDocument` script makes Firefox throw "Permission denied to
// access property length" into the page, with or without these.
const hooks = () => {
  const make = URL.createObjectURL.bind(URL)
  URL.createObjectURL = blob => {
    if (blob instanceof Blob && blob.type === 'video/mp4') window.__take = blob
    return make(blob)
  }
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (this.download === '') click.call(this)
  }
}

async function take(label, { sound }) {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
  await page.goto(`http://localhost:${port}/app/?vurl=/check/sync.mp4`, {
    waitUntil: 'domcontentloaded',
  })
  if (!(await appUp(page, 20000))) throw new Error(`${label}: app not up`)
  await page.bringToFront()
  await new Promise(r => setTimeout(r, 3000))
  await page.evaluate(hooks)
  if (sound) {
    // What the audio picker's "video" does (useEngine's routeAudio), on source
    // A's element, which the engine's video pump holds.
    const routed = await page.evaluate(() => {
      const el = window.vf.pump?.a?.el ?? null
      if (el === null || !el.src.includes('/check/sync')) return false
      el.muted = false
      window.vf.audioState.routeMedia([el], { dry: 1, reverb: 0 })
      return true
    })
    check(`${label}: the clip's sound is routed`, routed)
    await new Promise(r => setTimeout(r, 1000))
  }
  // Frames the engine rendered per second. rAF alone can hold the display's
  // rate while the frame lock renders every second or third refresh, and the
  // renders are what a take records.
  const rate = ms =>
    page.evaluate(async ms => {
      const t0 = performance.now()
      const f0 = window.vf.frameNo()
      while (performance.now() - t0 < ms)
        await new Promise(r => requestAnimationFrame(r))
      return (window.vf.frameNo() - f0) / ((performance.now() - t0) / 1000)
    }, ms)
  const before = await rate(3000)
  await page.keyboard.press('r')
  const t0 = Date.now()
  const during = await page.evaluate(
    async (ms, narrow) => {
      const t0 = performance.now()
      const f0 = window.vf.frameNo()
      let narrowed = false
      while (performance.now() - t0 < ms) {
        await new Promise(r => requestAnimationFrame(r))
        if (narrow && !narrowed && performance.now() - t0 > ms / 2) {
          const cv = document.querySelector('canvas')
          if (cv?.parentElement) cv.parentElement.style.width = '60%'
          narrowed = true
        }
      }
      return (window.vf.frameNo() - f0) / ((performance.now() - t0) / 1000)
    },
    SECONDS * 1000,
    sound,
  )
  await page.keyboard.press('r')
  const wall = (Date.now() - t0) / 1000
  const after = await rate(3000)
  const b64 = await page.evaluate(async () => {
    const t = performance.now()
    while (window.__take === undefined && performance.now() - t < 30000)
      await new Promise(r => setTimeout(r, 50))
    if (window.__take === undefined) return ''
    const bytes = new Uint8Array(await window.__take.arrayBuffer())
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000)
      s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(s)
  })
  await page.close()
  check(`${label}: no page errors`, errors.length === 0, errors[0] ?? '')
  check(`${label}: a file came back`, b64 !== '')
  if (b64 === '') return null
  const file = join(out, `${label}.mp4`)
  writeFileSync(file, Buffer.from(b64, 'base64'))
  if (Math.min(before, during, after) < 5) stalled = true
  // Against the idle rate on either side, averaged: this box is shared, and a
  // neighbour's GPU work moves either one by a fifth.
  const idle = (before + after) / 2
  check(
    `${label}: recording costs the engine no frames`,
    during >= idle * 0.85,
    `${during.toFixed(1)} renders/s recording, ${before.toFixed(1)} before, ${after.toFixed(1)} after`,
  )
  return { file, wall }
}

const probe = (file, args) =>
  execFileSync('ffprobe', ['-v', 'error', ...args, '-of', 'json', file])
const streams = file =>
  JSON.parse(
    probe(file, [
      '-show_entries',
      'stream=codec_type,codec_name,channels,duration',
    ]),
  ).streams

function judgePicture(label, file, wall) {
  const decode = spawnSync('ffmpeg', [
    '-v',
    'warning',
    '-i',
    file,
    '-f',
    'null',
    '-',
  ])
  const warned = decode.stderr.toString().trim()
  check(
    `${label}: decodes without a warning`,
    warned === '',
    warned.split('\n')[0],
  )
  const pts = JSON.parse(
    probe(file, ['-select_streams', 'v:0', '-show_entries', 'frame=pts_time']),
  ).frames.map(f => Number(f.pts_time))
  const rising = pts.every((t, i) => i === 0 || t > pts[i - 1])
  check(`${label}: frames come out in order`, rising)
  const offGrid = pts.filter(
    t => Math.abs(t * FPS - Math.round(t * FPS)) > 1e-3,
  )
  check(
    `${label}: every frame lies on the 1/60 s grid`,
    offGrid.length === 0,
    offGrid.slice(0, 3).join(','),
  )
  const video = streams(file).find(s => s.codec_type === 'video')
  check(
    `${label}: the file lasts as long as the take`,
    Math.abs(Number(video.duration) - wall) < 0.4,
    `${Number(video.duration).toFixed(2)} s for ${wall.toFixed(2)} s`,
  )
  return { pts, video }
}

// Rising edges of the picture's brightness, each with the frame before it, so
// a flash's onset is known to lie between the two.
function flashes(file, pts) {
  const W = 16
  const H = 12
  const raw = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      file,
      '-map',
      '0:v:0',
      '-fps_mode',
      'passthrough',
      '-vf',
      `scale=${W}:${H},format=gray`,
      '-f',
      'rawvideo',
      '-',
    ],
    { maxBuffer: 1 << 30 },
  )
  const n = Math.min(pts.length, Math.floor(raw.length / (W * H)))
  const mean = []
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j < W * H; j++) s += raw[i * W * H + j]
    mean.push(s / (W * H))
  }
  const sorted = mean.toSorted((a, b) => a - b)
  const lo = sorted[Math.floor(n * 0.1)]
  const hi = sorted[Math.floor(n * 0.995)]
  const at = (lo + hi) / 2
  const out = []
  for (let i = 1; i < n; i++)
    if (mean[i] > at && mean[i - 1] <= at)
      out.push({ t: pts[i], before: pts[i - 1] })
  return out
}

function clicks(file) {
  const pcm = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      file,
      '-map',
      '0:a:0',
      '-ac',
      '1',
      '-ar',
      String(RATE),
      '-f',
      'f32le',
      '-',
    ],
    { maxBuffer: 1 << 30 },
  )
  const a = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4)
  let peak = 0
  for (const v of a) peak = Math.max(peak, Math.abs(v))
  const out = []
  let quiet = 0
  for (let i = 0; i < a.length; i++)
    if (Math.abs(a[i]) > peak * 0.3 && i >= quiet) {
      out.push(i / RATE)
      quiet = i + RATE * 0.3
    }
  return out
}

const silent = await take('silent', { sound: false })
const loud = await take('with sound', { sound: true })
await browser.close()

if (silent !== null) {
  judgePicture('silent', silent.file, silent.wall)
  check(
    'silent: no sound track',
    !streams(silent.file).some(s => s.codec_type === 'audio'),
  )
}

if (loud !== null) {
  const { pts, video } = judgePicture('with sound', loud.file, loud.wall)
  const audio = streams(loud.file).find(s => s.codec_type === 'audio')
  check('with sound: a sound track', audio !== undefined)
  if (audio !== undefined) {
    check('with sound: in stereo', audio.channels === 2, String(audio.channels))
    check(
      'with sound: the sound lasts as long as the picture',
      Math.abs(Number(audio.duration) - Number(video.duration)) < 0.15,
      `${Number(audio.duration).toFixed(3)} s against ${Number(video.duration).toFixed(3)} s`,
    )
    const f = flashes(loud.file, pts)
    const c = clicks(loud.file)
    const mids = []
    for (const t of c) {
      const near = f.find(x => Math.abs(x.t - t) < 0.45)
      if (near !== undefined)
        mids.push(((t - near.t + (t - near.before)) / 2) * 1000)
    }
    const mid = mids.toSorted((a, b) => a - b)[mids.length >> 1] ?? NaN
    check(
      'with sound: the clicks find their flashes',
      mids.length >= c.length * 0.75 && c.length >= SECONDS - 2,
      `${mids.length} of ${c.length} clicks`,
    )
    check(
      'with sound: picture and sound line up within lip sync',
      Math.abs(mid) < 45,
      `median ${mid.toFixed(1)} ms (positive: sound after picture)`,
    )
    const late = f.filter(x => x.t > Number(video.duration) / 2 + 1).length
    check(
      'with sound: the picture keeps moving after the window narrows',
      late >= Math.floor(SECONDS / 2) - 2,
      `${late} flashes in the second half`,
    )
  }
}

if (stalled) {
  console.log('STALL: the window stopped drawing; put it in front and rerun')
  process.exit(STALL_EXIT)
}
console.log(fail.length === 0 ? 'all ok' : `${fail.length} failed`)
process.exit(fail.length === 0 ? 0 : 1)

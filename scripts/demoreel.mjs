import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { demos, hero } from './demos.mjs'
import { heroBackdrop } from './reel.mjs'

// Record the demos as short mp4 loops for the landing page.
//
// `demos.json` is the list, and a demo in it is fully declarative — `?p=` packs
// the whole board, `?mod=` the modulation, `?src=`/`?srcb=` the sources — which
// is why nothing here clicks the UI or uploads a file. Only the query is used:
// the origin is always this run's base, which is what lets the list be recorded
// against a worktree's server on another port.
//
// Usage: node scripts/demoreel.mjs [outDir=public/demos] [base=http://localhost:5199/app/] [name...]
//   (needs dev server + Firefox Nightly + ffmpeg and cwebp on PATH). Writes
//   <slug>.mp4 and <slug>.webp — the still, so the page can show every demo
//   without fetching a dozen videos. Name demos to record a subset, which is
//   the usual run: one new look, not the reel.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'

const outDir = process.argv[2] ?? 'public/demos'
const base = process.argv[3] ?? 'http://localhost:5199/app/'
const only = process.argv.slice(4)

const sleep = ms => new Promise(r => setTimeout(r, ms))

// A feedback look is mostly *history*: the frame store has to fill before the
// picture is the one the link promises, and a clip that starts at the first
// frame opens on a flat field and blooms into the look, which reads as a bug.
// So every demo is stepped well past that before the recorder is armed.
//
// 150 was not enough, and the way it failed is worth writing down: the three
// darkest demos here are camera returns, where the picture is built almost
// entirely out of its own previous frames. Those bloom over several hundred
// frames, so a clip armed at 150 recorded the bloom rather than the look, and
// the poster drawn from its middle was black.
const WARM = 500
const SECS = 8

// What the landing page is served. The recordings were 960-wide 30fps crf 30
// and the ten of them came to 11.7 MB, which is a page that costs more than the
// app it advertises. 640 wide at 24fps and crf 33 is 2.6 MB for the set, and on
// this material the difference is not visible at card size or behind the hero's
// scrim: what these clips are made of is noise and scanlines, and the noise
// survives — it is the flat fields between them that a codec spends bits on.
// 5:4 is the canvas's own shape and the card's, so nothing is cropped.
const CLIP = { w: 640, h: 512 }
const FPS = 24

// Recorded well above what is shipped: the clip is scaled down afterwards, and
// a downscale is what hides the compression the capture itself put in.
const VIEWPORT = { width: 1100, height: 620 }

async function record(demo) {
  // One browser per clip: captureStream stalls on an occluded window, so each
  // clip's window has to be the sole focused one.
  const browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: FIREFOX,
    headless: false,
    extraPrefsFirefox: {
      'dom.webgpu.enabled': true,
      'gfx.webgpu.ignore-blocklist': true,
      // Two demos point a "camera" at the picture; a fake device keeps that
      // from blocking on a permission prompt nobody is there to answer.
      'media.navigator.streams.fake': true,
      'media.navigator.permission.disabled': true,
    },
  })
  try {
    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(`${base}${demo.query}`, { waitUntil: 'networkidle0' })
    // Engine init, plus the source fetch — one demo rolls a random clip off
    // archive.org, which is a network round trip before there is a picture.
    await sleep(demo.query.includes('ia-random') ? 15000 : 5000)
    // Paced, and it has to be. Stepping this many frames in one tight loop
    // submits work far faster than the GPU retires it, and the app reads a
    // queue that deep as a hung device: it says so on the console, replaces the
    // device, and the canvas the recorder is about to grab is gone — which is
    // the `captureStream of null` this used to fail with. Yielding every tenth
    // frame keeps submission under the watchdog, the same way shot.mjs does.
    await page.evaluate(async k => {
      for (let i = 0; i < k; i++) {
        window.vf?.step()
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 15))
      }
    }, WARM)
    // Everything the stage draws over the picture — toasts, the caption, the
    // frame overlays — is a sibling of the canvas, and none of it belongs in a
    // clip of the picture.
    await page.evaluate(() => {
      const c = document.querySelector('canvas')
      for (const el of c.parentElement.children) {
        if (el !== c) el.style.display = 'none'
      }
    })
    await page.bringToFront()
    await sleep(400)
    const dataUrl = await page.evaluate(async secs => {
      const canvas = document.querySelector('canvas')
      const type = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ].find(t => window.MediaRecorder?.isTypeSupported(t))
      const rec = new MediaRecorder(canvas.captureStream(30), {
        mimeType: type,
        videoBitsPerSecond: 12_000_000,
      })
      const chunks = []
      rec.ondataavailable = e => e.data.size && chunks.push(e.data)
      const stopped = new Promise(res => (rec.onstop = res))
      rec.start()
      const t0 = performance.now()
      await new Promise(res => {
        const iv = setInterval(() => {
          window.vf?.step()
          if (performance.now() - t0 > secs * 1000) {
            clearInterval(iv)
            res()
          }
        }, 33)
      })
      rec.stop()
      await stopped
      const blob = new Blob(chunks, { type: 'video/webm' })
      return await new Promise(res => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result)
        fr.readAsDataURL(blob)
      })
    }, SECS)
    const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
    writeFileSync(`${outDir}/${demo.file}.webm`, buf)
  } finally {
    await browser.close().catch(() => {})
  }
}

// Both encoders are wanted at the end of a run that takes a browser recording
// per demo to reach it, so they are checked at the start of it.
for (const bin of ['ffmpeg', 'cwebp']) {
  execFileSync('sh', ['-c', `command -v ${bin}`], { stdio: 'ignore' })
}

const wanted = demos.filter(d => !only.length || only.includes(d.file))
mkdirSync(outDir, { recursive: true })
console.log(`${wanted.length} demos → ${outDir}/`)

for (const demo of wanted) {
  const webm = `${outDir}/${demo.file}.webm`
  let ok = false
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    await record(demo).catch(e =>
      console.log('FAIL', demo.file, String(e).slice(0, 120)),
    )
    ok = statSync(webm, { throwIfNoEntry: false })?.size > 40_000
  }
  if (!ok) {
    console.log('SKIP', demo.file, '— no usable capture')
    continue
  }
  // prettier-ignore
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-an',
    '-vf', `fps=${FPS},scale=${CLIP.w}:${CLIP.h}:flags=lanczos`,
    '-c:v', 'libx264', '-crf', '33', '-preset', 'veryslow',
    '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', `${outDir}/${demo.file}.mp4`])
  // The still is the frame ffmpeg judges most representative of the whole
  // clip, not one at a fixed timestamp. These looks are not evenly interesting
  // over their length — a tape wow drags the picture through a dark trough and
  // back — so a fixed seek lands on whatever the look happened to be doing at
  // that second, and landed on black for three of them.
  // prettier-ignore
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', `${outDir}/${demo.file}.mp4`,
    '-vf', `thumbnail=${SECS * FPS}`, '-frames:v', '1',
    `${outDir}/${demo.file}.png`])
  // WebP rather than JPEG for the still, which is the one asset every card
  // pays for whether or not anybody looks at it: on this material it lands at
  // 30% of the JPEG at a quality nobody can pick out of a lineup — noise this
  // dense hides ringing that a photograph would show.
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    '72',
    `${outDir}/${demo.file}.png`,
    '-o',
    `${outDir}/${demo.file}.webp`,
  ])
  rmSync(`${outDir}/${demo.file}.png`)
  // The first demo listed is also what runs behind the hero, where it is
  // scrimmed down to about a fifth of itself and stretched over the width of
  // the window. That is not the card's job and should not be the card's file —
  // see `heroBackdrop` in reel.mjs for the sizes and what the difference costs.
  if (demo.file === hero.file) {
    const out = `${outDir}/${heroBackdrop.clip.split('/').pop()}`
    // prettier-ignore
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-an',
      '-vf', `fps=${FPS},scale=${heroBackdrop.width}:${heroBackdrop.height}:flags=lanczos`,
      '-c:v', 'libx264', '-crf', String(heroBackdrop.crf), '-preset', 'veryslow',
      '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', out])
    console.log(`  hero backdrop ${Math.round(statSync(out).size / 1024)}K`)
  }
  rmSync(webm)
  const kb = n =>
    Math.round(statSync(`${outDir}/${demo.file}.${n}`).size / 1024)
  console.log('clip', demo.file, `${kb('mp4')}K mp4`, `${kb('webp')}K still`)
}

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'

// Record the README's "Cool demos" as short mp4 loops for the landing page.
//
// The demos are the one set of looks anybody actually vouched for, and they are
// already written down as links — so this reads them rather than keeping a
// second list that would drift from the first. A link is fully declarative
// (?p= packs the whole board, ?mod= the modulation, ?src=/?srcb= the sources),
// which is why nothing here clicks the UI or uploads a file.
//
// Usage: node scripts/demoreel.mjs [outDir=public/demos] [base=http://localhost:5199/app/] [name...]
//   (needs dev server + Firefox Nightly + ffmpeg on PATH). Writes <slug>.mp4 and
//   <slug>.jpg — the poster, so the page can show every demo without fetching
//   ten videos. Name demos to record a subset.
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'

const outDir = process.argv[2] ?? 'public/demos'
const base = process.argv[3] ?? 'http://localhost:5199/app/'
const only = process.argv.slice(4)

const sleep = ms => new Promise(r => setTimeout(r, ms))

const slug = name =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')

// The README lists each demo as a bullet holding the name and, on the line
// under it, the link. Two of the ten point at a dev server (they were written
// from one and never republished), so what is kept is the query alone and the
// origin is always this run's base — which is also what lets the whole list be
// recorded against a worktree's server on another port.
const demosFromReadme = () => {
  const readme = readFileSync('README.md', 'utf8')
  const section = readme.slice(readme.indexOf('## Cool demos'))
  return [...section.matchAll(/^- (.+)\n\s+(https?:\/\/\S+)$/gm)].map(m => ({
    name: m[1].trim(),
    file: slug(m[1]),
    query: new URL(m[2]).search,
  }))
}

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

// Wide enough that the 4:3 picture fills a landing-page card at 2x, small
// enough that ten of them are a few megabytes rather than fifty.
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

const demos = demosFromReadme().filter(
  d => !only.length || only.includes(d.file),
)
mkdirSync(outDir, { recursive: true })
console.log(`${demos.length} demos → ${outDir}/`)

for (const demo of demos) {
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
  // 960 wide keeps a 4:3 picture crisp on a card at 2x; the even height is
  // what yuv420p needs. faststart so the page can start it without the whole
  // file.
  // prettier-ignore
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-an',
    '-vf', 'scale=960:-2', '-c:v', 'libx264', '-crf', '30', '-preset', 'slow',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${outDir}/${demo.file}.mp4`])
  // The poster is the frame ffmpeg judges most representative of the whole
  // clip, not one at a fixed timestamp. These looks are not evenly interesting
  // over their length — a tape wow drags the picture through a dark trough and
  // back — so a fixed seek lands on whatever the look happened to be doing at
  // that second, and landed on black for three of them.
  // prettier-ignore
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', `${outDir}/${demo.file}.mp4`,
    '-vf', `thumbnail=${SECS * 30}`, '-frames:v', '1', '-q:v', '4',
    `${outDir}/${demo.file}.jpg`])
  rmSync(webm)
  const kb = n =>
    Math.round(statSync(`${outDir}/${demo.file}.${n}`).size / 1024)
  console.log('clip', demo.file, `${kb('mp4')}K mp4`, `${kb('jpg')}K poster`)
}

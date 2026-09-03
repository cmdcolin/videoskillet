// Documentation screenshots: drive the real app in Firefox Nightly and render
// every image the guide pages embed, so they cannot drift from the UI.
// Each shot is declarative (scripts/docshot-specs.mjs): a URL, a list of
// actions, optional callouts, and what to crop to. Nothing is hand-measured —
// crops and callouts resolve against live elements at capture time.
//
// A spec with `video` records the canvas instead, into an mp4 (plus a poster
// still) — some of what this app does only reads in motion.
//
// Usage: node scripts/docshots.mjs [--force] [--base=URL] [--out=DIR]
//                                  [--videos=DIR] [--upload] [name...]
//        node scripts/docshots.mjs --check   which shots are behind the app
//   needs the dev server (pnpm dev), Firefox Nightly, ImageMagick and ffmpeg,
//   optionally pngquant. Names filter the run: `node scripts/docshots.mjs
//   overview presets`.
//
// Unchanged shots are left alone (a pixel-diff gate below `diff`), so a regen
// touches only what actually moved; --force rewrites everything.
//
// Clips are too big to commit, so they land in a gitignored directory and are
// hosted instead: --upload copies them to S3 under the same prefix the README's
// demo uses (needs the `colin` AWS profile).

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { SPECS } from './docshot-specs.mjs'
// Seeding, element resolution and the actions live in drive.mjs — `appreel.mjs`
// drives the same app to record its window, and neither harness owns that.
import { installHelpers, runAction, SEED, seedStorage, step } from './drive.mjs'

import { execFileSync, spawn } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}
const force = argv.includes('--force')
const upload = argv.includes('--upload')
const freeze = argv.includes('--freeze')
const check = argv.includes('--check')
const base = flag('base', 'http://localhost:5199/app/')
const outDir = flag('out', 'docs/img')
const videoDir = flag('videos', 'clips')
const only = argv.filter(a => !a.startsWith('--'))

// Where uploaded clips are served from — the prefix the README's demo already
// uses, so a guide clip is one more object beside it.
const S3_PREFIX = 's3://cmdcolinphotos/phosphene/'
const CLIP_BASE = 'https://cmdcolinphotos.s3.amazonaws.com/phosphene/'
// Where a figure's "open this in the app" link points: the same params this
// shot was captured with, against the deployed build.
const LIVE_BASE = 'https://videoskillet.com/app/'

// Captured at 2x so the images stay sharp on a HiDPI screen; JPEG shots are
// then fit to this width, which is still ~2x the column any doc renders them in.
const DPR = 2
const JPEG_WIDTH = 1800
// A shot is rewritten when more than this fraction of its pixels moved. The
// picture is a live GPU render, so two runs of the same spec differ by a
// sub-percent of dithered noise even when nothing changed.
const DIFF_GATE = 0.01
const sleep = ms => new Promise(r => setTimeout(r, ms))
const pct = n => `${(n * 100).toFixed(2)}%`

// Pixels that differ between two same-size images, as a fraction. null when the
// sizes differ, which is always a rewrite.
function diffFraction(a, b) {
  const size = f =>
    execFileSync('magick', ['identify', '-format', '%wx%h', f]).toString()
  if (size(a) !== size(b)) return null
  const [w, h] = size(a).split('x').map(Number)
  let differing = 0
  try {
    execFileSync('magick', ['compare', '-metric', 'AE', a, b, 'null:'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
  } catch (e) {
    differing = Number(String(e.stderr).trim().split(' ')[0])
  }
  return Number.isFinite(differing) ? differing / (w * h) : null
}

// Quantize a UI screenshot's palette. These are flat colors, so it shrinks them
// by half with nothing visible lost; --nofs keeps two identical renders
// byte-identical, so the diff gate doesn't churn on dither noise.
function optimizePng(file) {
  try {
    execFileSync(
      'pngquant',
      [
        '--nofs',
        '--quality=92-100',
        '--skip-if-larger',
        '--force',
        '--ext',
        '.png',
        file,
      ],
      { stdio: 'ignore' },
    )
  } catch (e) {
    if (e.code === 'ENOENT') console.log('    (pngquant not found; skipping)')
  }
}

function commit(tmpFile, outFile, name) {
  const fresh = !existsSync(outFile)
  const frac = fresh || force ? null : diffFraction(tmpFile, outFile)
  if (!fresh && !force && frac !== null && frac < DIFF_GATE) {
    rmSync(tmpFile)
    console.log(`  ≈ ${name} unchanged (${pct(frac)})`)
  } else {
    // copy + unlink, not rename: the render lands in $TMPDIR, which is often a
    // different filesystem from the repo.
    copyFileSync(tmpFile, outFile)
    rmSync(tmpFile)
    const why = fresh
      ? 'new'
      : force
        ? 'forced'
        : frac === null
          ? 'resized'
          : pct(frac)
    console.log(`  ✓ ${name} written (${why})`)
  }
}

// Record the canvas in the page and hand the webm back as a data url. The page
// steps the render loop itself while recording, and the stream samples on every
// paint (captureStream with no rate) rather than against a fixed clock, so the
// clip runs at whatever the loop actually achieved.
//
// This does mean the recording depends on the window being the frontmost one —
// an occluded window paints at about 1Hz — which is why a clip gets a fresh
// browser of its own and why captureVideo checks the rate that landed.
function recordCanvas(secs, fps) {
  const canvas = document.querySelector('canvas')
  const type = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find(t => window.MediaRecorder?.isTypeSupported(t))
  const rec = new MediaRecorder(canvas.captureStream(), {
    mimeType: type,
    // 12 Mbit is plenty at this size, and the webm crosses into node as a
    // base64 data url — at 24 the transfer alone outran the protocol timeout.
    videoBitsPerSecond: 12_000_000,
  })
  const chunks = []
  rec.ondataavailable = e => e.data.size && chunks.push(e.data)
  const stopped = new Promise(res => (rec.onstop = res))
  rec.start()
  const t0 = performance.now()
  return new Promise(res => {
    const tick = async () => {
      window.vf?.step()
      if (performance.now() - t0 < secs * 1000) {
        requestAnimationFrame(tick)
      } else {
        rec.stop()
        await stopped
        const fr = new FileReader()
        fr.onload = () => res(fr.result)
        fr.readAsDataURL(new Blob(chunks, { type: 'video/webm' }))
      }
    }
    requestAnimationFrame(tick)
  })
}

// The picture, in motion, as an mp4 beside a poster still. h264 rather than the
// raw webm: it is a third the size and plays inline everywhere a doc is read.
async function captureVideo(page, spec) {
  const { secs = 7, fps = 30, crf = 25 } = spec.video
  await page.evaluate(() => window.__ds.bareCanvas())
  await page.bringToFront()
  await sleep(400)
  const poster = join(tmpDir, `${spec.name}-poster.png`)
  const clip = await page.evaluate(() => window.__ds.rectOf('canvas'))
  await page.screenshot({ path: poster, clip })
  const posterOut = join(tmpDir, `${spec.name}-poster.jpg`)
  execFileSync('magick', [
    poster,
    '-resize',
    `${JPEG_WIDTH}x>`,
    '-quality',
    '86',
    posterOut,
  ])
  rmSync(poster)
  commit(
    posterOut,
    join(outDir, `${spec.name}-poster.jpg`),
    `${spec.name}-poster.jpg`,
  )

  const dataUrl = await page.evaluate(recordCanvas, secs, fps)
  const webm = join(tmpDir, `${spec.name}.webm`)
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  writeFileSync(webm, buf)
  const mp4 = join(videoDir, `${spec.name}.mp4`)
  mkdirSync(videoDir, { recursive: true })
  // prettier-ignore
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', webm, '-an',
    '-c:v', 'libx264', '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', mp4])
  rmSync(webm)
  // A window that lost focus mid-run throttles rAF to about 1Hz, and the clip
  // comes out technically valid and useless. Check the rate that actually
  // landed rather than the file size, which a long enough stall still passes.
  const probe = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=nb_frames:format=duration',
    '-of',
    'csv=p=0:nk=1',
    mp4,
  ])
    .toString()
    .trim()
    .split('\n')
    .map(Number)
  const [frames, duration] = probe
  const rate = frames / duration
  // Both halves matter: a stalled recording can come back as three frames over
  // a hundredth of a second, which reads as a fine frame rate and is not a clip.
  if (!(duration > secs * 0.6 && rate > 15)) {
    throw new Error(
      `clip stalled (${frames} frames over ${duration.toFixed(1)}s, wanted ${secs}s)`,
    )
  }
  console.log(
    `  ✓ ${spec.name}.mp4 (${(statSync(mp4).size / 1e6).toFixed(1)} MB, ${rate.toFixed(0)} fps)`,
  )
  if (upload) {
    execFileSync(
      'aws',
      ['s3', 'cp', mp4, `${S3_PREFIX}${spec.name}.mp4`, '--profile', 'colin'],
      { stdio: 'inherit' },
    )
    console.log(`  ↑ ${CLIP_BASE}${spec.name}.mp4`)
  }
}

async function captureStill(page, spec) {
  const jpeg = spec.format === 'jpeg'
  const name = `${spec.name}.${jpeg ? 'jpg' : 'png'}`
  // Whatever the actions clicked last is still focused, and its focus ring
  // reads as a highlight the shot didn't ask for.
  await page.evaluate(() => document.activeElement?.blur())
  if (spec.annotations !== undefined) {
    await page.evaluate(n => window.__ds.annotate(n), spec.annotations)
  }
  const clip =
    spec.crop === undefined
      ? undefined
      : await page.evaluate(t => window.__ds.rectOf(t), spec.crop)
  const shot = join(tmpDir, `${spec.name}.png`)
  await page.screenshot({ path: shot, clip })

  const tmpOut = join(tmpDir, name)
  if (jpeg) {
    execFileSync('magick', [
      shot,
      '-resize',
      `${spec.maxWidth ?? JPEG_WIDTH}x>`,
      '-quality',
      '88',
      tmpOut,
    ])
    rmSync(shot)
  } else {
    optimizePng(shot)
  }
  commit(jpeg ? tmpOut : shot, join(outDir, name), name)
}

async function capture(browser, spec) {
  const page = await browser.newPage()
  try {
    await page.setViewport({
      width: spec.width ?? 1280,
      height: spec.height ?? 880,
      // Clips are played at their own size, so 2x would only cost bitrate.
      deviceScaleFactor: spec.dpr ?? (spec.video === undefined ? DPR : 1),
    })
    await page.evaluateOnNewDocument(seedStorage, { ...SEED, ...spec.seed })
    const url = `${base}?${new URLSearchParams(spec.params ?? {})}`
    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.waitForSelector('canvas')
    // The engine builds its pipeline and fetches the source asynchronously;
    // there is no ready event to wait on, so give it real time.
    await sleep(spec.settleMs ?? 4000)
    await page.evaluate(installHelpers)
    // An occluded window throttles rAF, so frames are stepped rather than
    // waited for. Feedback looks need the frames to develop.
    await step(page, spec.warm ?? 90)
    for (const action of spec.actions ?? []) await runAction(page, action)

    const health = await page.evaluate(() => window.__ds.health())
    if (health.err !== '') throw new Error(`stage error: ${health.err}`)
    if (health.peak <= 0) throw new Error('dead frame — nothing rendered')

    if (spec.video === undefined) await captureStill(page, spec)
    else await captureVideo(page, spec)
    // The app mirrors the live look into the address bar, so this is the exact
    // patch that was captured — which matters for a shot whose look came from
    // "surprise me" rather than from its own params.
    liveUrls.set(spec.name, page.url().replace(base, LIVE_BASE))
  } finally {
    await page.evaluate(() => window.vf?.destroy()).catch(() => {})
    await page.close().catch(() => {})
  }
}

// What the app's address bar said when each shot was taken, so a randomized
// look ("surprise me") still links to the exact patch behind the picture.
const liveUrls = new Map()

// What a shot was taken against. These pictures carry the app's own masthead,
// version string and all, so a shot from two releases ago is visibly a shot of
// a different program — which is exactly how docs/img went stale showing a
// stage that had been renamed, at v0.28.7, with nothing to say so.
//
// Keyed on the version, so it fires once per release rather than once per
// commit — which is the cadence that gets read. It is also the honest cadence:
// the masthead in these pictures prints the version, so a release dates them
// whether or not the panel moved, and a release is when they ship anyway. The
// count of src/ commits beside it says how much of a retake it is — nought
// means the masthead string and nothing else.
//
// diagrams and docgen both have a --check that regenerates and compares. A
// screenshot cannot: comparing means recapturing, which needs a browser, a dev
// server and a minute. So this records what the app was when the shutter went,
// and --check reads it back. Cheap, headless, and it catches the failure that
// actually happens — nobody reruns a harness they have no reason to suspect.
const capturedAt = () => ({
  version: JSON.parse(readFileSync('package.json', 'utf8')).version,
  sha: execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
})

const readManifest = () => {
  const file = join(outDir, 'shots.json')
  if (!existsSync(file)) return new Map()
  return new Map(JSON.parse(readFileSync(file, 'utf8')).map(s => [s.name, s]))
}

// How far the app has moved since a shot was taken, counted in commits that
// touched src/. A docs-only commit does not make a screenshot of the UI stale,
// and counting it would make this cry wolf until nobody reads it.
const movedSince = sha => {
  try {
    return Number(
      execFileSync(
        'git',
        ['rev-list', '--count', `${sha}..HEAD`, '--', 'src/'],
        {
          encoding: 'utf8',
        },
      ).trim(),
    )
  } catch {
    return null
  }
}

// Only the shots with the app's chrome in them. A clip and a `look-` tile are
// the canvas alone — renaming a stage does not date a picture of the picture —
// and flagging all eleven every release is how a check stops being read. Read
// off the spec rather than listed here, so a new picture-only shot is covered
// by the same rule.
const showsPanel = spec => spec.video === undefined && spec.crop !== 'canvas'

function reportStaleness() {
  const now = capturedAt()
  const manifest = readManifest()
  const rows = SPECS.filter(showsPanel)
    .map(spec => {
      const was = manifest.get(spec.name)?.captured
      if (was === undefined) return { name: spec.name, why: 'never recorded' }
      if (was.version !== now.version) {
        const n = movedSince(was.sha)
        const moved =
          n === null ? '' : `, ${n} src commit${n === 1 ? '' : 's'} since`
        return { name: spec.name, why: `taken at v${was.version}${moved}` }
      }
      return null
    })
    .filter(row => row !== null)

  if (rows.length === 0) {
    console.log(`docshots current at v${now.version}`)
    return 0
  }
  for (const row of rows) console.log(`  ${row.name.padEnd(16)} ${row.why}`)
  console.log(
    `\n${rows.length} shot(s) behind v${now.version} — retake with:\n` +
      `  node scripts/docshots.mjs ${rows.map(r => r.name).join(' ')}`,
  )
  return 1
}

if (check) process.exit(reportStaleness())

// Every shot's live URL against the hosted app, so a figure in the docs can be
// opened and played with rather than only looked at. Merged into whatever is
// already on disk, so a filtered run doesn't drop the shots it skipped.
function writeManifest() {
  const file = join(outDir, 'shots.json')
  const onDisk = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  const previous = new Map(onDisk.map(s => [s.name, s.live]))
  const previousCaptured = new Map(onDisk.map(s => [s.name, s.captured]))
  const now = capturedAt()
  // Stamped for the shots this run actually took, including the ones the pixel
  // gate left alone: an unchanged shot was still checked against this build, so
  // it is current, not stale.
  const took = new Set(
    shots.filter(s => !failed.includes(s.name)).map(s => s.name),
  )
  const manifest = SPECS.map(spec => ({
    name: spec.name,
    file:
      spec.video === undefined
        ? `${spec.name}.${spec.format === 'jpeg' ? 'jpg' : 'png'}`
        : `${spec.name}-poster.jpg`,
    mp4: spec.video === undefined ? null : `${CLIP_BASE}${spec.name}.mp4`,
    live:
      liveUrls.get(spec.name) ??
      previous.get(spec.name) ??
      `${LIVE_BASE}?${new URLSearchParams(spec.params ?? {})}`,
    captured: took.has(spec.name)
      ? now
      : (previousCaptured.get(spec.name) ?? null),
  }))
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
}

const launchBrowser = () =>
  puppeteer.launch({
    browser: 'firefox',
    executablePath: FIREFOX,
    headless: false,
    // A clip that hangs page-side should fail its shot and retry rather than
    // sit forever; the ceiling has to clear the time a finished recording takes
    // to cross into node as a data url, which for a ten-second clip is seconds.
    protocolTimeout: 180_000,
    extraPrefsFirefox: {
      'dom.webgpu.enabled': true,
      'gfx.webgpu.ignore-blocklist': true,
      'media.navigator.streams.fake': true,
      'media.navigator.permission.disabled': true,
      // Keep the refresh driver on a timer at a fixed rate rather than on
      // vsync, and stop the timer budget throttling that a window which isn't
      // frontmost otherwise gets. Firefox has no requestFrame on a canvas
      // capture track, so a clip is sampled on paint — and a throttled window
      // paints about once a second, which is how a recording comes back as a
      // slideshow when something else takes focus mid-run.
      'layout.frame_rate': 60,
      'dom.timeout.enable_budget_timer_throttling': false,
      'dom.min_background_timeout_value': 4,
      'dom.suspend_inactive.enabled': false,
    },
  })

const reachable = () =>
  fetch(base)
    .then(r => r.ok)
    .catch(() => false)

// Run it against whatever is already serving the app; start a dev server when
// nothing is, so a regen is one command from a cold checkout.
async function ensureServer() {
  if (await reachable()) return null
  console.log(`starting a dev server for ${base}`)
  const server = spawn('pnpm', ['dev'], { stdio: 'ignore', detached: true })
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    if (await reachable()) return server
  }
  server.kill()
  throw new Error(`no dev server at ${base}`)
}

const tmpDir = mkdtempSync(join(tmpdir(), 'videoskillet-docshots-'))
const shots = SPECS.filter(s => only.length === 0 || only.includes(s.name))
if (shots.length === 0) {
  console.error(`no specs match ${only.join(' ')}`)
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const server = await ensureServer()
// One browser for the stills, and a fresh one per clip: MediaRecorder samples
// the canvas as it paints, and a window that isn't the frontmost one paints at
// about 1Hz — so a clip has to own the only window on screen.
const shared = shots.some(s => s.video === undefined)
  ? await launchBrowser()
  : null
const failed = []
for (const spec of shots) {
  console.log(`▸ ${spec.name}`)
  // One retry: a cold pipeline occasionally misses the frame budget, and the
  // health checks catch that — worth a second try before failing a run.
  let error = null
  for (let attempt = 0; attempt < 2 && error !== 'ok'; attempt++) {
    const browser = spec.video === undefined ? shared : await launchBrowser()
    error = await capture(browser, spec).then(
      () => 'ok',
      e => String(e.message ?? e).slice(0, 200),
    )
    if (browser !== shared) await browser.close().catch(() => {})
  }
  if (error !== 'ok') {
    console.log(`  ✗ ${spec.name}: ${error}`)
    failed.push(spec.name)
  }
}
await shared?.close()
// --freeze pins the looks this run landed on: a spec that rolls the dice
// ("surprise me") becomes a spec with the exact params behind the picture, so
// the next regen reproduces it instead of rolling again.
if (freeze) {
  const file = 'scripts/docshot-frozen.json'
  const kept = JSON.parse(readFileSync(file, 'utf8'))
  for (const [name, url] of liveUrls) {
    kept[name] = Object.fromEntries(new URL(url).searchParams)
  }
  writeFileSync(file, `${JSON.stringify(kept, null, 2)}\n`)
  console.log(`froze ${liveUrls.size} shot(s) into ${file}`)
}
writeManifest()
// The README's figure is composed from `chain` and `signal-path`, so a run that
// retook either one leaves it a shot behind the app.
if (shots.some(s => s.name === 'chain' || s.name === 'signal-path')) {
  try {
    execFileSync('node', ['scripts/callout.mjs'], { stdio: 'inherit' })
  } catch {
    failed.push('callout')
  }
}
rmSync(tmpDir, { recursive: true, force: true })
if (server !== null) process.kill(-server.pid)
console.log(
  failed.length === 0
    ? `\n${shots.length} shots done`
    : `\n${failed.length} failed: ${failed.join(', ')}`,
)
process.exit(failed.length === 0 ? 0 : 1)

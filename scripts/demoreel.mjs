import puppeteer from 'puppeteer-core'

import { CHROME, launchFirefox } from './browser.mjs'
import { CLIPS, demos, S3_PREFIX } from './demos.mjs'
import { installHelpers } from './drive.mjs'
import { flag, sleep } from './harness.mjs'
import { appUp } from './until.mjs'

// Record the demos as short mp4 loops for the landing page.
//
// `demos.json` is the list, and a demo in it is fully declarative — `?p=` packs
// the whole board, `?mod=` the modulation, `?src=`/`?srcb=` the sources — which
// is why nothing here clicks the UI or uploads a file. Only the query is used:
// the origin is always this run's base, which is what lets the list be recorded
// against a worktree's server on another port.
//
// Usage: node scripts/demoreel.mjs [--base=URL] [--out=DIR] [--browser=chrome|firefox]
//        [--keep] [--no-upload] [name...]
//   (needs dev server + a browser, ffmpeg and cwebp on PATH). Writes
//   <slug>.mp4 and <slug>.webp — the still, so the page can show every demo
//   without fetching a dozen videos. Name demos to record a subset, which is
//   the usual run: one new look, not the reel.
//
// **Frames are stepped and shot, not streamed**, the way `appreel.mjs` does it
// and for a reason measured on the clips this replaced. This recorded the
// canvas through `captureStream`, which samples on paint: the engine was
// stepped from a `setInterval` and whatever the compositor had painted by the
// time the sampler looked is what landed in the file. Differencing the shipped
// set frame by frame in RGB, 42 to 79 per cent of every clip was a *frozen*
// frame — `laser-duck` held one picture for 6.3 of its 7.9 seconds and then
// moved, `chaos-black-and-white-feedback` alternated moving and still frames
// down its whole length. Encoding at 24 from a 30fps stream resampled the
// judder on top of that.
//
// So each output frame is a screenshot of the canvas taken after the engine has
// been stepped a fixed number of frames. The clip is exactly `FPS` frames a
// second of exactly `STEPS` engine frames each, whatever the box was doing at
// the time — which is what makes a recording reproducible, and what makes a
// clip that *does* sit still evidence about the look rather than about the
// machine.
//
// That needs the live rAF loop out of the way, or it renders frames of its own
// between the stepped ones — `record()` calls `pauseLoop()` before stepping
// and `resumeLoop()` after, the same half of the switch `ui/render.ts` throws
// for an offline render, and for the same reason: two drivers of `this.frame`
// make a stepped clip no more deterministic than the `captureStream` it
// replaced. Not the other half, `startTake` — its `resetSignal` hits a real
// bug on the caption decoder, unrelated to this and worth its own fix.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { platform } from 'node:process'

const argv = process.argv.slice(2)
const base = flag('base', 'http://localhost:5199/app/')
const outDir = flag('out', 'public/demos')
// Chrome on macOS, Firefox Nightly elsewhere — the same split `appreel.mjs`
// makes and for its reasons (CLAUDE.md § Testing WebGPU).
const engine = flag('browser', platform === 'darwin' ? 'chrome' : 'firefox')
// Leave the frames behind, and say where: an encode is a knob worth trying more
// than once, and driving the browser again for each try is minutes a go.
const keep = argv.includes('--keep')
// Record and encode without sending the clip to the bucket, for a look that has
// not been judged yet. The page reads the clip off the bucket, so a clip that
// stays local is not reachable from a card until it is uploaded by hand.
const upload = !argv.includes('--no-upload')
const only = argv.filter(a => !a.startsWith('--'))

// A demo whose picture comes down off the network before it is a picture.
const REMOTE = /ia-random|[iv]url=http/

// A feedback look is mostly *history*: the frame store has to fill before the
// picture is the one the link promises, and a clip that starts at the first
// frame opens on a flat field and blooms into the look, which reads as a bug.
// So every demo is stepped well past that before the first frame is shot.
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
// app it advertises. 640 wide at crf 33 is the size that answered that, and on
// this material the loss is not visible at card size: what these clips are made
// of is noise and scanlines, and the noise survives — it is the flat fields
// between them that a codec spends bits on. 5:4 is the canvas's own shape and
// the card's, so nothing is cropped.
const CLIP = { w: 640, h: 512 }

// 30 rather than the 24 this shipped at, now that a frame rate is a real
// choice: with the capture stepped, `FPS` is what the clip *is* rather than
// what a resampler tried to reach, and 30 into `STEPS` of 2 is exactly the
// 60Hz the app runs at — no slow-motion fudge factor in either direction.
const FPS = 30
// Reference engine ticks per output frame at timeScale 1. `record()` scales
// this by the live `timeScale` control before deciding whether a tick becomes
// a `step()`, because `step()` itself forces a step past `timeScale`
// (`pipeline.ts`'s `render()` gates on it, `step()` bypasses that gate) — a
// demo like `My lord`, parked at `timeScale:0.45` so it crawls, was recording
// at full rate and playing back over twice its real speed.
const STEPS = 2
// The rate a reference tick stands for: 60, the app's own. The virtual clock
// and the pump's take clock both count ticks at it, so tick N, counted from the
// start of the warm-up, is N / 60 seconds into the source clip.
const TICK_FPS = FPS * STEPS

// Recorded well above what is shipped: the clip is scaled down afterwards, and
// a downscale is what hides the compression the capture itself put in. `dpr`
// is where that headroom comes from now — a screenshot is CSS pixels times the
// scale factor, so the canvas comes back at twice its box and lands on 640
// with room to spare.
const VIEWPORT = { width: 1100, height: 620, dpr: 2 }

async function record(demo, tmpDir) {
  const browser = await (engine === 'chrome'
    ? puppeteer.launch({
        browser: 'chrome',
        executablePath: CHROME,
        headless: false,
        // Two demos point a "camera" at the picture; a fake device keeps that
        // from blocking on a permission prompt nobody is there to answer.
        args: [
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
        ],
      })
    : launchFirefox({ media: true }))
  try {
    const page = await browser.newPage()
    // Before `goto`, and never after it: a `setViewport` on a loaded page swaps
    // the realm under Firefox BiDi and every later `evaluate` sees `window.vf`
    // as undefined, which reads exactly like the app failing to boot.
    await page.setViewport({
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: VIEWPORT.dpr,
    })
    // `domcontentloaded` rather than `networkidle0`: a demo whose source is a
    // remote file streams it, so the connection never goes idle and the load
    // times out at 30s with the app running perfectly well behind it.
    await page.goto(`${base}${demo.query}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForSelector('canvas')
    if ((await appUp(page, 12000)) !== true) {
      throw new Error('app never came up')
    }
    // `faultcheck.mjs` measured this one: stepping a background tab's canvas
    // costs far more than it looks, because nothing is consuming the
    // swapchain and submission itself backs up — and, worse, an unfocused
    // WebGPU canvas can hand back a present texture that is not renderable at
    // all.
    await page.bringToFront()
    // Engine init, plus the source fetch. A demo pulling a file off Commons or
    // rolling one off archive.org is a network round trip — and a whole-file
    // one, since neither is fetched a frame at a time — before there is a
    // picture to record.
    await sleep(REMOTE.test(demo.query) ? 15000 : 5000)
    await page.evaluate(installHelpers)

    // `step()` forces a sim step past the frame lock, but the rAF loop this
    // page booted is still running underneath it — pipeline.ts's own
    // `pauseLoop` comment says as much: two runs of the same take step
    // different totals with it left on, which for a recording means extra,
    // uncounted frames landing between the stepped ones.
    //
    // Not `startTake`: its `resetSignal` reaches a real pipeline bug on any
    // demo with the caption decoder on (`cc:1`, as `My lord` is) — a texture
    // it clears comes back missing `RENDER_ATTACHMENT` and the next pass into
    // it throws. `pauseLoop` alone doesn't touch that path.
    //
    // The two-rAF wait is `faultcheck.mjs`'s, not a fixed sleep: `pauseLoop`
    // drops a flag rather than cancelling the chains (`renderloop.ts`), so up
    // to two frames already scheduled land after it returns, and only rAF
    // itself says when they have.
    await page.evaluate(() => window.vf?.pauseLoop())
    await page.evaluate(
      () =>
        new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
    )

    // **A `<video>` source is pulled a frame at a time.** Its element decodes
    // at wall rate, and a capture runs several times slower than real time.
    // Left to the element, `Wonkitize me`'s source advanced 0.113s per output
    // frame against a real 0.033s, and a frame store recording every N frames
    // spaced its strobed copies far wider than they are live.
    //
    // `vf.pump.setTakeFps` is the video half of `startTake`, and this calls it
    // on its own, reaching `vf.pump` the way `rendercheck.mjs` does. Under it
    // the pump draws each deck's picture from the tick passed to `pullVideo`,
    // as `ui/render.ts` does. The warm-up runs on the same clock, so the history
    // it builds and the clip share one source timeline.
    //
    // `openPullFromUrl` demuxes MP4 and WebM, and declines anything else, such
    // as an ogv off archive.org. For those decks the opener below steps a
    // second element to each wanted time.
    await page.evaluate(fps => {
      const vf = window.vf
      const app = vf.pump.opener
      const seekPull = async url => {
        const el = document.createElement('video')
        el.muted = true
        el.preload = 'auto'
        el.crossOrigin = 'anonymous'
        el.src = url
        const ok = await new Promise(r => {
          el.addEventListener('loadeddata', () => r(true), { once: true })
          el.addEventListener('error', () => r(false), { once: true })
        })
        if (!ok) return null
        // The clip's frame length, learnt from the steps; a guess until then.
        let frame = 1 / 30
        return {
          duration: el.duration,
          codedWidth: el.videoWidth,
          codedHeight: el.videoHeight,
          // A tick moves the playhead a fraction of a frame, and a seek on a
          // file with sparse keyframes decodes from the last one: seeking every
          // tick ran a `Wonkitize me` warm-up past puppeteer's protocol
          // timeout. So the element stays on its frame until the playhead
          // reaches the next, steps forward with Firefox's `seekToNextFrame`,
          // and seeks only to go back or jump.
          frameAt: async t => {
            const within = (promise, what) => {
              let timer
              return Promise.race([
                promise,
                new Promise((_, reject) => {
                  timer = setTimeout(
                    () => reject(new Error(`${what} timed out at ${t}s`)),
                    10000,
                  )
                }),
              ]).finally(() => clearTimeout(timer))
            }
            const stepping = typeof el.seekToNextFrame === 'function'
            const ahead = t - el.currentTime
            if (stepping && ahead > -1e-3 && ahead < 1) {
              while (t - el.currentTime >= frame / 2) {
                const was = el.currentTime
                await within(el.seekToNextFrame(), 'seekToNextFrame')
                if (el.currentTime <= was) break
                frame = Math.min(0.1, Math.max(1 / 120, el.currentTime - was))
              }
            } else if (Math.abs(ahead) >= frame / 2) {
              const seeked = within(
                new Promise(r =>
                  el.addEventListener('seeked', r, { once: true }),
                ),
                'seek',
              )
              el.currentTime = t
              await seeked
            }
            return new VideoFrame(el, { timestamp: Math.round(t * 1e6) })
          },
          close: () => el.removeAttribute('src'),
        }
      }
      vf.setVideoPullOpener(
        async url => (await app?.(url)) ?? (await seekPull(url)),
      )
      vf.pump.setTakeFps(fps)
    }, TICK_FPS)

    // Each reference tick banks `timeScale` (mirroring `simAcc` in
    // `pipeline.ts`'s `render()`) and steps the engine only once the bank
    // reaches 1. An unstepped tick reproduces `presentHeld()`, where the frame
    // just sits. The source is pulled at the tick and not at the step, because
    // live a deck plays at wall rate whatever `timeScale` does to the sim. The
    // warm-up and the clip share one tick counter, which lives on the page and
    // starts fresh with it.
    await page.evaluate(() => {
      let acc = 0
      let tick = 0
      window.__demoTicks = async n => {
        for (let i = 0; i < n; i++, tick++) {
          acc += window.vf.getControls().timeScale
          if (acc < 1) continue
          acc -= 1
          await window.vf.pullVideo(tick)
          window.vf.step()
        }
      }
    })
    // The warm-up goes in one-second calls. On a webm deck it is 500 seeks,
    // and as one call a clip with sparser keyframes than `Wonkitize me`'s
    // would run past puppeteer's 180s protocol timeout.
    for (let t = 0; t < WARM; t += TICK_FPS) {
      await page.evaluate(
        n => window.__demoTicks(n),
        Math.min(TICK_FPS, WARM - t),
      )
    }

    // A dead capture is worth catching here rather than in the encode: a clip
    // of a stage that threw is eight seconds of black, and the poster drawn
    // from it is black too.
    const health = await page.evaluate(() => window.__ds.health())
    if (health.err !== '') throw new Error(`stage error: ${health.err}`)
    if (health.peak <= 0) throw new Error('dead frame — nothing rendered')

    // Everything the stage draws over the picture — toasts, the caption, the
    // frame overlays — is a sibling of the canvas, and none of it belongs in a
    // clip of the picture.
    await page.evaluate(() => window.__ds.bareCanvas())

    // The frame-counted clock, switched on here and not before the warm-up: the
    // warm-up is for the look to settle, and the deck display and the tracking
    // kick it arms should start with the first frame of the clip, not eight
    // seconds earlier. Switching restarts whatever the wall clock had armed.
    await page.evaluate(fps => window.vf?.setVirtualClock(fps), TICK_FPS)

    const canvas = await page.$('canvas')
    const box = await canvas.boundingBox()
    const frames = SECS * FPS
    for (let n = 0; n < frames; n++) {
      await page.evaluate(async k => {
        await window.__demoTicks(k)
        await new Promise(r => setTimeout(r, 4))
      }, STEPS)
      // JPEG rather than PNG for the intermediates, which is not a quality
      // question at this quality — it is a third of the time a frame, measured
      // in `appreel.mjs`, and the h264 encode after it loses more than the
      // intermediate does.
      await canvas.screenshot({
        path: join(tmpDir, `f${String(n).padStart(4, '0')}.jpg`),
        type: 'jpeg',
        quality: 94,
      })
    }
    // Left as found: the loop goes back to rAF, the same contract
    // `ui/render.ts` keeps after a take.
    await page.evaluate(() => window.vf?.setVirtualClock(null))
    await page.evaluate(() => window.vf?.pump.setTakeFps(null))
    await page.evaluate(() => window.vf?.resumeLoop())
    return { frames, box }
  } finally {
    await browser.close().catch(() => {})
  }
}

// All three are wanted at the end of a run that takes a browser recording per
// demo to reach it, so they are checked at the start of it. `aws` is in the
// list because the clip only exists on the bucket: a run that records fine and
// then cannot upload has produced a card pointing at a 404, and it should say
// so before spending the recordings rather than after.
for (const bin of upload ? ['ffmpeg', 'cwebp', 'aws'] : ['ffmpeg', 'cwebp']) {
  execFileSync('sh', ['-c', `command -v ${bin}`], { stdio: 'ignore' })
}

const wanted = demos.filter(d => !only.length || only.includes(d.file))
mkdirSync(outDir, { recursive: true })
console.log(`${wanted.length} demos → ${outDir}/ (${engine}, ${FPS}fps)`)

let failed = 0
for (const demo of wanted) {
  const tmpDir = mkdtempSync(join(tmpdir(), `demoreel-${demo.file}-`))
  try {
    // Retried, because a capture is a browser launch, a page load and a source
    // fetch before it is a recording, and any of the three can lose a race on a
    // loaded box — a run of the whole list hit `Navigation timeout of 30000 ms`
    // on a demo that had recorded cleanly on its own minutes earlier. The
    // stepping itself does not need this: it is the setup around it that is
    // flaky, so what a retry buys is another go at the setup.
    let last
    let got = null
    for (let attempt = 0; attempt < 3 && got === null; attempt++) {
      got = await record(demo, tmpDir).catch(e => {
        last = e
        return null
      })
    }
    if (got === null) throw last
    const { frames, box } = got
    // The canvas is the app's own 5:4 and the card is too, so a scale to
    // `CLIP` is a resize and not a crop. Said out loud rather than assumed:
    // a layout change that squares the canvas would otherwise quietly ship a
    // gallery of stretched pictures.
    const aspect = box.width / box.height
    if (Math.abs(aspect - CLIP.w / CLIP.h) > 0.02) {
      console.log(
        `    note: canvas is ${box.width}x${box.height} (${aspect.toFixed(3)}), not 5:4 — ${demo.file} will be stretched`,
      )
    }
    const mp4 = `${outDir}/${demo.file}.mp4`
    // prettier-ignore
    execFileSync('ffmpeg', ['-y', '-v', 'error',
      '-framerate', String(FPS), '-start_number', '0',
      '-i', join(tmpDir, 'f%04d.jpg'), '-an',
      '-vf', `scale=${CLIP.w}:${CLIP.h}:flags=lanczos`,
      '-c:v', 'libx264', '-crf', '33', '-preset', 'veryslow',
      '-profile:v', 'main', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', mp4])
    // The still is the frame ffmpeg judges most representative of the whole
    // clip, not one at a fixed timestamp. These looks are not evenly interesting
    // over their length — a tape wow drags the picture through a dark trough and
    // back — so a fixed seek lands on whatever the look happened to be doing at
    // that second, and landed on black for three of them.
    // prettier-ignore
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4,
      '-vf', `thumbnail=${frames}`, '-frames:v', '1',
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
    const kb = n =>
      Math.round(statSync(`${outDir}/${demo.file}.${n}`).size / 1024)
    console.log(
      `  ✓ ${demo.file} — ${frames} frames, ${kb('mp4')}K mp4, ${kb('webp')}K still`,
    )
    if (!upload) {
      console.log(`    kept local: ${outDir}/${demo.file}.mp4`)
      continue
    }
    // Up it goes, the way `appreel.mjs` sends the carousel's. The still stays
    // on disk and in the history; the mp4 is on the bucket and gitignored, so
    // this is not an extra step at the end of a take but the step that makes
    // the recording reachable at all.
    execFileSync(
      'aws',
      [
        's3',
        'cp',
        `${outDir}/${demo.file}.mp4`,
        S3_PREFIX,
        '--profile',
        'colin',
        '--only-show-errors',
      ],
      { stdio: 'inherit' },
    )
    console.log(`    ↑ ${CLIPS}${demo.file}.mp4`)
  } catch (e) {
    console.log(`  FAIL ${demo.file}: ${String(e).slice(0, 200)}`)
    failed++
  } finally {
    if (keep) {
      console.log(`    frames kept in ${tmpDir}`)
    } else {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  }
}

if (failed > 0) {
  console.log(`${failed} of ${wanted.length} demos failed`)
  process.exitCode = 1
}

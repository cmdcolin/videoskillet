// Record the app's own window — chrome, panel, picture and a hand on it — for
// the landing page's carousel. `reel.mjs` is the list; this drives it.
//
// Usage: node scripts/appreel.mjs [--base=URL] [--out=DIR] [--check] [--keep] [file...]
//   needs the dev server (pnpm dev), Firefox Nightly, ffmpeg and cwebp. Names
//   filter the run: `node scripts/appreel.mjs control`.
//
// **Frames are stepped and shot, not streamed.** `demoreel.mjs` records the
// canvas through `captureStream`, which samples on paint — so it needs to own
// the only window on screen, because an occluded one paints at about 1Hz
// (docs/DEVELOPMENT.md). There is no equivalent for a whole window: a
// `getDisplayMedia` capture wants a permission nobody is there to answer, and
// nothing else in the page can see the panel beside the canvas. So each output
// frame here is a screenshot, taken after the engine has been stepped a fixed
// number of frames, and the result is a clip of exactly `FPS` frames a second
// whatever the box was doing at the time. That is worth more than the
// convenience: the recording is deterministic, and it does not care whether the
// window is in front.
//
// JPEG rather than PNG for those intermediate frames, which is not a quality
// question at this quality — it is 96ms a frame against 314ms, measured, and
// the h264 encode after it loses more than the intermediate does.
//
// A timeline verb, one beat at a time (`act` in reel.mjs):
//
//   { hold: secs }               the picture moves, nothing else does
//   { scrollTo: target, secs, to }
//                                walk the panel until a target is in the middle
//                                of it, which most control rows need — or to a
//                                given scrollTop, which is how a timeline comes
//                                home
//   { moveTo: target, secs }     glide the pointer onto a target, eased. A
//                                target is `{ stage }` for a box on the signal
//                                path map, `{ slider }` for a control row by
//                                its label, or anything `drive.mjs` resolves.
//   { press: secs, on }          click whatever the pointer is over, then dwell
//                                there. `on` is what that had better be.
//   { drag: { slider, to }, secs }
//                                walk a slider to `to` — a fraction of its own
//                                travel — with the pointer on the thumb
//   { away: secs }               glide the pointer off the frame and drop it
//
// The pointer is drawn by the page (`installReel` below) rather than being the
// real one: a screenshot never contains the OS cursor, so a clip of somebody
// dragging a slider would otherwise show a slider moving itself. The clicks
// under it are real.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { installHelpers, SEED, seedStorage, step } from './drive.mjs'
import { beatSecs, FRAME, NARROW, slides } from './reel.mjs'
import { appUp } from './until.mjs'

import { execFileSync } from 'node:child_process'
import {
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
const base = flag('base', 'http://localhost:5199/app/')
const outDir = flag('out', 'public/reel')
const check = argv.includes('--check')
// Leave the frames behind, and say where. An encode is a knob (fps, crf, the
// codec itself) worth trying more than once, and driving the browser again for
// each try is a minute a go and a different set of frames to compare against.
const keep = argv.includes('--keep')
const only = argv.filter(a => !a.startsWith('--'))

const FPS = 24
// Engine frames per output frame. 60/24 would be real time; two is a shade
// slower than the app runs, which is the right side to err on — a picture that
// is a field of noise reads as faster than it is, and these loop.
const STEPS = 2
// The picture is noise and the panel is flat colour, and it turns out they do
// not pull against each other at all. The panel is *static*: h264 codes that
// half of the frame once and the following frames leave it alone, so raising
// the quantizer spends its losses almost entirely on the picture — the 11px
// labels at crf 36 are the same pixels as at crf 30, checked on a 1:1 crop, and
// the heaviest slide went 645K to 268K. What crf 38 and 40 take is the fine
// dropout speckle, which is the thing the app is *for*, so this stops here.
//
// Two encoder knobs that look like savings and are not. Dropping the frame rate
// saves nothing: CRF is normalized against time, so 20fps at the same crf
// spends the same bits on fewer frames and comes out slightly *larger*. And
// neither AV1 (svt, crf 50: 290K) nor VP9 (libvpx, crf 42: 1.6M) beat x264 on
// this material — a field of analog noise is where AV1's tools have least to
// work with — so the page stays one file per slide with no <source> fallbacks.
const CRF = 36
// The still under the clip — what ships to a reader who asked for reduced
// motion, and what stands in until the clip has opened. Higher than the
// gallery's 72: that one is a field of noise where ringing hides, and this one
// has the app's type in it.
const STILL_Q = 84

const sleep = ms => new Promise(r => setTimeout(r, ms))
// Cosine ease. A pointer that starts and stops abruptly reads as a jump cut
// even at 24fps, and the whole point of drawing it is that it looks like a hand.
const ease = t => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, t))) / 2
const lerp = (a, b, t) => a + (b - a) * t

// ---------------------------------------------------------------- page side

// The pointer, the map's boxes and a slider by the name on its row. Injected as
// source like `drive.mjs`'s helpers, so it closes over nothing out here — the
// one argument says whether the hand in the picture is a mouse or a thumb.
function installReel(touch) {
  const CURSOR = 'reel-cursor'
  const TOUCH = touch === true

  // A box on the signal path map. They are `<g role=button>`, so the click goes
  // on the element and the diagram's own layout stops mattering.
  //
  // **Aimed at the label, not the group.** A press is `elementFromPoint` under
  // the drawn pointer, and the pointer is put at the centre of whatever this
  // returns — which for the two loop pills is a 271x38 rectangle, because the
  // <g> carries the dotted band the pill rides on as well as the pill. Its
  // centre is out on the band, `elementFromPoint` finds a bare <path> there,
  // and the click is a silent no-op that only shows up as the rest of the
  // timeline being wrong. Every box on the map has a <text> with its own name
  // in it, inside the element that takes the click, and on the trunk boxes that
  // is where the centre already was.
  const stageBox = name => {
    const want = name.trim().toLowerCase()
    const box = [...document.querySelectorAll('g[role="button"]')].find(g =>
      (g.textContent ?? '').trim().toLowerCase().startsWith(want),
    )
    if (box === undefined) {
      throw new Error(`no ${name} box on the map`)
    }
    const label = [...box.querySelectorAll('text')].find(t =>
      (t.textContent ?? '').trim().toLowerCase().startsWith(want),
    )
    return label ?? box
  }

  // A slider by the name on its row, which takes joining the row back up: a
  // control row is labelled by *two* labels pointing at the same input — the
  // name up to its last word, then that word beside the reading — so the row
  // called "horizontal hold" answers to `label` texts of 'horizontal' and
  // 'hold 0.35'. Matching either one alone finds the wrong row or none.
  const slider = label => {
    const want = label.trim().toLowerCase()
    const rows = new Map()
    for (const lab of document.querySelectorAll('label[for]')) {
      rows.set(
        lab.htmlFor,
        `${rows.get(lab.htmlFor) ?? ''} ${lab.textContent ?? ''}`,
      )
    }
    const hit = [...rows].find(([, text]) =>
      text.replaceAll(/\s+/g, ' ').trim().toLowerCase().startsWith(want),
    )
    const el = hit === undefined ? null : document.getElementById(hit[0])
    if (el === null) {
      throw new Error(`no slider “${label}” — is its stage open?`)
    }
    return el
  }

  // Where the thumb sits at a fraction of the travel, which is where a hand
  // dragging it would be. The 14px is the thumb's own width: at 0 its centre is
  // half a thumb in from the end of the track rather than on it.
  const thumbAt = (el, frac) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + 7 + frac * (r.width - 14), y: r.top + r.height / 2 }
  }

  // A slider's travel is read in the input's *own* domain, which on a curved
  // row is 0..1 and not the number the row is showing. A timeline asks for
  // fractions of it, so neither side has to know which kind of row it got.
  const travelOf = el => {
    const min = Number(el.min)
    return {
      min,
      span: Number(el.max) - min,
      at: (Number(el.value) - min) / (Number(el.max) - min),
    }
  }

  const centre = el => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  const elementFor = target =>
    target.stage !== undefined
      ? stageBox(target.stage)
      : target.slider !== undefined
        ? slider(target.slider)
        : window.__ds.elementOf(target)

  // The panel is its own scroll container, and most groups are below its fold —
  // the decoder is the fourth of five in the receiver. So a row is scrolled to
  // rather than reached for, and the scrolling is a beat of its own: nothing
  // here calls `scrollIntoView`, whose jump between two stepped frames is the
  // one cut a recording cannot hide.
  const scroller = el => {
    let box = el.parentElement
    while (box !== null && box.scrollHeight <= box.clientHeight + 1) {
      box = box.parentElement
    }
    return box
  }

  window.__reel = {
    // The hand, drawn into the page. An arrow where a mouse would be holding
    // it, a fingertip where a thumb would: the portrait takes are a phone's
    // layout, and an OS pointer in one of those is a picture of something that
    // does not happen. Both read on a panel of near-black and over a picture
    // that may be a white field a moment later, and both are placed by their
    // own hotspot — the arrow's tip is its corner, the fingertip's is its
    // middle — so the coordinate the recorder presses at is the one it drew.
    cursor: (x, y, pressed) => {
      let el = document.getElementById(CURSOR)
      if (el === null) {
        el = document.createElement('div')
        el.id = CURSOR
        el.style.cssText = `position:fixed;z-index:2147483647;pointer-events:none;width:${TOUCH ? 48 : 34}px;height:${TOUCH ? 48 : 38}px`
        el.innerHTML = TOUCH
          ? `<svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle class="ring" cx="24" cy="24" r="0" fill="none" stroke="#7fd0a0" stroke-width="2" opacity="0" />
          <circle cx="24" cy="24" r="15" fill="rgb(244 244 248 / 28%)" stroke="rgb(244 244 248 / 82%)" stroke-width="2" />
        </svg>`
          : `<svg width="34" height="38" viewBox="0 0 34 38" fill="none">
          <circle class="ring" cx="3" cy="2" r="0" fill="none" stroke="#7fd0a0" stroke-width="2" opacity="0" />
          <path d="M3 1 L3 25 L9.5 18.5 L13.8 26.6 L17.6 24.6 L13.3 16.7 L22.5 16 Z"
            fill="#f4f4f8" stroke="#0b0b0e" stroke-width="1.6" stroke-linejoin="round" />
        </svg>`
        document.body.append(el)
      }
      el.style.left = `${TOUCH ? x - 24 : x}px`
      el.style.top = `${TOUCH ? y - 24 : y}px`
      const ring = el.querySelector('.ring')
      ring.setAttribute('r', pressed ? (TOUCH ? '22' : '13') : '0')
      ring.setAttribute('opacity', pressed ? '0.85' : '0')
    },
    drop: () => document.getElementById(CURSOR)?.remove(),

    // Where a target is, for the pointer to be sent to. A slider answers with
    // its thumb rather than its middle, so the pointer lands where a hand would
    // take hold of it.
    where: target => {
      if (target.slider !== undefined) {
        const el = slider(target.slider)
        return thumbAt(el, travelOf(el).at)
      }
      return centre(elementFor(target))
    },

    // Where the panel is scrolled and where it would have to be for a target to
    // sit in the middle of it, so the recorder can walk between the two. A beat
    // that names its own `to` uses the target only to find the scrolling column
    // — which is how a timeline comes home, since *centring* the top of the
    // panel leaves it a third of a screen short of the top.
    scrollPlan: (target, to) => {
      const el = elementFor(target)
      const box = scroller(el)
      if (box === null) {
        return null
      }
      const gap =
        el.getBoundingClientRect().top +
        el.getBoundingClientRect().height / 2 -
        (box.getBoundingClientRect().top + box.clientHeight / 2)
      return {
        from: box.scrollTop,
        to:
          to ??
          Math.max(
            0,
            Math.min(box.scrollHeight - box.clientHeight, box.scrollTop + gap),
          ),
      }
    },
    scrollTo: (target, top) => {
      const box = scroller(elementFor(target))
      box.scrollTop = top
    },

    // Whatever the drawn pointer is over, clicked. Written this way rather than
    // as a real mouse press so that the hand in the picture and the click under
    // it can never disagree about where it landed — the pointer is taken out of
    // the hit test first, being the topmost thing at its own coordinate.
    pressAt: (x, y) => {
      const el = document.getElementById(CURSOR)
      el.style.display = 'none'
      const hit = document.elementFromPoint(x, y)
      el.style.display = ''
      if (hit === null) {
        throw new Error(`nothing under the pointer at ${x},${y}`)
      }
      hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return hit.textContent?.trim().slice(0, 40) ?? ''
    },

    travel: label => travelOf(slider(label)).at,

    // React owns the range input's value, so a bare `el.value = x` is reverted
    // on the next render — go through the native setter and let React's own
    // listener see the event, which is what `drive.mjs` says for the same
    // reason about docshots' actions.
    setTravel: (label, frac) => {
      const el = slider(label)
      const { min, span } = travelOf(el)
      const step = Number(el.step)
      // Snapped to the step grid *through* the minimum, and then trimmed of
      // float error: a plain `round(raw / step) * step` hands back
      // 1.0000000000000002 for a row whose stock is 1, which the panel reads as
      // a control that has been moved — so a drag back to where it started left
      // the board one off stock and a ↺ lamp on the row.
      const grid = min + Math.round((min + frac * span - min) / step) * step
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set.call(el, String(Number(grid.toPrecision(12))))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return thumbAt(el, frac)
    },
  }
}

// ---------------------------------------------------------------- node side

// One beat, frame by frame. The only state a timeline carries between beats is
// `hand` — where the pointer was left, and whether it is down.
async function runBeat(page, beat, frame, hand, shoot) {
  const frames = Math.max(1, Math.round(beatSecs(beat) * FPS))

  if (beat.scrollTo !== undefined) {
    const plan = await page.evaluate(
      (t, to) => window.__reel.scrollPlan(t, to),
      beat.scrollTo,
      beat.to,
    )
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames)
      // A null plan is a panel with nothing to scroll, and the beat is a still
      // one rather than a crash: the same timeline is recorded at two widths,
      // and a row below the fold on a phone is a row already on screen in a
      // 1112px window. Holding for the beat's own seconds keeps the two takes
      // the same length, which is what the page advances the stage on.
      if (plan !== null) {
        await page.evaluate(
          (target, top) => window.__reel.scrollTo(target, top),
          beat.scrollTo,
          lerp(plan.from, plan.to, t),
        )
      }
      await paint(page, hand)
      await shoot()
    }
  } else if (beat.moveTo !== undefined) {
    const to = await page.evaluate(t => window.__reel.where(t), beat.moveTo)
    // A pointer with no previous position comes in from under the frame rather
    // than appearing on its target, which is a cut.
    const from = hand.at ?? { x: to.x, y: frame.height + 30 }
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames)
      hand.at = { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) }
      await paint(page, hand)
      await shoot()
    }
  } else if (beat.drag !== undefined) {
    const from = await page.evaluate(
      s => window.__reel.travel(s),
      beat.drag.slider,
    )
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames)
      hand.at = await page.evaluate(
        (s, f) => window.__reel.setTravel(s, f),
        beat.drag.slider,
        lerp(from, beat.drag.to, t),
      )
      hand.down = true
      await paint(page, hand)
      await shoot()
    }
    hand.down = false
  } else if (beat.press !== undefined) {
    const hit = await page.evaluate(
      (x, y) => window.__reel.pressAt(x, y),
      hand.at.x,
      hand.at.y,
    )
    if (
      beat.on !== undefined &&
      !hit.toLowerCase().startsWith(beat.on.toLowerCase())
    ) {
      // A click that finds nothing must fail where it happened: these press
      // whatever is under the pointer, so a box that moved makes the press a
      // silent no-op and the *rest* of the timeline the thing that looks wrong.
      throw new Error(`pressed “${hit}”, wanted ${beat.on}`)
    }
    for (let i = 1; i <= frames; i++) {
      // The ring is the press, not a state: it lands with the click and is gone
      // in three frames, which is what a click looks like.
      hand.down = i <= 3
      await paint(page, hand)
      await shoot()
    }
    hand.down = false
  } else if (beat.away !== undefined) {
    const from = hand.at
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames)
      hand.at = { x: from.x, y: lerp(from.y, frame.height + 40, t) }
      await paint(page, hand)
      await shoot()
    }
    hand.at = undefined
    await paint(page, hand)
  } else {
    for (let i = 1; i <= frames; i++) {
      await paint(page, hand)
      await shoot()
    }
  }
}

const paint = (page, hand) =>
  hand.at === undefined
    ? page.evaluate(() => window.__reel.drop())
    : page.evaluate(
        (x, y, down) => window.__reel.cursor(x, y, down),
        hand.at.x,
        hand.at.y,
        hand.down === true,
      )

async function record(browser, slide, take, tmpDir) {
  const page = await browser.newPage()
  try {
    // Before `goto`, and never after it: a `setViewport` on a loaded page swaps
    // the realm under Firefox BiDi and every later `evaluate` sees `window.vf`
    // as undefined, which reads exactly like the app failing to boot.
    await page.setViewport({
      width: take.frame.width,
      height: take.frame.height,
      deviceScaleFactor: take.frame.dpr,
    })
    await page.evaluateOnNewDocument(seedStorage, {
      ...SEED,
      // The preset gesture hint teaches something real and is dismissible, so
      // in a recording it is a row of chrome with an ✕ on it that nobody in the
      // clip is going to press.
      video_feedback_preset_hint_dismissed: '1',
      ...slide.seed,
    })
    await page.goto(`${base}${slide.query}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('canvas')
    if ((await appUp(page, 12000)) !== true) {
      throw new Error('app never came up')
    }
    // The engine builds its pipeline and fetches the source asynchronously, and
    // there is no ready event to wait on.
    await sleep(3000)
    await page.evaluate(installHelpers)
    await page.evaluate(installReel, take.frame.coarse === true)
    await step(page, slide.warm ?? 90)

    const health = await page.evaluate(() => window.__ds.health())
    if (health.err !== '') throw new Error(`stage error: ${health.err}`)
    if (health.peak <= 0) throw new Error('dead frame — nothing rendered')

    let n = 0
    const shoot = async () => {
      await page.evaluate(async k => {
        for (let i = 0; i < k; i++) window.vf?.step()
        await new Promise(r => setTimeout(r, 4))
      }, STEPS)
      await page.screenshot({
        path: join(tmpDir, `f${String(n++).padStart(4, '0')}.jpg`),
        type: 'jpeg',
        quality: 94,
      })
    }

    const hand = {}
    for (const beat of take.act)
      await runBeat(page, beat, take.frame, hand, shoot)
    return n
  } finally {
    await page.evaluate(() => window.vf?.destroy()).catch(() => {})
    await page.close().catch(() => {})
  }
}

// What a recording was taken against, the way `docshots.mjs` records it and for
// the same reason: these pictures carry the app's own masthead with the version
// printed in it, so a clip from two releases ago is visibly a clip of a
// different program, and nothing but a rerun can notice. Cheap to write, and
// `--check` reads it back without a browser or a server.
const MANIFEST = 'scripts/reel-taken.json'
const capturedAt = () => ({
  version: JSON.parse(readFileSync('package.json', 'utf8')).version,
  sha: execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
})
const readManifest = () =>
  existsSync(MANIFEST)
    ? new Map(Object.entries(JSON.parse(readFileSync(MANIFEST, 'utf8'))))
    : new Map()

// How far the app has moved since a clip was taken, counted in commits that
// touched src/. A docs-only commit does not date a picture of the UI.
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

if (check) {
  const now = capturedAt()
  const manifest = readManifest()
  const stale = slides
    .map(slide => {
      const was = manifest.get(slide.file)
      if (was === undefined) return `${slide.file}: never recorded`
      if (was.version === now.version) return null
      const n = movedSince(was.sha)
      const moved =
        n === null ? '' : `, ${n} src commit${n === 1 ? '' : 's'} since`
      return `${slide.file}: taken at v${was.version}${moved}`
    })
    .filter(row => row !== null)
  if (stale.length === 0) {
    console.log(`the reel is current at v${now.version}`)
  } else {
    console.log(`the reel shows an older app — rerun \`pnpm reel\`:`)
    for (const row of stale) console.log(`  ${row}`)
  }
  process.exit(0)
}

for (const bin of ['ffmpeg', 'cwebp']) {
  execFileSync('sh', ['-c', `command -v ${bin}`], { stdio: 'ignore' })
}

const wanted = slides.filter(s => only.length === 0 || only.includes(s.file))
mkdirSync(outDir, { recursive: true })
console.log(`${wanted.length} slides → ${outDir}/`)

const taken = Object.fromEntries(readManifest())
const at = capturedAt()

// Every slide is recorded twice: the window as a desktop shows it, and the same
// timeline again at a phone's width, where the app lays itself out in portrait.
// The frames are different sizes, so they are different sessions rather than
// one session resized — `setViewport` after a load swaps the realm under
// Firefox BiDi and takes `window.vf` with it.
const takes = slide => [
  { name: slide.file, frame: FRAME, act: slide.act, out: FRAME },
  {
    name: `${slide.file}-narrow`,
    frame: NARROW,
    act: slide.narrowAct,
    out: NARROW.out,
  },
]

for (const slide of wanted) {
  for (const take of takes(slide)) {
    const tmpDir = mkdtempSync(join(tmpdir(), `reel-${take.name}-`))
    // One browser per take. A single Firefox does not survive a long WebGPU
    // batch — after a dozen or so sessions it detaches the frame and every
    // later page dies with "Target closed" — and a take is a session with
    // several hundred stepped frames in it. The pointer prefs are per browser
    // too: told to report a coarse primary pointer, the app lays its rows out
    // for a thumb, which is what a phone actually gets.
    const browser = await puppeteer.launch({
      browser: 'firefox',
      executablePath: FIREFOX,
      headless: false,
      extraPrefsFirefox: {
        'dom.webgpu.enabled': true,
        'gfx.webgpu.ignore-blocklist': true,
        'media.navigator.streams.fake': true,
        'media.navigator.permission.disabled': true,
        ...(take.frame.coarse === true
          ? {
              'ui.primaryPointerCapabilities': 1,
              'ui.allPointerCapabilities': 1,
            }
          : {}),
      },
    })
    try {
      const frames = await record(browser, slide, take, tmpDir)
      const mp4 = join(outDir, `${take.name}.mp4`)
      const scale =
        take.out.width === take.frame.width * take.frame.dpr
          ? []
          : ['-vf', `scale=${take.out.width}:${take.out.height}:flags=lanczos`]
      // prettier-ignore
      execFileSync('ffmpeg', ['-y', '-v', 'error',
        '-framerate', String(FPS), '-start_number', '0',
        '-i', join(tmpDir, 'f%04d.jpg'), '-an', ...scale,
        '-c:v', 'libx264', '-crf', String(CRF), '-preset', 'veryslow',
        '-profile:v', 'main', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', mp4])
      // The still is a frame from inside the timeline rather than the first:
      // these open on a pointer that has not arrived and a stage nobody has
      // pressed yet, which is the one frame that says least about the slide.
      //
      // Where inside is the slide's own business (`stillAt` in reel.mjs). The
      // middle suits a walk, whose whole length is the same kind of thing
      // happening; it is the wrong frame for a slide that *builds* something,
      // where the middle is a picture on the way to the one the clip is about
      // and the reader who asked for reduced motion never sees the finish.
      const still = join(outDir, `${take.name}.webp`)
      const at = Math.min(
        frames - 1,
        Math.floor(frames * (slide.stillAt ?? 0.55)),
      )
      const middle = join(tmpDir, `f${String(at).padStart(4, '0')}.jpg`)
      // prettier-ignore
      execFileSync('cwebp', ['-quiet', '-q', String(STILL_Q),
        '-resize', String(take.out.width), '0', middle, '-o', still])
      taken[slide.file] = at
      const kb = f => Math.round(statSync(f).size / 1024)
      console.log(
        `  ✓ ${take.name} — ${frames} frames, ${kb(mp4)}K mp4, ${kb(still)}K still`,
      )
    } catch (e) {
      console.log(`  FAIL ${take.name}: ${String(e).slice(0, 200)}`)
    } finally {
      await browser.close().catch(() => {})
      if (keep) {
        console.log(`    frames kept in ${tmpDir}`)
      } else {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    }
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(taken, null, 2)}\n`)

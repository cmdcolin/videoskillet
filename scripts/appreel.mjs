// Record the app's own window — chrome, panel, picture and a hand on it — for
// the landing page's carousel. `reel.mjs` is the list; this drives it.
//
// Usage: node scripts/appreel.mjs [--base=URL] [--out=DIR] [--browser=chrome|firefox]
//        [--check] [--keep] [file...]
//   needs the dev server (pnpm dev), a browser (Chrome on macOS, Firefox
//   Nightly on Linux — see `engine` below), ffmpeg and cwebp. Names
//   filter the run: `node scripts/appreel.mjs control`.
//
// **Frames are stepped and shot, not streamed**, which is how `demoreel.mjs`
// records now too. Each output frame is a screenshot taken after the engine has
// been stepped a fixed number of frames, so a clip is exactly `FPS` frames a
// second whatever the box was doing at the time.
//
// A whole window left no other route to begin with: a `getDisplayMedia` capture
// wants a permission nobody is there to answer, and nothing inside the page can
// see the panel beside the canvas. What the gallery's clips then showed is that
// determinism is the reason to prefer this even where streaming *is* available.
// `captureStream` samples on paint, and the set it recorded shipped with 42 to
// 79 per cent of every clip a frozen frame — `demoreel.mjs` carries the
// measurement.
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
//                                its label, `{ chip }` for a preset chip's
//                                grip, or anything `drive.mjs` resolves.
//   { press: secs, on }          click whatever the pointer is over, then dwell
//                                there. `on` is what that had better be. A
//                                target of `{ choice: { row, pick } }` is one
//                                option of a switch row — `key input` is
//                                self/program — since two rows can offer the
//                                same word and `{ text }` finds the last.
//   { drag: { slider, to }, secs }
//                                walk a slider to `to` — a fraction of its own
//                                travel — with the pointer on the thumb
//   { mix: { chip, to }, secs }  drag a preset chip sideways to blend it in at
//                                `to` of full strength, the way the app's own
//                                gesture does (PresetsSection.tsx: 120px of
//                                travel is 100%). The real mouse does this
//                                one, since the chip integrates pointer
//                                travel and holds capture on it.
//   { away: secs }               glide the pointer off the frame and drop it
//
// The pointer is drawn by the page (`installReel` below) rather than being the
// real one: a screenshot never contains the OS cursor, so a clip of somebody
// dragging a slider would otherwise show a slider moving itself. The clicks
// under it are real.

import puppeteer from 'puppeteer-core'

import { CHROME, FIREFOX } from './browser.mjs'
import { installHelpers, SEED, seedStorage, step } from './drive.mjs'
import { beatSecs, FRAME, NARROW, slides as reel } from './reel.mjs'
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
import { join, resolve } from 'node:path'
import { platform } from 'node:process'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}
const base = flag('base', 'http://localhost:5199/app/')
// Which browser holds the window being recorded. Chrome on macOS, where its
// Metal backend renders the signal path as faithfully as Firefox does and
// screenshots come back quicker; Firefox everywhere else, because on Linux
// Chrome's ANGLE/Vulkan backend reports texture allocations the driver never
// refused and the app spends the recording arguing with it (CLAUDE.md §
// Testing WebGPU). `--browser=` overrides either way, which is how the two are
// compared on the same slide.
const engine = flag('browser', platform === 'darwin' ? 'chrome' : 'firefox')
const outDir = flag('out', 'public/reel')
const check = argv.includes('--check')
// Leave the frames behind, and say where. An encode is a knob (fps, crf, the
// codec itself) worth trying more than once, and driving the browser again for
// each try is a minute a go and a different set of frames to compare against.
const keep = argv.includes('--keep')
// A module exporting `slides` in place of the reel, and which of a slide's two
// takes to record. Together they make this the screen for a slide's rows:
// `pathprobe.mjs` ramps rows on a stepped engine with no wall clock between
// frames, and a feedback loop paced that way lands somewhere the recorded take
// never goes — a three-row backdrop screened pale white where the take shows a
// rainbow. What decides whether a row reads in the clip is the clip, so a
// variant is recorded the way the reel is, wide only, and looked at.
const slidesPath = flag('slides', null)
const takesWanted = flag('takes', 'both')
const slides =
  slidesPath === null
    ? reel
    : (await import(pathToFileURL(resolve(slidesPath)).href)).slides
const only = argv.filter(a => !a.startsWith('--'))

const FPS = 30
// Engine frames per output frame. Two at 30fps is the app's own 60Hz, so the
// picture runs at the speed a visitor would see it run. It was 24fps over the
// same two steps, a fifth slow, picked so a field of noise would not read as
// faster than it is — and the reel dawdled for it, since every beat in it is
// paced in seconds and every second played long.
const STEPS = 2
// The picture is noise and the panel is flat colour, and it turns out they do
// not pull against each other at all. The panel is *static*: h264 codes that
// half of the frame once and the following frames leave it alone, so raising
// the quantizer spends its losses almost entirely on the picture — the 11px
// labels at crf 36 are the same pixels as at crf 30, checked on a 1:1 crop, and
// the heaviest slide went 645K to 268K. What crf 38 and 40 take is the fine
// dropout speckle, which is the thing the app is *for*, so this stops here.
//
// Those runs were the 1x frame. The wide take records at 2x now (`FRAME`), and
// 34 rather than 36 is what that buys back: a quantizer step is coarser in
// absolute terms on a frame with four times the pixels in it, and the dropout
// speckle it eats is the same size on the page as it ever was.
//
// Two encoder knobs that look like savings and are not. Dropping the frame rate
// saves nothing: CRF is normalized against time, so 20fps at the same crf
// spends the same bits on fewer frames and comes out slightly *larger*. And
// neither AV1 (svt, crf 50: 290K) nor VP9 (libvpx, crf 42: 1.6M) beat x264 on
// this material — a field of analog noise is where AV1's tools have least to
// work with — so the page stays one file per slide with no <source> fallbacks.
const CRF = 34
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
    // An exact name first: `MIX` is a prefix of the `mixer` pill, and the pill
    // comes first in the document, so a prefix match alone opened the loop
    // when the stage was asked for.
    const boxes = [...document.querySelectorAll('g[role="button"]')]
    const text = g => (g.textContent ?? '').trim().toLowerCase()
    const box =
      boxes.find(g => text(g).split(/\s+/)[0] === want) ??
      boxes.find(g => text(g).startsWith(want))
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

  // One option of a switch row. The row is a radiogroup carrying its own label,
  // so the option is found under the row rather than by its word alone.
  const choice = ({ row, pick }) => {
    const group = [...document.querySelectorAll('[role="radiogroup"]')].find(
      g =>
        (g.getAttribute('aria-label') ?? '')
          .toLowerCase()
          .startsWith(row.toLowerCase()),
    )
    const el = group?.querySelector(`[role="radio"]`)
      ? [...group.querySelectorAll('[role="radio"]')].find(
          b =>
            (b.textContent ?? '').trim().toLowerCase() === pick.toLowerCase(),
        )
      : undefined
    if (el === undefined) {
      throw new Error(`no “${pick}” on the ${row} switch — is its stage open?`)
    }
    return el
  }

  const elementFor = target =>
    target.stage !== undefined
      ? stageBox(target.stage)
      : target.slider !== undefined
        ? slider(target.slider)
        : target.choice !== undefined
          ? choice(target.choice)
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

  // Where a hand takes hold of a preset chip to drag it: just inside its left
  // edge, so the travel that follows runs across the chip rather than off it.
  const chipGrip = text => {
    const el = window.__ds.elementOf({ text })
    if (el === null || el.textContent.trim() !== text) {
      throw new Error(`no chip “${text}” on the row`)
    }
    const r = el.getBoundingClientRect()
    return { x: r.left + 8, y: r.top + r.height / 2 }
  }

  window.__reel = {
    // The hand, drawn into the page. An arrow where a mouse would be holding
    // it, a fingertip where a thumb would: the portrait takes are a phone's
    // layout, and an OS pointer in one of those is a picture of something that
    // does not happen. Both read on a panel of near-black and over a picture
    // that may be a white field a moment later, and both are placed by their
    // own hotspot — the arrow's tip is its corner, the fingertip's is its
    // middle — so the coordinate the recorder presses at is the one it drew.
    //
    // **A click ripples red for twelve frames.** It was a green ring for three,
    // which is what a click looks like to the hand making it and not to
    // somebody watching a clip of it: "if you are capturing user videos and
    // expecting them to see what you are clicking you might be going a bit too
    // fast potentially. might want to add red 'ripple' to clicks and stuff
    // too". So a press, and the first moment of a drag, throw a red ring that
    // grows and fades over 0.4s, and a drag that is being held keeps a steady
    // red ring under the pointer for as long as it is held. Red because the
    // panel is near-black and green, and the picture is anything.
    cursor: (x, y, pressed, ripple) => {
      let el = document.getElementById(CURSOR)
      if (el === null) {
        el = document.createElement('div')
        el.id = CURSOR
        // Oversized so the ripple has room to grow past the pointer.
        el.style.cssText = `position:fixed;z-index:2147483647;pointer-events:none;width:96px;height:96px`
        const c = 48
        el.innerHTML = TOUCH
          ? `<svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <circle class="tap" cx="${c}" cy="${c}" r="0" fill="none" stroke="#ff3b30" stroke-width="3" opacity="0" />
          <circle class="ring" cx="${c}" cy="${c}" r="0" fill="none" stroke="#ff3b30" stroke-width="2.5" opacity="0" />
          <circle cx="${c}" cy="${c}" r="15" fill="rgb(244 244 248 / 28%)" stroke="rgb(244 244 248 / 82%)" stroke-width="2" />
        </svg>`
          : `<svg width="96" height="96" viewBox="0 0 96 96" fill="none">
          <circle class="tap" cx="${c}" cy="${c}" r="0" fill="none" stroke="#ff3b30" stroke-width="3" opacity="0" />
          <circle class="ring" cx="${c}" cy="${c}" r="0" fill="none" stroke="#ff3b30" stroke-width="2.5" opacity="0" />
          <path transform="translate(${c - 3} ${c - 2})" d="M3 1 L3 25 L9.5 18.5 L13.8 26.6 L17.6 24.6 L13.3 16.7 L22.5 16 Z"
            fill="#f4f4f8" stroke="#0b0b0e" stroke-width="1.6" stroke-linejoin="round" />
        </svg>`
        document.body.append(el)
      }
      // The hotspot — the arrow's tip or the fingertip's middle — sits at the
      // box's centre, so the box is placed by that.
      el.style.left = `${x - 48}px`
      el.style.top = `${y - 48}px`
      const ring = el.querySelector('.ring')
      ring.setAttribute('r', pressed ? (TOUCH ? '22' : '13') : '0')
      ring.setAttribute('opacity', pressed ? '0.9' : '0')
      const tap = el.querySelector('.tap')
      if (ripple === null) {
        tap.setAttribute('opacity', '0')
      } else {
        tap.setAttribute(
          'r',
          String((TOUCH ? 18 : 8) + ripple * (TOUCH ? 26 : 30)),
        )
        tap.setAttribute('opacity', String(0.95 * (1 - ripple)))
        tap.setAttribute('stroke-width', String(3.5 - 2 * ripple))
      }
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
      if (target.chip !== undefined) {
        return chipGrip(target.chip)
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

    chipGrip,
    // How far in a chip is after a drag — it carries its own fill as `--w`.
    chipFill: text =>
      window.__ds.elementOf({ text }).style.getPropertyValue('--w'),

    // The hand arriving on the thumb and leaving it. A drag is a pointerdown
    // before the first value and a pointerup after the last, and the app banks
    // its undo step on the first of those (Slider's `onBegin`) — so a drag that
    // is only `input` events leaves `undo` greyed, which is what a take of the
    // hand pressing a dead button looked like.
    takeHold: label =>
      slider(label).dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      ),
    letGo: label =>
      slider(label).dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true }),
      ),

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
// How long a click's ripple lives, in output frames: 0.4s at 30fps.
const RIPPLE = 12
const rippleAt = i => (i <= RIPPLE ? i / RIPPLE : null)

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
    await page.evaluate(s => window.__reel.takeHold(s), beat.drag.slider)
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames)
      hand.at = await page.evaluate(
        (s, f) => window.__reel.setTravel(s, f),
        beat.drag.slider,
        lerp(from, beat.drag.to, t),
      )
      hand.down = true
      hand.ripple = rippleAt(i)
      await paint(page, hand)
      await shoot()
    }
    await page.evaluate(s => window.__reel.letGo(s), beat.drag.slider)
    hand.down = false
    hand.ripple = null
  } else if (beat.mix !== undefined) {
    const grip = await page.evaluate(
      t => window.__reel.chipGrip(t),
      beat.mix.chip,
    )
    // A finger on the phone take, a mouse on the desktop one — and not only
    // for honesty. Under Chrome's phone emulation every `page.screenshot`
    // fires a pointerleave at a position off the page and drops the pointer
    // capture a mouse drag holds, so the chip's fader let go at the first
    // frame and the portrait take shipped every drag at 1%. A touch sequence
    // rides through the screenshots untouched, measured 67% against 8% for
    // the same drag.
    const finger = frame.coarse === true && engine === 'chrome'
    const down = async () => {
      if (finger) {
        await page.touchscreen.touchStart(grip.x, grip.y)
        await page.touchscreen.touchMove(grip.x + 6, grip.y)
      } else {
        await page.mouse.move(grip.x, grip.y)
        await page.mouse.down()
        await page.mouse.move(grip.x + 6, grip.y, { steps: 2 })
      }
    }
    const to = (x, y) =>
      finger ? page.touchscreen.touchMove(x, y) : page.mouse.move(x, y)
    const up = () => (finger ? page.touchscreen.touchEnd() : page.mouse.up())
    await down()
    const travel = beat.mix.to * 120
    for (let i = 1; i <= frames; i++) {
      const t = ease(i / frames)
      hand.at = { x: grip.x + 6 + travel * t, y: grip.y }
      hand.down = true
      hand.ripple = rippleAt(i)
      await to(hand.at.x, hand.at.y)
      await paint(page, hand)
      await shoot()
    }
    await up()
    hand.down = false
    hand.ripple = null
    const fill = await page.evaluate(
      t => window.__reel.chipFill(t),
      beat.mix.chip,
    )
    if (fill === '' || fill === '0%') {
      throw new Error(`dragged “${beat.mix.chip}” and it stayed at ${fill}`)
    }
  } else if (beat.press !== undefined) {
    const hit = await page.evaluate(
      (x, y) => window.__reel.pressAt(x, y),
      hand.at.x,
      hand.at.y,
    )
    // A bank's header leads with its disclosure caret, so `on: 'Deflection'`
    // is checked against the title behind it as well as the raw text — the
    // look bar's own caret button is still asserted as the bare '▾'.
    const said = hit.toLowerCase()
    const want = beat.on?.toLowerCase()
    if (
      want !== undefined &&
      !said.startsWith(want) &&
      !said.replace(/^[▸▾]\s*/, '').startsWith(want)
    ) {
      // A click that finds nothing must fail where it happened: these press
      // whatever is under the pointer, so a box that moved makes the press a
      // silent no-op and the *rest* of the timeline the thing that looks wrong.
      throw new Error(`pressed “${hit}”, wanted ${beat.on}`)
    }
    for (let i = 1; i <= frames; i++) {
      // The ripple is the press, not a state: it lands with the click and has
      // faded by the twelfth frame (`cursor`, above, for why twelve).
      hand.ripple = rippleAt(i)
      await paint(page, hand)
      await shoot()
    }
    hand.ripple = null
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
        (x, y, down, ripple) => window.__reel.cursor(x, y, down, ripple),
        hand.at.x,
        hand.at.y,
        hand.down === true,
        hand.ripple ?? null,
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
      // The phone take's whole point: told the pointer is coarse, the app lays
      // its rows out for a thumb, in `theme.css` and eight component sheets
      // that all read the media query. Chrome answers it off the viewport
      // being a touch one, where Firefox has browser-wide prefs for it — and a
      // touch viewport is the truer emulation of the two, since it carries
      // `hover: none` and a nonzero `maxTouchPoints` with it rather than the
      // one query. `emulateMediaFeatures` is not the way: puppeteer checks
      // names against a fixed list and `pointer` is not on it.
      ...(engine === 'chrome' && take.frame.coarse === true
        ? { hasTouch: true, isMobile: true }
        : {}),
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
    for (const beat of take.act) {
      await runBeat(page, beat, take.frame, hand, shoot)
      // REEL_DEBUG=1 prints, after every beat, which preset chips are lit and
      // how far — the one reading a take cannot be trusted to show, since a
      // chip's fill is what a drag looks like and a frame without it reads as
      // the hand having missed.
      if (process.env.REEL_DEBUG !== undefined) {
        const lit = await page.evaluate(() =>
          [...document.querySelectorAll('button')]
            .map(b => [b.textContent.trim(), b.style.getPropertyValue('--w')])
            .filter(([, w]) => w !== '' && w !== '0%')
            .map(([t, w]) => `${t}=${w}`)
            .join(', '),
        )
        console.log(`    ${JSON.stringify(beat).slice(0, 60)} → ${lit}`)
      }
    }
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

// Entries for slides that are no longer in the reel are dropped rather than
// carried: a run naming one slide has to leave the other two alone, so this
// cannot simply be rebuilt from what the run recorded.
const taken = Object.fromEntries(
  [...readManifest()].filter(([file]) => slides.some(s => s.file === file)),
)
const at = capturedAt()

// Every slide is recorded twice: the window as a desktop shows it, and the same
// timeline again at a phone's width, where the app lays itself out in portrait.
// The frames are different sizes, so they are different sessions rather than
// one session resized — `setViewport` after a load swaps the realm under
// Firefox BiDi and takes `window.vf` with it.
const takes = slide =>
  [
    { name: slide.file, frame: FRAME, act: slide.act, out: FRAME.out },
    {
      name: `${slide.file}-narrow`,
      frame: NARROW,
      act: slide.narrowAct ?? slide.act,
      out: NARROW.out,
    },
  ].filter(
    (take, i) =>
      takesWanted === 'both' || takesWanted === ['wide', 'narrow'][i],
  )

for (const slide of wanted) {
  for (const take of takes(slide)) {
    const tmpDir = mkdtempSync(join(tmpdir(), `reel-${take.name}-`))
    // One browser per take. A single Firefox does not survive a long WebGPU
    // batch — after a dozen or so sessions it detaches the frame and every
    // later page dies with "Target closed" — and a take is a session with
    // several hundred stepped frames in it. The pointer prefs are per browser
    // too: told to report a coarse primary pointer, the app lays its rows out
    // for a thumb, which is what a phone actually gets.
    const launch = () =>
      engine === 'chrome'
        ? puppeteer.launch({
            browser: 'chrome',
            executablePath: CHROME,
            headless: false,
            args: [
              '--use-fake-device-for-media-stream',
              '--use-fake-ui-for-media-stream',
            ],
          })
        : puppeteer.launch({
            browser: 'firefox',
            executablePath: FIREFOX,
            headless: false,
            extraPrefsFirefox: {
              'dom.webgpu.enabled': true,
              'gfx.webgpu.ignore-blocklist': true,
              'media.navigator.streams.fake': true,
              'media.navigator.permission.disabled': true,
              // Chrome says the same thing per page rather than per browser, in
              // `record` — the prefs are a browser-wide switch and there is no
              // Firefox equivalent of `emulateMediaFeatures` under BiDi.
              ...(take.frame.coarse === true
                ? {
                    'ui.primaryPointerCapabilities': 1,
                    'ui.allPointerCapabilities': 1,
                  }
                : {}),
            },
          })
    // **Retried, with a new browser each go.** A take is a browser launch, a
    // page load and several hundred stepped WebGPU frames, and on a loaded box
    // any of those can lose a race: a run of the three slides came back with
    // two `dead frame — nothing rendered` and a `canvas` that never appeared,
    // on slides that had recorded cleanly minutes earlier. The stepping is
    // deterministic; it is the session around it that is not, so what a retry
    // buys is another session. A new browser rather than a new page, because a
    // device that came up dead stays dead for the life of the one that made it
    // (docs/adr/0004).
    let frames = null
    let last
    for (let attempt = 0; attempt < 3 && frames === null; attempt++) {
      const browser = await launch()
      try {
        frames = await record(browser, slide, take, tmpDir)
      } catch (e) {
        last = e
      } finally {
        await browser.close().catch(() => {})
      }
    }
    try {
      if (frames === null) throw last
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
      const posterAt = Math.min(
        frames - 1,
        Math.floor(frames * (slide.stillAt ?? 0.55)),
      )
      const posterFrame = join(
        tmpDir,
        `f${String(posterAt).padStart(4, '0')}.jpg`,
      )
      // prettier-ignore
      execFileSync('cwebp', ['-quiet', '-q', String(STILL_Q),
        '-resize', String(take.out.width), '0', posterFrame, '-o', still])
      // The version and sha this take was recorded against. Named apart from
      // the poster's frame number on purpose: a `const at` here shadowed it,
      // and the manifest went out holding 374 where it should have held a
      // release — which `--check` reads back as `taken at vundefined` and
      // reports every clean tree as stale.
      taken[slide.file] = at
      const kb = f => Math.round(statSync(f).size / 1024)
      console.log(
        `  ✓ ${take.name} — ${frames} frames, ${kb(mp4)}K mp4, ${kb(still)}K still`,
      )
    } catch (e) {
      console.log(`  FAIL ${take.name}: ${String(e).slice(0, 200)}`)
    } finally {
      if (keep) {
        console.log(`    frames kept in ${tmpDir}`)
      } else {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    }
  }
}

// A screen of variants is not the reel, and must not date it.
if (slidesPath === null) {
  writeFileSync(MANIFEST, `${JSON.stringify(taken, null, 2)}\n`)
}

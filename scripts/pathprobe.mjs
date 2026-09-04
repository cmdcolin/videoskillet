// Screen a *timeline*, not a board.
//
// `contact.mjs` renders a candidate by putting the whole board on the URL and
// letting it settle, which is the right instrument for a preset — a preset is a
// board, and whoever clicks the chip gets exactly that load. It is the wrong
// instrument for a carousel slide, and the difference cost a session.
//
// A feedback loop is its own history. Applied at load, a loop grows from an
// empty frame buffer and finds whatever structure its geometry wants; reached
// by dragging the same four rows up in front of a camera, it grows out of
// whatever is already on the tube. Those are not the same picture, and the gap
// is not subtle: the board behind the lead slide screened on the contact sheet
// as a radial starburst on black and recorded as a horizontal smear. It was
// not the ordering either — all eight orders of the same four rows land on the
// same wash, which is what this script was written to find out.
//
// So: walk the rows the way a timeline does, at the timeline's own pace, and
// grab the canvas at the end. No screenshot per frame and no encode, so a
// variant costs seconds where `appreel.mjs` costs ninety, and a dozen of them
// fit in the time one take does.
//
// Usage: node scripts/pathprobe.mjs <variants.mjs> <outDir> [baseUrl]
//   needs the dev server and Firefox Nightly, like every harness here.
//
// The variants module default-exports `[[name, beats], …]`, where a beat is
//
//   { open, row, to, expand }
//
//   open    the map pill to press first — 'camera', 'mixer', a stage box. Only
//           pressed when it is not already the open one.
//   row     the control row by the name on it, the way `appreel.mjs` says it.
//   to      where to drag it, as a fraction of the row's own travel — which on
//           a curved row is not the number the row shows (see travel.ts).
//   expand  a collapsed subsection inside the stage to open first, by its
//           heading. The camera's beam rows live behind TUBE FACE.
//
// Every beat ramps over `RAMP` output frames with two engine steps each, which
// is `appreel.mjs`'s `STEPS` and a 1.4s drag. A picture that only holds up
// under a slower hand is not one this reel can record.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { installHelpers, SEED, seedStorage, step } from './drive.mjs'

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [specPath, outDir, baseArg] = process.argv.slice(2)
if (specPath === undefined || outDir === undefined) {
  console.error(
    'usage: node scripts/pathprobe.mjs <variants.mjs> <outDir> [url]',
  )
  process.exit(1)
}
const base = baseArg ?? 'http://localhost:5199/app/'
const variants = (await import(pathToFileURL(resolve(specPath)).href)).default

const RAMP = 34
const GAP = 12
const HOLD = 43

// The page side: the same two lookups `appreel.mjs` drives the reel with, so a
// variant that probes well is a variant the recorder can actually reach.
function installProbe() {
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
  window.__path = {
    expand: text => {
      const want = text.trim().toLowerCase()
      const el = [
        ...document.querySelectorAll('button,summary,[role="button"]'),
      ].find(b => (b.textContent ?? '').trim().toLowerCase().startsWith(want))
      if (el === undefined) {
        throw new Error(`no section “${text}”`)
      }
      el.click()
    },
    open: name => {
      const r = stageBox(name).getBoundingClientRect()
      document
        .elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    },
    travel: label => {
      const el = slider(label)
      const min = Number(el.min)
      return (Number(el.value) - min) / (Number(el.max) - min)
    },
    // Through the native setter, so React's own listener sees the event —
    // `drive.mjs` spells out why a bare `el.value =` is reverted on the next
    // render.
    setTravel: (label, frac) => {
      const el = slider(label)
      const min = Number(el.min)
      const span = Number(el.max) - min
      const grid =
        min +
        Math.round((min + frac * span - min) / Number(el.step)) *
          Number(el.step)
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set.call(el, String(Number(grid.toPrecision(12))))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    },
  }
}

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
  },
})
console.log(`${variants.length} timelines → ${outDir}/`)
for (const [name, beats] of variants) {
  // A page each, for the reason `appreel.mjs` takes a browser each: a WebGPU
  // session that has been driven hard is not one to hand the next variant.
  const page = await browser.newPage()
  try {
    await page.setViewport({ width: 1112, height: 742, deviceScaleFactor: 1 })
    await page.evaluateOnNewDocument(seedStorage, {
      ...SEED,
      video_feedback_preset_hint_dismissed: '1',
    })
    await page.goto(base, { waitUntil: 'networkidle0' })
    await page.waitForSelector('canvas')
    await new Promise(r => setTimeout(r, 3000))
    await page.evaluate(installHelpers)
    await page.evaluate(installProbe)
    await step(page, 60)
    let open = null
    for (const beat of beats) {
      if (open !== beat.open) {
        await page.evaluate(n => window.__path.open(n), beat.open)
        await new Promise(r => setTimeout(r, 250))
        open = beat.open
        await step(page, GAP * 2)
      }
      if (beat.expand !== undefined) {
        await page.evaluate(t => window.__path.expand(t), beat.expand)
        await new Promise(r => setTimeout(r, 250))
      }
      const from = await page.evaluate(r => window.__path.travel(r), beat.row)
      for (let i = 1; i <= RAMP; i++) {
        await page.evaluate(
          (r, v) => window.__path.setTravel(r, v),
          beat.row,
          from + (beat.to - from) * (i / RAMP),
        )
        await page.evaluate(() => {
          window.vf?.step()
          window.vf?.step()
        })
      }
      await step(page, GAP * 2)
    }
    await step(page, HOLD * 2)
    const jpg = await page.evaluate(() => {
      const cv = document.querySelector('canvas')
      const oc = new OffscreenCanvas(cv.width, cv.height)
      oc.getContext('2d').drawImage(cv, 0, 0)
      return oc
        .convertToBlob({ type: 'image/jpeg', quality: 0.9 })
        .then(b => b.arrayBuffer())
        .then(a => [...new Uint8Array(a)])
    })
    writeFileSync(
      `${outDir}/${name.replaceAll(/[^a-z0-9]+/gi, '-')}.jpg`,
      Buffer.from(jpg),
    )
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.log(`  FAIL ${name}: ${String(e).slice(0, 160)}`)
  } finally {
    await page.evaluate(() => window.vf?.destroy()).catch(() => {})
    await page.close().catch(() => {})
  }
}
await browser.close()

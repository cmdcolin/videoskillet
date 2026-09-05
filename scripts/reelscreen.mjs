// Screen a slide idea before recording it: drive the app the way `appreel.mjs`
// does — press, drag, blend a chip, open a stage — and grab the canvas at
// named checkpoints, then montage the checkpoints into one sheet.
//
// Usage: node scripts/reelscreen.mjs <variants.mjs> <outDir> [--base=URL]
//   needs the dev server, Chrome (macOS) or Firefox Nightly, and ImageMagick's
//   `montage` for the sheets. `reelscreen.example.mjs` is the shape of a
//   variants module.
//
// Where it sits between the other two instruments. `contact.mjs` renders a
// board from a URL, which is right for a preset and wrong for a slide that
// gets somewhere by hand; `pathprobe.mjs` walks rows on a stepped engine but
// cannot press a button or drag a chip, and shoots once at the end. This one
// takes the timeline's own verbs and shoots wherever a `shot` is written, so
// four presses of `random look` are four tiles and a blend is a tile per chip.
// It is what the 2026-09-04 reel was chosen off: forty seeds, twenty-eight
// chips, forty pairs, thirty-six rows and a dozen loop recipes, in an
// afternoon, where recording each would have been ninety seconds a look.
//
// A variants module default-exports `[[name, { query, seed, warm, beats }], …]`
// and a beat is one of
//
//   { open: stage }               press a box or pill on the signal path map
//   { expand: section }           unfold a bank inside the open stage
//   { row, to }                   ramp a slider to a fraction of its travel
//   { row, value }                the same, to the number the row would show —
//                                 found by bisection, so a curved row works
//   { choice: { row, pick } }     one option of a switch row
//   { press: text }               click a button by its text
//   { menu: text }                pick a roll off the look bar's caret menu
//   { mix: chip, to }             drag a preset chip in to a fraction of full
//   { steps: n }                  n engine frames, no wall clock
//   { wait: ms }                  wall clock, with the engine stepped under it
//                                 — a morph is on the wall clock
//   { shot: label }               grab the canvas
//   { lit: true }                 note which chips are lit and how far off stock
//
// Two things a sheet can lie about, learnt the slow way. A `drawImage` off the
// WebGPU canvas after a wall-clock wait reads black; the grab here steps the
// engine once and screenshots the canvas rect in the same breath, and a black
// tile is the probe rather than the look. And the readout beside a row updates
// on React's next render, not synchronously with the input event, so the
// bisection for `value` runs across evaluates rather than inside one.
import puppeteer from 'puppeteer-core'

import { CHROME, FIREFOX } from './browser.mjs'
import { installHelpers, SEED, seedStorage, step } from './drive.mjs'

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { platform } from 'node:process'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
const [specPath, outDir] = argv.filter(a => !a.startsWith('--'))
const base =
  argv.find(a => a.startsWith('--base='))?.slice(7) ??
  'http://localhost:5199/app/'
const engine =
  argv.find(a => a.startsWith('--browser='))?.slice(10) ??
  (platform === 'darwin' ? 'chrome' : 'firefox')
if (specPath === undefined || outDir === undefined) {
  console.error(
    'usage: node scripts/reelscreen.mjs <variants.mjs> <outDir> [--base=URL]',
  )
  process.exit(1)
}
const variants = (await import(pathToFileURL(resolve(specPath)).href)).default
mkdirSync(outDir, { recursive: true })
// ImageMagick on macOS has no default font for labels; Linux builds carry one.
const FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
const font = existsSync(FONT) ? ['-font', FONT] : []
const sleep = ms => new Promise(r => setTimeout(r, ms))

function installProbe() {
  const stageBox = name => {
    const want = name.trim().toLowerCase()
    const boxes = [...document.querySelectorAll('g[role="button"]')]
    const text = g => (g.textContent ?? '').trim().toLowerCase()
    const box =
      boxes.find(g => text(g).split(/\s+/)[0] === want) ??
      boxes.find(g => text(g).startsWith(want))
    if (box === undefined) throw new Error(`no ${name} box on the map`)
    const label = [...box.querySelectorAll('text')].find(t =>
      (t.textContent ?? '').trim().toLowerCase().startsWith(want),
    )
    return label ?? box
  }
  const rowsByLabel = () => {
    const rows = new Map()
    for (const lab of document.querySelectorAll('label[for]')) {
      rows.set(
        lab.htmlFor,
        `${rows.get(lab.htmlFor) ?? ''} ${lab.textContent ?? ''}`,
      )
    }
    return rows
  }
  const slider = label => {
    const want = label.trim().toLowerCase()
    const hit = [...rowsByLabel()].find(([, text]) =>
      text.replaceAll(/\s+/g, ' ').trim().toLowerCase().startsWith(want),
    )
    const el = hit === undefined ? null : document.getElementById(hit[0])
    if (el === null)
      throw new Error(`no slider “${label}” — is its stage open?`)
    return el
  }
  const readout = label => {
    const el = slider(label)
    let box = el.parentElement
    while (box !== null && box.querySelector('span[class*="value"]') === null) {
      box = box.parentElement
    }
    const text = box?.querySelector('span[class*="value"]')?.textContent ?? ''
    const nums = text.match(/-?\d+(\.\d+)?/g) ?? []
    return Number(nums[0])
  }
  const travelOf = el => {
    const min = Number(el.min)
    return {
      min,
      span: Number(el.max) - min,
      at: (Number(el.value) - min) / (Number(el.max) - min),
    }
  }
  const setTravel = (label, frac) => {
    const el = slider(label)
    const { min, span } = travelOf(el)
    const stepv = Number(el.step)
    const grid = min + Math.round((min + frac * span - min) / stepv) * stepv
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set.call(el, String(Number(grid.toPrecision(12))))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const choice = ({ row, pick }) => {
    const group = [...document.querySelectorAll('[role="radiogroup"]')].find(
      g =>
        (g.getAttribute('aria-label') ?? '')
          .toLowerCase()
          .startsWith(row.toLowerCase()),
    )
    const el = [...(group?.querySelectorAll('[role="radio"]') ?? [])].find(
      b => (b.textContent ?? '').trim().toLowerCase() === pick.toLowerCase(),
    )
    if (el === undefined) throw new Error(`no “${pick}” on ${row}`)
    return el
  }
  const clickAt = el => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    )
    ;(hit ?? el).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return (hit ?? el).textContent?.trim().slice(0, 40)
  }
  window.__p = {
    open: name => clickAt(stageBox(name)),
    expand: text => {
      const want = text.trim().toLowerCase()
      const el = [
        ...document.querySelectorAll('button,summary,[role="button"]'),
      ].find(b =>
        (b.textContent ?? '')
          .replace(/^\s*[▸▾]/, '')
          .trim()
          .toLowerCase()
          .startsWith(want),
      )
      if (el === undefined) throw new Error(`no section “${text}”`)
      if (el.getAttribute('aria-expanded') !== 'true') el.click()
    },
    travel: label => travelOf(slider(label)).at,
    setTravel,
    readout,
    choice: c => clickAt(choice(c)),
    press: text => {
      const el = window.__ds.elementOf({ text })
      if (el === null) throw new Error(`no “${text}”`)
      return clickAt(el)
    },
    pressTitle: title => {
      const el = document.querySelector(`[title^=${JSON.stringify(title)}]`)
      if (el === null) throw new Error(`no title “${title}”`)
      return clickAt(el)
    },
    chipGrip: text => {
      const el = window.__ds.elementOf({ text })
      if (el === null || el.textContent.trim() !== text) {
        throw new Error(`no chip “${text}” on the row`)
      }
      const r = el.getBoundingClientRect()
      return { x: r.left + 8, y: r.top + r.height / 2 }
    },
    chipFill: text =>
      window.__ds.elementOf({ text }).style.getPropertyValue('--w'),
    lit: () =>
      [...document.querySelectorAll('button')]
        .filter(
          b =>
            b.style.getPropertyValue('--w') !== '' &&
            b.style.getPropertyValue('--w') !== '0%',
        )
        .map(b => `${b.textContent.trim()}=${b.style.getPropertyValue('--w')}`)
        .join(', ') +
      ' | ' +
      (document.body.textContent.match(
        /\d+ off stock|nothing off stock/,
      )?.[0] ?? ''),
  }
}

const browser = await (engine === 'chrome'
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
      },
    }))

const stepping = async (page, ms) => {
  const until = Date.now() + ms
  while (Date.now() < until) {
    await page.evaluate(() => {
      window.vf?.step()
      window.vf?.step()
    })
    await sleep(20)
  }
}

const travelFor = async (page, row, value) => {
  const was = await page.evaluate(r => window.__p.travel(r), row)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2
    await page.evaluate((r, v) => window.__p.setTravel(r, v), row, mid)
    await sleep(15)
    const read = await page.evaluate(r => window.__p.readout(r), row)
    if (read < value) lo = mid
    else hi = mid
  }
  await page.evaluate((r, v) => window.__p.setTravel(r, v), row, was)
  await sleep(15)
  return (lo + hi) / 2
}

const grabCanvas = async page => {
  const r = await page.evaluate(() => {
    const b = document.querySelector('canvas').getBoundingClientRect()
    return { x: b.left, y: b.top, width: b.width, height: b.height }
  })
  await page.evaluate(() => window.vf?.step())
  return page.screenshot({ type: 'jpeg', quality: 88, clip: r })
}

const sheetRows = []
for (const [name, spec] of variants) {
  const page = await browser.newPage()
  const shots = []
  const notes = []
  try {
    await page.setViewport({ width: 1112, height: 742, deviceScaleFactor: 1 })
    await page.evaluateOnNewDocument(seedStorage, {
      ...SEED,
      video_feedback_preset_hint_dismissed: '1',
      ...(spec.seed ?? {}),
    })
    await page.goto(`${base}${spec.query ?? ''}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('canvas')
    await sleep(3000)
    await page.evaluate(installHelpers)
    await page.evaluate(installProbe)
    await step(page, spec.warm ?? 60)
    for (const beat of spec.beats) {
      if (beat.open !== undefined) {
        await page.evaluate(n => window.__p.open(n), beat.open)
        await sleep(250)
        await step(page, 10)
      } else if (beat.expand !== undefined) {
        await page.evaluate(t => window.__p.expand(t), beat.expand)
        await sleep(250)
      } else if (beat.row !== undefined) {
        const to = beat.to ?? (await travelFor(page, beat.row, beat.value))
        const from = await page.evaluate(r => window.__p.travel(r), beat.row)
        const n = beat.frames ?? 18
        for (let i = 1; i <= n; i++) {
          await page.evaluate(
            (r, v) => window.__p.setTravel(r, v),
            beat.row,
            from + (to - from) * (i / n),
          )
          await page.evaluate(() => {
            window.vf?.step()
            window.vf?.step()
          })
        }
        const read = await page.evaluate(r => window.__p.readout(r), beat.row)
        notes.push(`${beat.row} → travel ${to.toFixed(4)} reads ${read}`)
      } else if (beat.choice !== undefined) {
        await page.evaluate(c => window.__p.choice(c), beat.choice)
        await sleep(150)
      } else if (beat.press !== undefined) {
        const hit = await page.evaluate(t => window.__p.press(t), beat.press)
        notes.push(`press ${beat.press} → ${hit}`)
        await sleep(100)
      } else if (beat.menu !== undefined) {
        await page.evaluate(
          t => window.__p.pressTitle(t),
          'the other ways this row has',
        )
        await sleep(200)
        const hit = await page.evaluate(t => window.__p.press(t), beat.menu)
        notes.push(`menu ${beat.menu} → ${hit}`)
        await sleep(100)
      } else if (beat.mix !== undefined) {
        const grip = await page.evaluate(t => window.__p.chipGrip(t), beat.mix)
        await page.mouse.move(grip.x, grip.y)
        await page.mouse.down()
        await page.mouse.move(grip.x + 6, grip.y, { steps: 2 })
        const travel = beat.to * 120
        for (let i = 1; i <= 12; i++) {
          await page.mouse.move(grip.x + 6 + (travel * i) / 12, grip.y)
          await page.evaluate(() => {
            window.vf?.step()
            window.vf?.step()
          })
        }
        await page.mouse.up()
        const fill = await page.evaluate(t => window.__p.chipFill(t), beat.mix)
        notes.push(`mix ${beat.mix} → ${fill}`)
      } else if (beat.steps !== undefined) {
        await step(page, beat.steps)
      } else if (beat.wait !== undefined) {
        await stepping(page, beat.wait)
      } else if (beat.lit !== undefined) {
        notes.push(`lit: ${await page.evaluate(() => window.__p.lit())}`)
      } else if (beat.shot !== undefined) {
        const jpg = await grabCanvas(page)
        const file = `${outDir}/${name}-${String(shots.length).padStart(2, '0')}.jpg`
        writeFileSync(file, jpg)
        shots.push({ file, label: beat.shot })
      }
    }
    console.log(`✓ ${name}`)
    for (const n of notes) console.log(`    ${n}`)
  } catch (e) {
    console.log(`FAIL ${name}: ${String(e).slice(0, 200)}`)
  } finally {
    await page.evaluate(() => window.vf?.destroy()).catch(() => {})
    await page.close().catch(() => {})
  }
  if (shots.length > 0) {
    const row = `${outDir}/row-${name}.jpg`
    execFileSync('montage', [
      ...font,
      ...shots.flatMap(s => ['-label', s.label, s.file]),
      '-tile',
      `${shots.length}x1`,
      '-geometry',
      '320x240+2+2',
      '-background',
      '#222',
      '-fill',
      '#ddd',
      '-pointsize',
      '13',
      row,
    ])
    sheetRows.push({ row, name })
  }
}
await browser.close()
if (sheetRows.length > 0) {
  execFileSync('montage', [
    ...font,
    ...sheetRows.flatMap(r => ['-label', r.name, r.row]),
    '-tile',
    '1x',
    '-geometry',
    '+0+4',
    '-background',
    '#111',
    '-fill',
    '#eee',
    '-pointsize',
    '16',
    `${outDir}/sheet.jpg`,
  ])
  console.log(`sheet: ${outDir}/sheet.jpg`)
}

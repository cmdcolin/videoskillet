// Does ctrl+z put back the look you were on?
//
//   npx vite --port 5421 --strictPort
//   node scripts/undocheck.mjs [url]
//
// Needs a dev server already running (see docs/DEVELOPMENT.md — put it on a
// `git worktree add --detach` copy if anything else might be editing the tree,
// since an `src/` write mid-run is an HMR reload that resets the app under the
// measurement).
//
// The walk itself is pinned by unit tests (ui/history.test.ts): dedupe, the cap,
// when the redo tail dies. What no unit test here can reach is the seam this
// check exists for — *when* the look being banked is read. The engine is the
// store, so `banked()` in useMix reads live state, and every verb writes that
// state in the next statement; a bank deferred into a `setHistory` updater is
// therefore answered after the board has already moved and files the
// destination as the step to go back to. Undo then lands where you already are,
// silently, with the button still lit and the walk still the right length.
//
// It shipped that way, and it shipped *intermittently*, which is why it lasted:
// React evaluates a state updater eagerly when the fiber happens to be clean, so
// the same preset click was undoable or not depending on what else had
// re-rendered that frame. A preset chip clicked with a mouse survived on an
// accident — its pointerdown banks a step through `startMix`, a handler with no
// write after it — while the same chip reached from the keyboard, and every roll
// in the look bar, could not be taken back at all.
//
// So every check below is the same assertion from a different verb: move the
// board, press undo, and every control is back where it started. A verb that
// moved nothing fails too — a check that passes because the gesture did nothing
// is not measuring undo.
//
// Morph is forced to a cut. The default is a one-second glide, and a control
// read mid-flight is a tween rather than a look: at the default this check
// fails on its own timing about half the time and blames the walk.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
// A headed window that gets covered stops being drawn — see frames.mjs.
import { watchFrames } from './frames.mjs'
import { appUp } from './until.mjs'

const url = new URL(process.argv[2] ?? 'http://localhost:5421/app/')
const fails = []
const check = (ok, msg) => {
  if (!ok) fails.push(msg)
}
const settle = (ms = 500) => new Promise(r => setTimeout(r, ms))

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
    'media.navigator.streams.fake': true,
    'media.navigator.permission.disabled': true,
  },
})

// The panel's class names are CSS-module hashes, so everything here addresses
// buttons by the text on them.
const HELPERS = `
  const byText = t => [...document.querySelectorAll('button')]
    .find(b => (b.textContent ?? '').trim() === t)
  const controls = () => window.vf.getControls()
`

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1352, height: 900 })
  page.on('pageerror', e => fails.push(`pageerror: ${String(e).slice(0, 200)}`))

  // localStorage is per origin, so the morph setting has to be written from a
  // loaded page before the one under test.
  await page.goto(url.href, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.setItem('videoskillet.js_morph', '0'))
  await page.goto(url.href, { waitUntil: 'networkidle0' })
  // Park the pointer clear of the preset chips: a stray hover swaps the caption
  // and a stray press applies a preset.
  await page.mouse.move(400, 500)
  await appUp(page, 15000)
  await watchFrames(page, { label: 'undocheck' })
  await page.mouse.move(400, 500)

  const run = body => page.evaluate(`(() => {${HELPERS}\n${body}})()`)
  const look = () => run(`return controls()`)
  const apart = (a, b) =>
    page.evaluate(
      (x, y) =>
        Object.keys({ ...x, ...y }).filter(
          k => JSON.stringify(x[k]) !== JSON.stringify(y[k]),
        ).length,
      a,
      b,
    )

  // A real press: pointerdown through click, which is what a hand sends and
  // what half of these paths depend on having seen.
  const press = async label => {
    const at = await page.evaluate(`(() => {${HELPERS}
      const b = byText(${JSON.stringify(label)})
      if (b === undefined) return null
      b.scrollIntoView({ block: 'center' })
      const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
    check(at !== null, `no button reading "${label}"`)
    if (at === null) return
    await page.mouse.click(at.x, at.y)
    await settle()
  }
  // The other way a button is activated. A chip reached with the keyboard fires
  // a bare click and no pointer sequence at all, which is the path that lost its
  // step: nothing banks on the way in, so the verb's own bank is the only one.
  const activate = async label => {
    await run(
      `byText(${JSON.stringify(label)})
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 0`,
    )
    await settle()
  }
  // The rolls live behind the ▾ next to "random look".
  const roll = async label => {
    await press('▾')
    await press(label)
  }

  const takesBack = async (name, act) => {
    await press('reset')
    const before = await look()
    await act()
    const moved = await apart(before, await look())
    await press('undo')
    const left = await apart(before, await look())
    check(moved > 0, `${name} moved nothing, so undo was never asked anything`)
    check(
      left === 0,
      `undo after ${name} left ${left} of ${moved} controls where the gesture put them`,
    )
  }

  await takesBack('a preset chip', () => press('vhs'))
  await takesBack('a preset chip reached from the keyboard', () =>
    activate('spiral'),
  )
  await takesBack('random look', () => press('random look'))
  await takesBack('random preset', () => roll('◆random preset'))
  await takesBack('random cross', () => roll('⤫random cross'))
  await takesBack('random nudge', () => roll('≈random nudge'))
  await takesBack('random fault', () => roll('↯random fault'))

  // The reset is the one verb that can take the gate off the board, and it is
  // the one whose step back is worth most: it is what a session reaches for
  // after a detour it cannot see out of.
  await press('reset')
  const clean = await look()
  await press('vhs')
  const dialed = await look()
  check(
    (await apart(clean, dialed)) > 0,
    'the chip a reset is meant to wipe moved nothing',
  )
  await press('reset')
  const wiped = await apart(dialed, await look())
  check(
    wiped > 0,
    `the reset wiped nothing off the ${await apart(clean, dialed)} the chip set`,
  )
  await press('undo')
  const restored = await apart(dialed, await look())
  check(
    restored === 0,
    `undo after a reset left ${restored} controls off the look it wiped`,
  )

  // Retraceable in both directions, which is the whole claim the walk makes.
  await press('reset')
  const stock = await look()
  await press('vhs')
  const one = await look()
  await press('spiral')
  const two = await look()
  await press('undo')
  check((await apart(one, await look())) === 0, 'one step back missed look 1')
  await press('undo')
  check((await apart(stock, await look())) === 0, 'two steps back missed stock')
  await press('redo')
  check(
    (await apart(one, await look())) === 0,
    'one step forward missed look 1',
  )
  await press('redo')
  check(
    (await apart(two, await look())) === 0,
    'two steps forward missed look 2',
  )
} catch (e) {
  fails.push(`threw: ${String(e).slice(0, 300)}`)
} finally {
  await browser.close()
}

if (fails.length) {
  console.error('FAIL (undocheck)')
  for (const f of fails) console.error('  -', f)
  process.exit(1)
}
console.log('PASS (undocheck)')

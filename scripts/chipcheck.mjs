// Do the preset chips answer to the hand that is actually on them?
//
//   npx vite --port 5401 --strictPort
//   node scripts/chipcheck.mjs [url]
//
// Needs a dev server already running (see docs/DEVELOPMENT.md — put it on a
// `git worktree add --detach` copy if anything else might be editing the tree,
// since an `src/` write mid-run is an HMR reload that resets the app under the
// measurement).
//
// A preset chip is a button that is also a fader, which means it reads the whole
// pointer sequence rather than just a click — and that is a wider contract than
// any unit test here can reach, because every one of these bugs lived in the
// gap between what the app thinks a gesture was and what the browser actually
// sent. All four shipped:
//
//  - **any** button armed the fader, so the release from a right-click ran the
//    same path a click does: right-clicking a chip to read its tooltip applied
//    the preset
//  - the gesture was disarmed only by a pointerup on that same chip, so one
//    swallowed release (a context menu, a lost capture) left the chip armed for
//    the rest of the session, and from then on plain hover — no button down at
//    all — scrubbed its weight
//  - the shortlist's membership follows the mix, and the mix only counts once a
//    morph has landed, about a second after the gesture: the row rearranged
//    itself under a resting hand, so parking on "rainbow storm", rolling, and
//    clicking without moving applied "mixer loop"
//  - a chip that went out from under a resting pointer fired no pointerleave,
//    leaving the caption describing a preset nobody was on
//
// The orphaned-press check dispatches one synthetic `pointermove` with
// `buttons: 0`. That is deliberate: a real context menu eating a real release
// cannot be driven through WebDriver, but `buttons: 0` is exactly the state the
// OS leaves behind, and what is under test is whether the chip notices the hand
// is empty.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
// A headed window that gets covered stops being drawn — see frames.mjs.
import { watchFrames } from './frames.mjs'
import { appUp } from './until.mjs'

const url = new URL(process.argv[2] ?? 'http://localhost:5401/')
const fails = []
const check = (ok, msg) => {
  if (!ok) fails.push(msg)
}
const settle = ms => new Promise(r => setTimeout(r, ms))

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

try {
  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(180000)
  page.setDefaultTimeout(180000)
  await page.setViewport({ width: 1352, height: 900 })
  page.on('pageerror', e => fails.push(`pageerror: ${String(e).slice(0, 200)}`))
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  // Clear of the chips before anything else: a stray hover swaps the caption
  // and a stray press mixes a preset, either of which measures a different app
  // than the one the checks name.
  await page.mouse.move(400, 820)
  check(await appUp(page, 40000), 'the app never came up')
  await watchFrames(page, { label: 'chipcheck' })

  // The panel's class names are CSS-module hashes, so the chips are addressed
  // by the one thing that is stable about them: a mixable chip's title opens
  // "sets N controls at once".
  const probe = () =>
    page.evaluate(() => {
      window.T = {
        chips: () =>
          [...document.querySelectorAll('button')].filter(b =>
            /^sets \d+ controls/.test(b.title),
          ),
        row: () =>
          window.T.chips().map(b => {
            const r = b.getBoundingClientRect()
            return {
              name: b.textContent.trim(),
              w: b.style.getPropertyValue('--w'),
              cx: Math.round(r.x + r.width / 2),
              cy: Math.round(r.y + r.height / 2),
            }
          }),
        at: (x, y) =>
          document
            .elementFromPoint(x, y)
            ?.closest('button')
            ?.textContent?.trim() ?? null,
        // The look as one number, so a check can say "this changed" without
        // caring which of the 200-odd controls moved.
        look: () => {
          const c = window.vf.controls
          let h = 0
          for (const k of Object.keys(c).sort()) {
            const v = Number(c[k])
            h =
              (h * 31 +
                (Number.isFinite(v)
                  ? Math.round(v * 1000)
                  : String(c[k]).length)) |
              0
          }
          return h
        },
        caption: () =>
          [...document.querySelectorAll('div')]
            .filter(
              d =>
                (d.title ?? '').length > 30 &&
                d.children.length <= 2 &&
                d.clientHeight > 0 &&
                d.clientHeight < 60,
            )
            .map(d => d.textContent.trim())
            .slice(-1)[0],
        roll: () =>
          [...document.querySelectorAll('button')]
            .find(b => (b.title ?? '').startsWith('a look you have not seen'))
            ?.click(),
        // One move with no button down, which is what the OS sends once
        // something else has taken the release.
        emptyHandMove: (x, y) =>
          document.elementFromPoint(x, y)?.dispatchEvent(
            new PointerEvent('pointermove', {
              clientX: x,
              clientY: y,
              buttons: 0,
              bubbles: true,
              pointerId: 1,
              isPrimary: true,
              pointerType: 'mouse',
            }),
          ),
      }
    })
  await probe()
  const T = (fn, ...a) =>
    page.evaluate(new Function('a', `return window.T.${fn}(...a)`), a)

  const chipNamed = async re => {
    const row = await T('row')
    return row.find(c => re.test(c.name)) ?? row[1]
  }

  // A right-click is not a gesture on the fader.
  {
    const c = await chipNamed(/vhs/i)
    await page.mouse.move(c.cx, c.cy)
    await settle(300)
    const before = await T('look')
    await page.mouse.down({ button: 'right' })
    await page.mouse.up({ button: 'right' })
    await settle(700)
    check(before === (await T('look')), `right-clicking "${c.name}" applied it`)
    await page.keyboard.press('Escape')
    await settle(300)
  }

  // A press still works, and is still the thing that applies a preset.
  {
    const c = await chipNamed(/broadcast/i)
    await page.mouse.move(c.cx, c.cy)
    const before = await T('look')
    await page.mouse.down()
    await page.mouse.up()
    await settle(1800)
    check(before !== (await T('look')), `clicking "${c.name}" applied nothing`)
    const after = (await T('row')).find(x => x.name === c.name)
    check(
      after?.w === '100%',
      `clicking "${c.name}" left its fill at ${after?.w} rather than 100%`,
    )
  }

  // A sideways drag is still a partial mix rather than a press.
  {
    const c = await chipNamed(/mixer loop/i)
    await page.mouse.move(c.cx, c.cy)
    await page.mouse.down()
    for (let i = 1; i <= 4; i++) await page.mouse.move(c.cx + i * 10, c.cy)
    await page.mouse.up()
    await settle(700)
    const after = (await T('row')).find(x => x.name === c.name)
    const w = Number.parseInt(after?.w ?? '0', 10)
    check(
      w > 0 && w < 100,
      `dragging "${c.name}" 40px left its fill at ${after?.w}, so the drag read as a click`,
    )
  }

  // A press whose release goes missing must not leave the chip scrubbing on
  // hover for the rest of the session.
  {
    const c = await chipNamed(/rainbow/i)
    await page.mouse.move(c.cx, c.cy)
    await settle(300)
    await page.mouse.down()
    await settle(150)
    const before = await T('look')
    await T('emptyHandMove', c.cx + 10, c.cy)
    for (let i = 2; i <= 6; i++) {
      await T('emptyHandMove', c.cx + i * 10, c.cy)
      await settle(60)
    }
    check(
      before === (await T('look')),
      `moving across "${c.name}" with no button down mixed it`,
    )
    await page.mouse.up().catch(() => {})
    await settle(400)
  }

  // The row is a thing you aim at, so it may not rearrange under a still hand.
  // A roll is what moves membership: its recipe arrives as weights, and the
  // weights land a morph later.
  for (const idx of [4, 5, 6]) {
    const row = await T('row')
    const park = row[idx]
    if (park !== undefined) {
      await page.mouse.move(park.cx, park.cy)
      await settle(350)
      const aimed = await T('at', park.cx, park.cy)
      const caption = await T('caption')
      await T('roll')
      await settle(2400)
      check(
        aimed === (await T('at', park.cx, park.cy)),
        `a roll moved the row under a resting pointer: "${aimed}" became "${await T('at', park.cx, park.cy)}"`,
      )
      check(
        caption === (await T('caption')),
        `the caption stopped describing "${aimed}" without the pointer moving`,
      )
    }
  }
} catch (e) {
  fails.push(`threw: ${String(e).slice(0, 300)}`)
} finally {
  await browser.close()
}

if (fails.length) {
  console.error('FAIL (chipcheck)')
  for (const f of fails) console.error('  -', f)
  process.exit(1)
}
console.log('PASS (chipcheck)')

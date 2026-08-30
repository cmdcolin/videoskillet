// Walks the whole panel and asks two questions a screenshot cannot: is any text
// drawn on top of any other text, and is there a control nothing could announce.
//
//   npx vite --port 5372 --strictPort
//   node scripts/inkcheck.mjs [url]
//
// Firefox Nightly, not Chrome: same reason as every other harness here (see
// CLAUDE.md). Serve it from a `git worktree add --detach` copy if anything else
// might be editing the tree — an HMR reload mid-run remounts the panel under the
// walk and every later stage is read from a different app.
//
// **Why this exists, next to panelshots.** panelshots diffs eight fixed states
// against committed baselines, and that is the right tool for "did this rule
// change what the masthead looks like". It is structurally blind to this class,
// because the fault is never in the eight states: it is in the ninth stage
// nobody had open, on the one heading long enough to need the whole row. The
// panel is ~1000 CSS declarations, 34 headings and 245 control rows, and no
// human opens all of them to look.
//
// It found 26 overlaps the first time it was run, in code nobody thought was
// broken:
//
//  - 22 were a wrapped control label's two halves. The label is split so its
//    last word can ride with the `?` in a nowrap span; wrapped, the two inline
//    boxes overlapped — "A termination (-1 daisy, +1" drawn across "open)".
//    Gone with the stacked row, which is why no label wraps any more.
//  - 4 were a heading painting over its own buttons. `.headBtn` is a flex item
//    and a flex item's floor is its content, so a heading wide enough to need
//    the whole row kept a box that wide: "Tube face (what the camera shoots)"
//    through "randomize" by 54px.
//
// And two textareas with no accessible name, both leaning on a placeholder —
// which is the weakest fallback there is and gone the moment the field has
// content.
//
// **Three shells, because the fault is a width.** The docked sidebar is 332px,
// the landscape phone rule takes it to 300 (the narrowest the app has), and the
// bench pairs a stage's groups into two ~330px columns inside a 692px panel —
// which is the width that catches a rule keyed on the panel when it should have
// been keyed on the row. Portrait is left out on purpose: it hands the panel the
// whole 390px screen, so it is the roomiest of the four and cannot fail alone.

import puppeteer from 'puppeteer-core'

// A headed window that gets covered stops being drawn — see frames.mjs.
import { watchFrames } from './frames.mjs'
// Boot waited for rather than slept through — see until.mjs.
import { appUp } from './until.mjs'

const url = new URL(process.argv[2] ?? 'http://localhost:5372/')
const fails = []
const settle = ms => new Promise(r => setTimeout(r, ms))

// One browser per shell, and one WebGPU session per browser: a page driven
// through a reload detaches its frame partway, and every evaluate after that
// dies with "Attempted to use detached Frame" — which reads exactly like the
// panel having crashed. Same reasoning as panelcheck's `phase`.
const shell = async (name, viewport, body) => {
  const browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: '/usr/bin/firefox-nightly',
    headless: false,
    extraPrefsFirefox: {
      'dom.webgpu.enabled': true,
      'gfx.webgpu.ignore-blocklist': true,
    },
  })
  try {
    const page = await browser.newPage()
    await page.setViewport(viewport)
    await page.goto(url.href, { waitUntil: 'load' })
    if ((await appUp(page, 8000)) !== true) {
      fails.push(`${name}: the app never came up`)
      return
    }
    await watchFrames(page, { label: `inkcheck ${name}` })
    // The real cursor sits wherever the window manager left it, and a preset
    // chip under it swaps the catalog's caption for that preset's blurb — one
    // line becoming five, under a walk that is measuring boxes.
    await page.mouse.move(10, 10)
    await settle(700)
    await body(page, name)
  } catch (e) {
    fails.push(`${name}: threw: ${String(e).slice(0, 200)}`)
  } finally {
    await browser.close()
  }
}

// Every leaf that carries text, checked pairwise for a box that intersects
// another's. Leaves only, so a container and the thing inside it is not a hit;
// SVG skipped, because the map's boxes overlap their own labels by design and
// getBoundingClientRect on an SVG text node does not mean what it means here;
// popovers and absolutely-positioned things skipped, because floating over the
// row below is what a help card is for.
const SCAN = `
  const panel = [...document.querySelectorAll('div')]
    .find(d => (d.className ?? '').toString().includes('_panel_'))
  if (panel === undefined) return { over: [], unnamed: [] }
  const name = e =>
    e.tagName.toLowerCase() +
    '.' + (e.className ?? '').toString().replaceAll(/_[\\w-]{5,}\\b/g, '').trim()
  const leaves = []
  for (const e of panel.querySelectorAll('*')) {
    if (e.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue
    if (e.children.length > 0) continue
    const t = (e.textContent ?? '').replace(/\\s+/g, ' ').trim()
    if (t === '') continue
    const s = getComputedStyle(e)
    if (s.position === 'absolute' || s.position === 'fixed') continue
    if (e.closest('[popover]') !== null) continue
    const r = e.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    leaves.push({ e, r, t })
  }
  const over = []
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const A = leaves[i]
      const B = leaves[j]
      if (A.e.contains(B.e) || B.e.contains(A.e)) continue
      // A pixel and a half of slack: an inline box sits a hair proud of its own
      // glyphs, and two rows a step apart in the same column touch at the edge.
      const x = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left)
      const y = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top)
      if (x > 1.5 && y > 1.5) {
        over.push(
          Math.round(x) + 'x' + Math.round(y) + 'px  “' + A.t.slice(0, 40) +
          '” over “' + B.t.slice(0, 40) + '”  (' + name(A.e) + ' / ' + name(B.e) + ')'
        )
      }
    }
  }
  // And the other half: a control with nothing to announce. A placeholder is
  // deliberately not accepted — it is the weakest fallback an assistive
  // technology has and it is gone as soon as the field has content.
  const named = e => {
    const al = e.getAttribute('aria-label')
    if (al !== null && al.trim() !== '') return true
    const by = e.getAttribute('aria-labelledby')
    if (by !== null && document.getElementById(by.split(/\\s+/)[0]) !== null) return true
    if ((e.textContent ?? '').trim() !== '') return true
    if (typeof e.title === 'string' && e.title.trim() !== '') return true
    if (e.id !== '' && document.querySelector('label[for="' + CSS.escape(e.id) + '"]') !== null)
      return true
    return e.closest('label') !== null
  }
  const unnamed = []
  for (const e of panel.querySelectorAll(
    'button, input, select, textarea, [role=radio], [role=button]',
  )) {
    const r = e.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (named(e)) continue
    // The class name is a CSS-module hash and often empty, so say where it is
    // instead: whatever it is standing under, and whatever it does say to a
    // sighted reader. "nothing announces textarea." is a true report nobody can
    // act on.
    const head = e.closest('div')?.closest('div')?.querySelector('h3')
    const where =
      head === null || head === undefined
        ? ''
        : ' under “' + head.textContent.replace(/\\s+/g, ' ').trim().slice(0, 30) + '”'
    const says =
      typeof e.placeholder === 'string' && e.placeholder !== ''
        ? ' placeholder “' + e.placeholder + '”'
        : ''
    unnamed.push(name(e) + says + where)
  }
  return { over, unnamed }
`

// Every stage on the map, then every group inside each one. The groups are an
// accordion — opening one folds its neighbour — so this scans after each rather
// than opening them all and looking once.
const walk = async (page, label) => {
  const seen = new Set()
  const record = hits => {
    for (const h of hits.over) {
      if (seen.has(h)) continue
      seen.add(h)
      fails.push(`${label}: ${h}`)
    }
    for (const u of hits.unnamed) {
      const k = 'unnamed ' + u
      if (seen.has(k)) continue
      seen.add(k)
      fails.push(`${label}: nothing announces ${u}`)
    }
  }
  const stages = await page.evaluate(
    `[...document.querySelectorAll('svg text')].map(e => e.textContent.trim())`,
  )
  for (const stage of stages) {
    const opened = await page.evaluate(`(() => {
      const t = [...document.querySelectorAll('svg text')]
        .find(e => e.textContent.trim() === ${JSON.stringify(stage)})
      const box = t?.closest('g[role="button"]') ?? t?.closest('g')
      if (box == null) return false
      box.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return true
    })()`)
    // A label on the map that is not a door — a loop's name, a slot's caption.
    // Not a failure: what this walk needs is the stages, and it finds them by
    // trying every piece of text on the drawing.
    if (opened !== true) continue
    await settle(600)
    const groups = await page.evaluate(
      `[...document.querySelectorAll('button[aria-expanded]')]
        .map(b => b.textContent.replace(/\\s+/g, ' ').trim())
        .filter(t => t !== '')`,
    )
    record(await page.evaluate(`(() => {${SCAN}})()`))
    for (const group of groups) {
      await page.evaluate(`(() => {
        const b = [...document.querySelectorAll('button[aria-expanded]')]
          .find(b => b.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(group)})
        if (b !== undefined && b.getAttribute('aria-expanded') === 'false') b.click()
      })()`)
      await settle(240)
      record(await page.evaluate(`(() => {${SCAN}})()`))
    }
  }
  console.log(
    `  ${label.padEnd(34)} ${seen.size === 0 ? 'clean' : `${seen.size} found`}`,
  )
}

console.log(`inkcheck against ${url.href}`)

// The docked sidebar: 332px, and where nearly every one of these rows is read.
await shell('docked 1352x950', { width: 1352, height: 950 }, walk)

// The narrowest the panel ever is. The landscape rule takes it to
// min(300px, 40vw) on a short viewport (app.module.css), which is 32px less
// than docked — so a heading or a reading that only just fits above fails here.
await shell('landscape 844x390', { width: 844, height: 390 }, walk)

// And the widest, which is not the roomiest: the bench doubles the panel and
// then splits a stage's groups into two columns, so each row is back at ~330px
// inside a 692px shell. A rule that asks how wide the *panel* is gets this
// wrong, and gets it wrong in the direction that looks fine in a screenshot of
// the sidebar.
await shell(
  'bench 1440x950',
  { width: 1440, height: 950 },
  async (page, label) => {
    await page.evaluate(`(() => {
    const menu = [...document.querySelectorAll('button')]
      .find(b => (b.getAttribute('aria-label') ?? '').match(/menu/i) !== null)
    menu?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })()`)
    await settle(500)
    await page.evaluate(`(() => {
    const wide = [...document.querySelectorAll('button')]
      .find(b => /bench/i.test(b.textContent ?? ''))
    wide?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })()`)
    await settle(1600)
    await page.evaluate(
      `document.querySelector('[popover]:popover-open')?.hidePopover()`,
    )
    await settle(400)
    const cols = await page.evaluate(`(() => {
    const panel = [...document.querySelectorAll('div')]
      .find(d => (d.className ?? '').toString().includes('_panel_'))
    return Math.round(panel.getBoundingClientRect().width)
  })()`)
    // Worth failing on rather than walking a shell that never widened: the whole
    // point of this arm is the two-column width, and at one column it would come
    // back clean for the wrong reason.
    if (cols < 600)
      fails.push(`${label}: the bench never widened — panel is ${cols}px`)
    else await walk(page, label)
  },
)

if (fails.length > 0) {
  console.error('FAIL (inkcheck)')
  for (const f of fails) console.error('  -', f)
  process.exit(1)
}
console.log('PASS (inkcheck)')

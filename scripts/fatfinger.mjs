// What a fingertip actually gets. Every control the panel shows at 390px with
// the pointer reported coarse, walked outward from its centre with
// elementFromPoint, reported as the hit area that comes back.
//
//   npx vite --port 5372 --strictPort
//   node scripts/fatfinger.mjs [url] [minPx]
//
// **Chrome, and the one harness here that is.** Every other browser check in
// this directory drives Firefox (CLAUDE.md § Testing WebGPU), and this one
// cannot: what it measures only exists under `pointer: coarse`, and the only
// way to turn that on from a driver is CDP's `Emulation.setEmulatedMedia`.
// Firefox's `ui.primaryPointerCapabilities` pref does not reach the content
// process through puppeteer's BiDi — tried, and `matchMedia('(pointer:
// coarse)')` still answers false. Layout is what is being read here, not the
// picture, so Chrome's WebGPU is incidental.
//
// **getBoundingClientRect is the wrong instrument** and is why this is a
// harness rather than a query. It answers neither half of the question: it
// misses the ::after expanders that are how this panel grows a target without
// moving its neighbours, so an 11px ⋮ measures 11px when a press gets 23; and
// it counts area a neighbour is painted over, so a box under the sticky stage
// head measures its whole self when a press gets the header. Walking
// elementFromPoint out from the centre answers what a finger would actually
// land on, which is the only number worth having.
//
// It reports the *best* reading each control ever gives, over every scroll
// position it is swept at. A control halfway under the sticky stage head is
// covered at that moment and clear one flick later; reporting the covered
// reading would be reporting the scroller.
//
// The floor is WCAG 2.2 SC 2.5.8's 24px rather than Apple's 44 or Material's
// 48. This panel is 245 control rows in a 332px column and it puts its chrome
// in rows of two and three; at 44 the whole thing fails and the report says
// nothing. 24 is the number a target can actually be held to here, and
// ui.module.css's .tap reaches to 30 wherever the gaps allow it.
//
// Measured before and after the touch pass: 112 of 242 under 24px, then 24.
// What is left is listed smallest-first, and most of it is one class — a
// caption that doubles as a button (`does nothing until "genlock" moves`, a
// deck's clear, the tempo field).
import puppeteer from 'puppeteer-core'

import { CHROME } from './browser.mjs'

const MIN = Number(process.argv[3] ?? 24)
const browser = await puppeteer.launch({
  browser: 'chrome',
  executablePath: CHROME,
  headless: false,
  args: ['--enable-unsafe-webgpu'],
})
const page = await browser.newPage()
const cdp = await page.createCDPSession()
await cdp.send('Emulation.setEmulatedMedia', {
  features: [
    { name: 'pointer', value: 'coarse' },
    { name: 'any-pointer', value: 'coarse' },
    { name: 'hover', value: 'none' },
    { name: 'any-hover', value: 'none' },
  ],
})
await page.setViewport({
  width: 390,
  height: 844,
  hasTouch: true,
  isMobile: true,
})
await page.goto('http://localhost:5381/', { waitUntil: 'load' })
const settle = ms => new Promise(r => setTimeout(r, ms))
await settle(6000)

const PROBE = `(() => {
  const SEL = 'button, [role=button], input, select, textarea, summary, a[href], g[role=button]'
  const hitAt = (e, x, y) => {
    const t = document.elementFromPoint(x, y)
    return t !== null && (t === e || e.contains(t))
  }
  const reach = (e, cx, cy, dx, dy, cap) => {
    let n = 0
    while (n < cap && hitAt(e, cx + dx * (n + 1), cy + dy * (n + 1))) n++
    return n
  }
  const out = []
  for (const e of document.querySelectorAll(SEL)) {
    const r = e.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    // elementFromPoint answers nothing outside the viewport, so a control half
    // off the bottom measures as half a control. Only whole ones count.
    if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue
    const cx = Math.round(r.left + r.width / 2)
    const cy = Math.round(r.top + r.height / 2)
    if (!hitAt(e, cx, cy)) continue
    const cap = 40
    const w = 1 + reach(e, cx, cy, -1, 0, cap) + reach(e, cx, cy, 1, 0, cap)
    const h = 1 + reach(e, cx, cy, 0, -1, cap) + reach(e, cx, cy, 0, 1, cap)
    const label = (e.getAttribute('aria-label') ?? e.getAttribute('title') ?? e.textContent ?? '')
      .replace(/\\s+/g, ' ').trim().slice(0, 46)
    out.push({ w, h, label, tag: e.tagName.toLowerCase(), box: Math.round(r.width) + 'x' + Math.round(r.height) })
  }
  return out
})()`

// The best reading each control ever gives, not the first. A control scrolled
// half under the sticky stage head is covered by it at that moment and clear of
// it one flick later, and reporting the covered reading is reporting the
// scroller rather than the target.
const seen = new Map()
const sweep = async where => {
  for (const t of await page.evaluate(PROBE)) {
    const key = t.tag + '|' + t.label + '|' + t.box
    const had = seen.get(key)
    if (had !== undefined && had.w * had.h >= t.w * t.h) continue
    seen.set(key, { ...t, where })
  }
}
// scroll the panel through, sweeping each screenful, then open every stage
const scrollThrough = async where => {
  await page.evaluate(`document.querySelector('[class*=panel_]').scrollTop = 0`)
  await settle(250)
  for (let i = 0; i < 20; i++) {
    await sweep(where)
    const more = await page.evaluate(`(() => {
      const p = document.querySelector('[class*=panel_]')
      const b = p.scrollTop; p.scrollTop += p.clientHeight - 60; return p.scrollTop > b
    })()`)
    await settle(250)
    if (!more) break
  }
}
await scrollThrough('home')
const stages = await page.evaluate(
  `[...document.querySelectorAll('svg text')].map(e=>e.textContent.trim())`,
)
for (const st of stages) {
  const ok = await page.evaluate(`(() => {
    const t = [...document.querySelectorAll('svg text')].find(e => e.textContent.trim() === ${JSON.stringify(st)})
    const g = t?.closest('g[role="button"]') ?? t?.closest('g')
    if (!g) return false
    g.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  })()`)
  if (!ok) continue
  await settle(700)
  const groups = await page.evaluate(
    `[...document.querySelectorAll('button[aria-expanded]')].map(b=>b.textContent.replace(/\\s+/g,' ').trim())`,
  )
  for (const g of groups) {
    await page.evaluate(`(() => {
      const b = [...document.querySelectorAll('button[aria-expanded]')].find(b => b.textContent.replace(/\\s+/g,' ').trim() === ${JSON.stringify(g)})
      if (b && b.getAttribute('aria-expanded') === 'false') b.click()
    })()`)
    await settle(200)
  }
  await scrollThrough(st)
}
const small = [...seen.values()].filter(t => t.w < MIN || t.h < MIN)
small.sort((a, b) => a.w * a.h - b.w * b.h)
console.log(`\n${seen.size} controls probed, ${small.length} under ${MIN}px\n`)
for (const t of small)
  console.log(
    `  ${String(t.w + 'x' + t.h).padEnd(8)} box ${t.box.padEnd(9)} ${t.tag.padEnd(7)} “${t.label}”  [${t.where}]`,
  )
await browser.close()

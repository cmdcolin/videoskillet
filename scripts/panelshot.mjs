// Screenshot one group of the panel, opened through the same storage keys the
// app restores on load.
// Usage: node scripts/panelshot.mjs <url> <out.png> <phase> <group> [clickText...]
// Each clickText presses the first element under the group whose aria-label or
// text matches, so a diagram box can be opened before the shot.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { SEED, seedStorage } from './drive.mjs'

const args = process.argv.slice(2)
const dpr = args.find(a => a.startsWith('--dpr='))?.slice(6) ?? '1.0'
// --hover=N puts the pointer 60% along the Nth plot's probe before the shot.
const hover = args.find(a => a.startsWith('--hover='))?.slice(8)
const [url, out, phase, group, ...clicks] = args.filter(
  a => !a.startsWith('--dpr=') && !a.startsWith('--hover='),
)

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
    'layout.css.devPixelsPerPx': dpr,
  },
})
try {
  const page = await browser.newPage()
  page.on('pageerror', err =>
    console.log('[pageerror]', String(err).slice(0, 300)),
  )
  await page.evaluateOnNewDocument(seedStorage, {
    ...SEED,
    video_feedback_open_phase: phase,
    video_feedback_open_group: group,
  })
  await page.goto(url, { waitUntil: 'networkidle0' })
  const find = name => {
    if (name.startsWith('css:')) return document.querySelector(name.slice(4))
    const heads = [
      ...document.querySelectorAll('h2, h3, button, summary'),
    ].filter(
      e =>
        e.textContent?.includes(name) ||
        [...e.querySelectorAll('[title]')].some(t => t.title === name),
    )
    let section = heads.at(-1)
    while (section && section.getBoundingClientRect().height < 120)
      section = section.parentElement
    return section
  }
  await page.waitForFunction(`(${find})(${JSON.stringify(group)})`, {
    timeout: 20000,
  })
  const rect = await page.evaluate(
    async (findSrc, name, clicks) => {
      const find = eval(findSrc)
      // The group can still be growing (a note under the drawing arrives a
      // render late) or briefly collapsed when the wait above lets go, so the
      // shot waits for a second of one height that is a whole group.
      const heights = []
      const settled = () => {
        const last = heights.slice(-4)
        return last.length === 4 && last.every(h => h >= 120 && h === last[0])
      }
      let section = null
      while (heights.length < 60 && !settled()) {
        await new Promise(r => setTimeout(r, 250))
        section = find(name)
        heights.push(Math.round(section?.getBoundingClientRect().height ?? 0))
      }
      if (!settled())
        throw new Error(`${name} never settled: ${heights.join(' ')}`)
      for (const text of clicks) {
        const hit = [
          ...section.querySelectorAll('[aria-label], button, g[role="button"]'),
        ].find(
          e =>
            e.getAttribute('aria-label')?.includes(text) ||
            e.textContent?.trim() === text,
        )
        if (!hit) throw new Error(`nothing to click for "${text}"`)
        hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 200))
      }
      for (let i = 0; i < 2; i++)
        await new Promise(r => requestAnimationFrame(r))
      section.scrollIntoView({ block: 'start' })
      const r = section.getBoundingClientRect()
      return {
        x: r.x,
        y: r.y + window.scrollY,
        width: r.width,
        height: r.height,
      }
    },
    `(${find})`,
    group,
    clicks,
  )
  if (!rect) throw new Error(`no section for ${group}`)
  if (hover !== undefined) {
    const at = await page.evaluate(n => {
      const r = document
        .querySelectorAll('rect[class*="catch"]')
        [n]?.getBoundingClientRect()
      return r && { x: r.x + r.width * 0.6, y: r.y + r.height / 2 }
    }, Number(hover))
    if (!at) throw new Error(`no plot ${hover} to hover`)
    await page.mouse.move(at.x, at.y)
    await page.mouse.move(at.x + 2, at.y)
    await new Promise(r => setTimeout(r, 300))
  }
  await page.screenshot({ path: out, clip: rect, captureBeyondViewport: true })
  console.log(
    'wrote',
    out,
    `${Math.round(rect.width)}x${Math.round(rect.height)}`,
  )
} finally {
  await browser.close()
}

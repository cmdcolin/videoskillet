// Rasterise public/favicon.svg into the PNGs a home-screen install needs.
//
// Three shapes, not one scaled three ways:
//
//   icon-{192,512}.png     the favicon as drawn — rounded corners, transparent
//                          outside them, which is what a browser tab, a task
//                          switcher and a desktop install all want.
//   icon-maskable-512.png  full-bleed, art shrunk into the inner 80% circle.
//                          Android crops a maskable icon to whatever shape the
//                          launcher uses; anything outside that circle can be
//                          cut off, so the skillet is inset and the background
//                          runs to the edge.
//   apple-touch-icon.png   180×180, full-bleed, square, opaque. iOS applies its
//                          own squircle and does not read SVG, so this is the
//                          one file that cannot be skipped for an iPhone.
//
// Committed, not built: the app's build must not need a browser. Re-run this
// (pnpm icons) when public/favicon.svg changes.
// Usage: node scripts/icons.mjs

import puppeteer from 'puppeteer-core'

import { CHROME } from './browser.mjs'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const favicon = readFileSync(new URL('public/favicon.svg', root), 'utf8')

// The favicon is the rounded backdrop plus the mark. The variants below repaint
// the backdrop themselves, so the mark has to come away from it.
const BACKDROP = /<rect width="32" height="32" rx="6" fill="([^"]+)"\/>/
const backdrop = BACKDROP.exec(favicon)
if (!backdrop) {
  throw new Error('public/favicon.svg no longer opens with the backdrop rect')
}
const bg = backdrop[1]
const mark = favicon
  .replace(BACKDROP, '')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .trim()

const svg = (rx, inset) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
  `<rect width="32" height="32" rx="${rx}" fill="${bg}"/>` +
  (inset === 1
    ? mark
    : `<g transform="translate(${((1 - inset) * 32) / 2} ${((1 - inset) * 32) / 2}) scale(${inset})">${mark}</g>`) +
  `</svg>`

const ROUNDED = svg(6, 1)
const FULL_BLEED = svg(0, 1)
// 0.76 keeps every stroke inside the maskable safe zone (the inner 80% circle)
// with a little room for a launcher that crops slightly harder.
const MASKABLE = svg(0, 0.76)

const ICONS = [
  { name: 'icon-192.png', size: 192, art: ROUNDED, transparent: true },
  { name: 'icon-512.png', size: 512, art: ROUNDED, transparent: true },
  { name: 'icon-maskable-512.png', size: 512, art: MASKABLE },
  { name: 'apple-touch-icon.png', size: 180, art: FULL_BLEED },
]

const browser = await puppeteer.launch({
  browser: 'chrome',
  executablePath: CHROME,
  headless: true,
})
try {
  const page = await browser.newPage()
  for (const { name, size, art, transparent } of ICONS) {
    await page.setViewport({ width: size, height: size })
    await page.setContent(
      `<style>html,body{margin:0;background:${transparent ? 'transparent' : bg}}` +
        `svg{display:block;width:${size}px;height:${size}px}</style>${art}`,
    )
    const out = new URL(`public/${name}`, root)
    await page.screenshot({
      path: fileURLToPath(out),
      omitBackground: transparent === true,
    })
    console.log(`${name}  ${size}×${size}`)
  }
} finally {
  await browser.close()
}

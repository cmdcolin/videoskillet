import puppeteer from 'puppeteer-core'

// Checks what `/` shows before Firebase answers, against a built `dist/`.
//
// A browser that has never signed in gets the landing page from the first
// paint. One that has signed in before gets the skeleton, and then whichever
// state Firebase settles on; the landing page must never show first and then
// be swapped away. SignedInHint.astro's head script and `settle()` in
// site/scripts/home.ts are the two halves under test.
//
// No real account is involved, so "Firebase settles" here is always the
// signed-out answer. The two blocked cases hold back Firebase's `index.esm`
// chunks, which cloud.ts imports dynamically. Blocking every chunk would also
// catch modules home.ts imports statically, and a page whose script never runs
// has only the timeout to rescue it.
//
// Run: node scripts/homewait.mjs [dir]  (default dist)
import { FIREFOX } from './browser.mjs'
import { serveDist } from './static.mjs'

import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? 'dist'
const PORT = 8098
const BASE = `http://localhost:${PORT}/`
const HINT = 'videoskillet_signed_in'

if (!existsSync(join(root, 'index.html'))) {
  console.error(`no ${root}/index.html — run \`pnpm build\` first`)
  process.exit(1)
}

const server = await serveDist(root, PORT)
const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: true,
})

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let bad = 0
const check = (name, ok, seen) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}  ${JSON.stringify(seen)}`)
  if (!ok) bad++
}

// `block`: 'none', 'abort' (the SDK fails to load) or 'hold' (it never answers).
async function load(hint, block) {
  const page = await browser.newPage()
  await page.goto(`${BASE}privacy/`)
  await page.evaluate(
    (key, on) => (on ? localStorage.setItem(key, '1') : localStorage.clear()),
    HINT,
    hint,
  )
  let blocked = 0
  if (block !== 'none') {
    await page.setRequestInterception(true)
    page.on('request', req => {
      const url = req.url()
      if (url.includes('/_astro/index.esm.')) {
        blocked++
        if (block === 'abort') void req.abort()
      } else void req.continue()
    })
  }
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  const state = () =>
    page.evaluate(() => {
      const shown = sel =>
        getComputedStyle(document.querySelector(sel)).display !== 'none'
      return {
        pending: document.documentElement.dataset.home === 'pending',
        landing: shown('#landing'),
        skeleton: shown('.homeWait'),
      }
    })
  return { page, state, blocked: () => blocked }
}

{
  const { page, state } = await load(false, 'none')
  const early = await state()
  check('no hint: landing at once', early.landing && !early.skeleton, early)
  await page.close()
}

{
  const { page, state } = await load(true, 'none')
  const early = await state()
  check('hint: skeleton at once', early.skeleton && !early.landing, early)
  let late = await state()
  for (let i = 0; i < 40 && late.pending; i++) {
    await sleep(250)
    late = await state()
  }
  check(
    'hint, signed out: landing well before the timeout',
    late.landing && !late.pending,
    late,
  )
  await page.close()
}

{
  const { page, state, blocked } = await load(true, 'abort')
  let late = await state()
  for (let i = 0; i < 20 && late.pending; i++) {
    await sleep(250)
    late = await state()
  }
  check('hint, SDK fails: landing', late.landing && blocked() > 0, {
    ...late,
    blocked: blocked(),
  })
  await page.close()
}

{
  const { page, state, blocked } = await load(true, 'hold')
  await sleep(7000)
  const late = await state()
  check(
    'hint, SDK stalls: skeleton holds past 7s',
    late.skeleton && !late.landing && blocked() > 0,
    { ...late, blocked: blocked() },
  )
  await page.close()
}

await browser.close()
server.close()
console.log(bad === 0 ? 'homewait: all ok' : `homewait: ${bad} failed`)
process.exit(bad === 0 ? 0 : 1)

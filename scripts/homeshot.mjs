// The picture the two "why sign in?" cards show: the signed-in home, with a
// card to resume the last session and a grid of saved looks under it.
//
// No account is involved. The harness loads `/` signed out, reaches into the
// module the page already has (`showHome` in site/scripts/home.ts) and paints a
// home from a fixture — the gallery's own looks, their stills out of
// `public/demos`, dated to read as a fortnight of work. So the shot is the real
// page, in the real CSS, and regenerating it needs nothing but this repo.
//
// Usage: node scripts/homeshot.mjs [--out=public/home-signed-in.webp] [--keep]
//   needs Firefox Nightly and ImageMagick. Starts its own astro dev server,
//   so it does not touch a server you are working against. `--keep` writes the
//   full-size png beside the webp, for checking what the bottom edge cut.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
import { slug } from './demos.mjs'

import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}
const out = flag('out', 'public/home-signed-in.webp')
const keep = argv.includes('--keep')
const PORT = 4396

// The width the home's grid puts three looks across at. A wider page fits four,
// and four cards shrunk into a 500px card is where the names stop being
// readable. Drawn at twice this and resized down at the end, so the text in the
// picture stays sharp. The height only has to be enough to lay the page out;
// the shot's own comes from where the first row of looks ends.
const WIDTH = 1080
const HEIGHT = 860
const SCALE = 2

const MINUTE = 60000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const demos = JSON.parse(readFileSync('demos.json', 'utf8'))
const demo = name => {
  const hit = demos.find(d => d.name === name)
  if (hit === undefined) throw new Error(`no demo called ${name}`)
  return { name, query: hit.query, still: `/demos/${slug(name)}.webp` }
}

// Six saved looks, dated over a fortnight, so the grid runs past the edge of
// the picture the way a used account's does.
const SAVED = [
  'Ridiculous rainbow',
  'Laser duck',
  'Messed up clouds',
  'Dark zone',
  'Ponderorb',
  'Collecting dust',
].map(demo)

// One session, so the shot is the resume card and the saved grid under it.
// "Earlier sessions" sits between the two, and a picture that has to hold all
// three reaches the saved looks below anything a card can show.
const SESSIONS = [{ ...demo('Rainborb'), ago: 35 * MINUTE }]

const SAVED_AGO = [2 * HOUR, 20 * HOUR, 3 * DAY, 4 * DAY, 9 * DAY, 16 * DAY]

// astro's own binary rather than `pnpm exec astro`, so the kill at the end
// reaches the server: killing pnpm leaves its child holding the port, and the
// next run finds the lock file and quietly attaches to the stale server.
// `--ignore-lock` for the same reason a private port is: a dev server somebody
// else is working against is none of this harness's business.
const server = spawn(
  'node',
  [
    'node_modules/astro/bin/astro.mjs',
    'dev',
    '--port',
    String(PORT),
    '--host',
    '127.0.0.1',
    '--ignore-lock',
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] },
)
const ready = new Promise((resolve, reject) => {
  let seen = ''
  server.stdout.on('data', chunk => {
    seen += chunk
    if (seen.includes('localhost:') || seen.includes('127.0.0.1:')) resolve()
  })
  server.on('exit', code => {
    reject(new Error(`astro dev exited (${code})`))
  })
  setTimeout(() => {
    reject(new Error('astro dev never came up'))
  }, 60000)
})
await ready

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: true,
})
const page = await browser.newPage()
await page.setViewport({
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: SCALE,
})
page.on('pageerror', err => {
  console.log('[pageerror]', String(err).slice(0, 300))
})

const dir = mkdtempSync(join(tmpdir(), 'homeshot-'))
const raw = join(dir, 'home.png')
let failed
try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0' })

  const drawn = await page.evaluate(
    async (saved, sessions, savedAgo) => {
      // The dev server serves the page's own script by its path, so the home
      // is painted by the module that paints it for a signed-in reader. Astro
      // bundles it behind a wrapper, so this is a second instance of it: it
      // binds the card's listeners twice, which costs a screenshot nothing.
      const home = await import('/site/scripts/home.ts')
      if (typeof home.showHome !== 'function') return 'home.ts has no showHome'

      const base64 = async url => {
        const blob = await (await fetch(url)).blob()
        return new Promise(resolve => {
          const reader = new FileReader()
          reader.addEventListener('load', () => {
            resolve(String(reader.result).split(',')[1])
          })
          reader.readAsDataURL(blob)
        })
      }

      const now = Date.now()
      const stills = new Map()
      const profiles = []
      for (const [i, look] of saved.entries()) {
        const id = `look${i}`
        profiles.push({
          name: look.name,
          query: look.query,
          id,
          savedAt: now - savedAgo[i],
        })
        // Untagged and stamped now, so every still counts as a picture of the
        // board its card offers (`stillShows`).
        stills.set(id, { webp: await base64(look.still), at: now })
      }
      const recent = []
      for (const [i, session] of sessions.entries()) {
        const id = `sess${i}`
        recent.push({ id, query: session.query, at: now - session.ago })
        stills.set(`_session-${id}`, {
          webp: await base64(session.still),
          at: now,
        })
      }

      home.showHome(
        { uid: 'shot', name: 'Colin', photo: null },
        { profiles, recent },
        stills,
        now,
      )
      // A gallery card below the fold has not been given its src yet, and the
      // mark on a look with no still is an svg Firefox declines to decode.
      await Promise.all(
        [...document.querySelectorAll('#home img')].map(img =>
          img.decode().catch(() => undefined),
        ),
      )
      return 'ok'
    },
    SAVED,
    SESSIONS,
    SAVED_AGO,
  )
  if (drawn !== 'ok') throw new Error(drawn)

  // The carousel keeps stepping under the home, and the gallery below it holds
  // clips this page has no reason to fetch.
  await page.evaluate(() => {
    for (const video of document.querySelectorAll('video')) video.pause()
    // Astro's dev toolbar floats over the bottom of every page it serves.
    document.querySelector('astro-dev-toolbar')?.remove()
    scrollTo(0, 0)
  })

  // The shot ends under the first row of saved looks: the bar, the resume card
  // and a row of the grid is what the sentence beside the picture promises, and
  // the rest of the page is more of the same row. Measured rather than dialled
  // in, so a card that changes height moves the edge with it.
  const height = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#saved .looks > li')]
    const top = Math.round(cards[0].getBoundingClientRect().top)
    const row = cards.filter(
      li => Math.round(li.getBoundingClientRect().top) === top,
    )
    const bottom = row.at(-1).getBoundingClientRect().bottom
    const next = cards[row.length]?.getBoundingClientRect().top
    // Stops in the gutter between the rows, so no card is half in the picture.
    return Math.ceil(next === undefined ? bottom + 24 : (bottom + next) / 2)
  })
  await page.setViewport({ width: WIDTH, height, deviceScaleFactor: SCALE })
  writeFileSync(raw, await page.screenshot({ type: 'png' }))
} catch (e) {
  failed = e
} finally {
  await browser.close()
  server.kill()
}
if (failed !== undefined) throw failed

// Both cards are about 500 CSS px across, so 1280 leaves a hidpi screen more
// than it can use and costs a quarter of what the raw shot does.
execFileSync('convert', [
  raw,
  '-resize',
  '1280x',
  '-quality',
  '82',
  '-define',
  'webp:method=6',
  out,
])
if (keep) {
  const png = out.replace(/\.webp$/, '.png')
  execFileSync('cp', [raw, png])
  console.log(png)
}
rmSync(dir, { recursive: true, force: true })
console.log(`${out}  ${execFileSync('identify', ['-format', '%wx%h %b', out])}`)

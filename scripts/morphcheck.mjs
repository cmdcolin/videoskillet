// How regularly the panel hears about a morph, and what each notify costs.
//
//   npx vite --port 5373 --strictPort
//   node scripts/morphcheck.mjs [url]
//
// Firefox Nightly, not Chrome: same reason as every other harness here (see
// CLAUDE.md). Serve it from a `git worktree add --detach` copy — an HMR reload
// mid-run restarts the engine under the measurement.
//
// The complaint this exists to measure: a morph looks chunky, and chunkier than
// the nominal 10Hz the engine aims for. Three mechanisms can produce that, and
// the run below separates them.
//
//   - `GLIDE_NOTIFY` counts *rendered* frames. `render()` returns at the frame
//     lock before it reaches `advanceGlide()`, so a 1/2 lock halves the panel's
//     update rate and a 1/4 lock quarters it. The `lock` arms measure this.
//   - A `>=` test against a frame period beats irregularly: six frames is
//     100.02ms and seven is 116.7ms, so the gate alternates. The interval
//     histogram shows this as two clusters rather than one.
//   - A notify costs a full App render, which can overrun a refresh and stretch
//     the count further. `renderMs` measures it: React flushes a SyncLane update
//     from a microtask, so a microtask queued *inside* the store listener runs
//     after the commit, and the delta across it is the render.
//
// Read the output as three numbers per arm: `p50` is the cadence, `p95/p50` is
// the regularity (1.0 is a metronome), and `renderMs.p95` is what a notify costs.

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'
// A headed window that gets covered stops being drawn — see frames.mjs.
import { watchFrames } from './frames.mjs'
// Boot waited for rather than slept through — see until.mjs.
import { appUp } from './until.mjs'

const url = new URL(process.argv[2] ?? 'http://localhost:5373/app/')
const SECONDS = 4
// frameLock as the control carries it: 0 renders every refresh, 1 every second
// one. Deliberately not LOCK_AUTO (4), which picks its own divisor from the
// loop's cadence and so would make two runs incomparable.
const LOCKS = [0, 1]

const pct = (xs, p) => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}
const r2 = n => (n === null ? null : Math.round(n * 100) / 100)

const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: FIREFOX,
  headless: false,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webgpu.ignore-blocklist': true,
  },
})

const fails = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1352, height: 900 })
  page.on('pageerror', e => fails.push(`pageerror: ${String(e).slice(0, 200)}`))
  // `pageerror` is uncaught exceptions only, and the failures this app cares
  // about are not thrown: a GPU error, a lost device, a decode that gave up all
  // arrive through a callback and end at one banner. A run that measured a
  // cadence under a GPU error measured a different app and said PASS.
  page.on('console', m => {
    if (m.type() === 'error') fails.push(`console: ${m.text().slice(0, 200)}`)
  })
  // The banner itself (ui/Stage.tsx), which is where every async failure ends
  // up. `gpu:` is the prefix useEngine puts on a GPUDevice error.
  const banner = async where => {
    const said = await page.evaluate(
      () => document.querySelector('[role="alert"]')?.textContent ?? '',
    )
    if (said !== '') fails.push(`banner ${where}: ${said.slice(0, 200)}`)
  }
  await page.goto(url.href, { waitUntil: 'networkidle0' })
  // A long morph on the ring, so the run measures the case the complaint is
  // about. Written before the page under test loads, because localStorage is
  // per origin and the panel reads this at mount.
  await page.evaluate(() => localStorage.setItem('videoskillet_morph', '4'))
  await page.goto(url.href, { waitUntil: 'networkidle0' })
  // Park the pointer clear of the preset chips: a stray hover swaps the caption
  // and a stray press applies a preset.
  await page.mouse.move(400, 500)
  await appUp(page, 8000)
  await watchFrames(page, { label: 'morphcheck' })

  // Two boards to fly between, captured once and reused by every arm, so the
  // arms differ only in the lock. The busy one comes from the app's own roll
  // rather than from a synthetic perturbation here: a harness that invents
  // values has to know every control's range, and a roll already lands on a
  // board the app considers legal.
  const boards = await page.evaluate(() => {
    const vf = window.vf
    const stock = { ...vf.getControls() }
    const roll = [...document.querySelectorAll('button')].find(b =>
      /roll/i.test(b.title ?? ''),
    )
    roll?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { stock, found: roll !== undefined }
  })
  if (!boards.found)
    fails.push('no roll button found, so there is no busy board to fly to')
  // Long enough for the ring's own 4s morph to land before the board is read.
  await new Promise(r => setTimeout(r, 5000))
  const rolled = await page.evaluate(() => ({ ...window.vf.getControls() }))
  await banner('after the roll')
  // The roll is free to land on a strobe, and this harness runs a headed window
  // several times in a row on somebody's desk. A gate cutting the beam a few
  // times a second is exactly the thing not to leave flashing there unasked,
  // and it is no part of what the run measures — so the destination keeps the
  // roll's breadth and the strobe's stock value.
  const busy = { ...rolled, strobeHz: boards.stock.strobeHz }

  const arm = (lock, stock, busy) =>
    page.evaluate(
      async (lockSel, from, to, secs) => {
        const vf = window.vf
        // The lock is a control, so it has to hold the same value at both ends
        // or the glide flies it and the arm measures a moving target.
        const a = { ...from, frameLock: lockSel }
        const b = { ...to, frameLock: lockSel }
        vf.applyControls(a)
        await new Promise(r => setTimeout(r, 600))

        const notifies = []
        const glides = []
        const rafs = []
        // Queued inside the listener, so it runs after React has flushed the
        // SyncLane update this notify scheduled. The delta is the commit.
        const offControls = vf.subscribeControls(() => {
          const t = performance.now()
          queueMicrotask(() => notifies.push([t, performance.now()]))
        })
        const offGlide = vf.subscribeGlide(() => glides.push(performance.now()))
        let stop = false
        const tick = () => {
          if (stop) return
          rafs.push(performance.now())
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)

        const t0 = performance.now()
        vf.startGlide({
          to: b,
          seconds: secs,
          switchKeys: new Set(),
          holdKeys: new Set(),
          // Empty rather than absent: `Glide.start` dereferences this for every
          // moved key, so a plan without it throws. No curved tracks means the
          // values travel their value instead of their slider, which changes
          // what the picture does and not when the panel hears about it.
          tracks: new Map(),
        })
        await new Promise(r => setTimeout(r, secs * 1000 + 700))
        stop = true
        offControls()
        offGlide()
        return { t0, notifies, glides, rafs, frames: vf.frameNo() }
      },
      lock,
      stock,
      busy,
      SECONDS,
    )

  const report = []
  for (const lock of LOCKS) {
    const out = await arm(lock, boards.stock, busy)
    await banner(`after the 1/${lock + 1} arm`)
    // Only the notifies inside the flight; the settling ones either side say
    // nothing about cadence.
    const inFlight = out.notifies.filter(
      ([t]) => t >= out.t0 && t <= out.t0 + SECONDS * 1000,
    )
    const gaps = inFlight.slice(1).map(([t], i) => t - inFlight[i][0])
    const renderMs = inFlight.map(([t, after]) => after - t)
    const rafGaps = out.rafs.slice(1).map((t, i) => t - out.rafs[i])
    const glideGaps = out.glides.slice(1).map((t, i) => t - out.glides[i])
    report.push({
      lock: `1/${lock + 1}`,
      notifies: inFlight.length,
      hz: r2(inFlight.length / SECONDS),
      gap: {
        p50: r2(pct(gaps, 50)),
        p95: r2(pct(gaps, 95)),
        max: r2(pct(gaps, 100)),
      },
      jitter: r2(pct(gaps, 95) / pct(gaps, 50)),
      renderMs: { p50: r2(pct(renderMs, 50)), p95: r2(pct(renderMs, 95)) },
      rafHz: r2(1000 / pct(rafGaps, 50)),
      glideHz: r2(1000 / pct(glideGaps, 50)),
    })
  }

  console.log(JSON.stringify(report, null, 2))
  for (const row of report) {
    console.log(
      `lock ${row.lock}: panel ${row.hz}Hz, gap p50 ${row.gap.p50}ms p95 ${row.gap.p95}ms (jitter ${row.jitter}x), render p95 ${row.renderMs.p95}ms, rAF ${row.rafHz}Hz, glide store ${row.glideHz}Hz`,
    )
  }
} catch (e) {
  fails.push(`threw: ${String(e).slice(0, 300)}`)
} finally {
  await browser.close()
}

if (fails.length) {
  console.error('FAIL (morphcheck)')
  for (const f of fails) console.error('  -', f)
  process.exit(1)
}
console.log('PASS (morphcheck)')

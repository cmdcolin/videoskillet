// Main-thread cost per frame: CPU sampling profile of the live app.
//
//   node scripts/cpuprof.mjs <url> <label> [seconds] [--scenario=…] [--vp=WxH]
//   node scripts/cpuprof.mjs http://localhost:4173/ stock 10 --scenario=allrows
//   node scripts/cpuprof.mjs http://localhost:4173/ drag 10 --scenario=drag
//   …--scenario=drag --control=bloom     # hold a different knob down
//   …--scenario=drag --filter=saturation # …with only its own rows mounted
//
// The other two measurement harnesses are both GPU-side: `gpuprof` times each
// pass on the GPU's own counter, and `perf.mjs` is wall clock around batched
// `vf.step()` with the loop stopped. Neither can see the thread that feeds
// them, and that thread is where React, the uniform pack, the per-line CPU
// state and the render loop's own bookkeeping all land.
//
// **Chrome, and that is not the usual reason.** Every other browser harness
// here is Firefox Nightly because Firefox is what this app is developed
// against; this one is Chrome because Chrome is the browser whose main thread
// needs watching. It is the one with `importExternalTexture`, and — measured
// here — the one that resolves `onSubmittedWorkDone` in ~0.1 ms rather than
// Firefox's ~17 ms, which is the difference that hid a 3.6 ms/frame spin in
// the render loop for the life of that gate. A Firefox-only profile would have
// read zero. Run it against Firefox's numbers, not instead of them.
//
// Traps, each of which cost a wrong answer here:
//
//  - **Point it at a built app, never the dev server.** A dev-build profile of
//    this app is a profile of React's development machinery. Measured: the
//    whole panel mounted and a slider held down, dev fell to 24 fps at 16
//    pointer moves a second and spent 43% of the thread in `jsxDEV`,
//    `validateProperty` and `logComponentRender`, none of which ship; the
//    production build of the same commit held 59 fps at 60 moves a second. The
//    script says so if the page looks like dev, and it is not a formality.
//  - **Frame rate will tell you nothing.** The loop is vsync-capped, so a fifth
//    of the budget goes before a frame is missed. `TaskDuration` per frame is
//    the number; fps is only there to prove the page was alive.
//  - **`(program)` is not noise.** V8 charges the browser's own C++ to it —
//    WebGPU validation, submission, the far side of a promise — so a cost with
//    no JS frame to attribute it to shows up there and nowhere else. The
//    drain-probe spin was 3.1 of its 3.6 ms.
//  - Serve from a `git worktree add --detach` copy if anything might be editing
//    the tree, and close other WebGPU tabs: a neighbour costs whole batches.

import puppeteer from 'puppeteer-core'

import { existsSync } from 'node:fs'
import { platform } from 'node:process'

// Chrome, wherever this box keeps it. CHROME= overrides.
const CHROMES =
  platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
      ]
const chrome =
  process.env.CHROME ?? CHROMES.find(p => existsSync(p)) ?? CHROMES[0]

const args = process.argv.slice(2)
const flag = (p, d) => args.find(a => a.startsWith(p))?.slice(p.length) ?? d
const [url, label, secsArg] = args.filter(a => !a.startsWith('--'))
// idle: the app as it rests. allrows: every stage unfolded behind a live filter
// query, which is the panel at its heaviest — 230 sliders. drag: the same panel
// with a slider held down, which is the only thing that asks React for work at
// anything like frame rate.
const scenario = flag('--scenario=', 'idle')
// Which slider `drag` holds down, matched on the start of its label. Named so
// two arms drag the same control; a cheap uniform knob by default, so what is
// measured is the panel and not one control's own simulation cost.
const control = flag('--control=', 'saturation').toLowerCase()
// What goes in the filter box, which is what decides how much of the panel is
// mounted. 'e' matches every slider; a control's own name mounts a handful.
// Worth varying: the panel's cost under a drag scales with what is on screen,
// and so does what the presets rail below it is doing.
const filter = flag('--filter=', 'e')
const [vw, vh] = flag('--vp=', '1600x1000').split('x').map(Number)
const seconds = Number(secsArg ?? 10)

if (!url || !label) {
  console.error(
    'usage: node scripts/cpuprof.mjs <url> <label> [seconds] [--scenario=idle|allrows|drag] [--vp=WxH]',
  )
  process.exit(1)
}
if (!existsSync(chrome)) {
  console.error(`no Chrome at ${chrome} — set CHROME=/path/to/chrome`)
  process.exit(1)
}

const browser = await puppeteer.launch({
  browser: 'chrome',
  executablePath: chrome,
  headless: false,
  defaultViewport: { width: vw, height: vh },
  args: [
    '--enable-unsafe-webgpu',
    '--use-mock-keychain',
    '--no-first-run',
    `--window-size=${vw},${vh + 120}`,
  ],
})
try {
  const page = await browser.newPage()
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)))
  await page.goto(url, { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => window.vf !== undefined, { timeout: 30000 })
  await new Promise(r => setTimeout(r, 3500)) // sources settle

  const isDev = await page.evaluate(
    () => document.querySelector('script[src*="/@vite/client"]') !== null,
  )
  if (isDev)
    console.log(
      '  ! DEV SERVER. React ships a different library in production and this profile is mostly it. Build and preview.',
    )

  // Every stage unfolded, which is what a live filter query does (app.tsx's
  // `expandAll`). The one interaction here that cannot go in through the query
  // string, so the ⌕ is pressed and a query typed — and the box only exists
  // once the ⌕ has mounted it, so the press is not optional.
  if (scenario === 'allrows' || scenario === 'drag') {
    const opener = await page.$('button[aria-label="filter the controls"]')
    if (opener) {
      await opener.click()
      await new Promise(r => setTimeout(r, 400))
    }
    const box = await page.$('input[placeholder*="rainbow"]')
    if (box) {
      await box.click()
      await box.type(filter)
      await new Promise(r => setTimeout(r, 1500))
    } else {
      console.log('  ! filter box not found; profiling the panel as it rests')
    }
  }
  const mounted = await page.evaluate(() => ({
    nodes: document.querySelectorAll('*').length,
    sliders: document.querySelectorAll('input[type=range]').length,
  }))

  const cdp = await page.createCDPSession()
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
  await cdp.send('Performance.enable')
  const metrics = async () =>
    Object.fromEntries(
      (await cdp.send('Performance.getMetrics')).metrics.map(m => [
        m.name,
        m.value,
      ]),
    )
  const m0 = await metrics()
  const f0 = await page.evaluate(() => window.vf?.frame ?? 0)
  await cdp.send('Profiler.start')

  let note = ''
  if (scenario === 'drag') {
    // By label, and that is the difference between a measurement and a number.
    // Taking whichever slider the result set happens to put in some position
    // drags a different control in every arm, and the controls are not
    // interchangeable: one is a uniform field and the next rebuilds the filter
    // bank or adds a dub generation. Arms built that way came back 27-36 fps in
    // no order, which reads as contention and is the scenario moving.
    const target = await page.evaluateHandle(want => {
      const label = [...document.querySelectorAll('label')].find(l =>
        (l.textContent ?? '').trim().toLowerCase().startsWith(want),
      )
      const el = label ? document.getElementById(label.htmlFor) : null
      return el instanceof HTMLInputElement && el.type === 'range' ? el : null
    }, control)
    const bb = await target.asElement()?.boundingBox()
    if (bb) {
      await page.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height / 2)
      await page.mouse.down()
      const t0 = Date.now()
      let moves = 0
      while (Date.now() - t0 < seconds * 1000) {
        const f = ((Date.now() - t0) / 1500) % 1
        await page.mouse.move(
          bb.x + bb.width * (0.25 + 0.5 * f),
          bb.y + bb.height / 2,
        )
        moves += 1
        await new Promise(r => setTimeout(r, 8))
      }
      await page.mouse.up()
      // A real hand delivers pointer moves faster than a driven one can; this
      // is a floor on the drag's cost, not a ceiling.
      note = `  drag: "${control}", ${moves} pointer moves (${(moves / seconds).toFixed(0)}/s, a driven mouse — a hand is faster)`
    } else {
      console.log(
        `  ! no slider labelled "${control}" on screen; profiling idle instead`,
      )
      await new Promise(r => setTimeout(r, seconds * 1000))
    }
  } else {
    await new Promise(r => setTimeout(r, seconds * 1000))
  }

  const { profile } = await cdp.send('Profiler.stop')
  const f1 = await page.evaluate(() => window.vf?.frame ?? 0)
  const m1 = await metrics()

  // Self time per node, out of the sample stream: each sample is charged to the
  // frame that was on top, for the interval since the sample before it.
  const byId = new Map(profile.nodes.map(n => [n.id, n]))
  const self = new Map()
  let wall = 0
  for (let i = 0; i < profile.samples.length; i++) {
    const d = profile.timeDeltas[i] ?? 0
    wall += d
    const id = profile.samples[i]
    self.set(id, (self.get(id) ?? 0) + d)
  }
  const name = id => {
    const f = byId.get(id)?.callFrame
    if (!f) return ''
    const file = (f.url || '').split('/').pop()?.split('?')[0] ?? ''
    return `${f.functionName || '(anonymous)'}${file ? ` @${file}:${f.callFrameLine ?? f.lineNumber + 1}` : ''}`
  }
  const bucket = re =>
    [...self.entries()]
      .filter(([id]) => re.test(name(id)))
      .reduce((s, [, us]) => s + us, 0)
  const idle = bucket(/^\(idle\)/)
  const gc = bucket(/garbage collector/)
  const prog = bucket(/^\(program\)/)
  const busy = wall - idle - gc - prog
  const frames = f1 - f0
  const per = us => (frames > 0 ? `${(us / frames).toFixed(0)}us/f` : '—')

  console.log(
    `\n=== ${label} [${scenario}${scenario === 'idle' ? '' : ` "${filter}"`}]  ${(wall / 1000).toFixed(0)}ms  ${vw}x${vh}  ${mounted.nodes} nodes, ${mounted.sliders} sliders`,
  )
  if (note) console.log(note)
  console.log(
    `    ${frames} frames (${(frames / (wall / 1e6)).toFixed(1)} fps) — fps is proof of life, not the measurement`,
  )
  console.log(
    `    JS busy ${per(busy)}   (program) ${per(prog)}   GC ${per(gc)}   idle ${((100 * idle) / wall).toFixed(1)}%`,
  )
  const d = k => ((m1[k] ?? 0) - (m0[k] ?? 0)) * 1e6
  console.log(
    `    TaskDuration ${per(d('TaskDuration'))}  <- the main thread's cost per frame`,
  )
  console.log(
    `    Script ${per(d('ScriptDuration'))}  Layout ${per(d('LayoutDuration'))} (${m1.LayoutCount - m0.LayoutCount}x)  RecalcStyle ${per(d('RecalcStyleDuration'))} (${m1.RecalcStyleCount - m0.RecalcStyleCount}x)`,
  )

  console.log('\n  top self time:')
  const rows = [...self.entries()]
    .filter(([id]) => !/^\((idle|program)\)/.test(name(id)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
  for (const [id, us] of rows)
    console.log(
      `   ${(us / 1000).toFixed(2).padStart(8)}ms ${((100 * us) / wall).toFixed(2).padStart(5)}% ${per(us).padStart(9)}  ${name(id)}`,
    )
} finally {
  await browser.close()
}

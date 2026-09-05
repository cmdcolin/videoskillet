// Guards the beam profile against beating with the output raster. Colour bars
// are constant down each column, so every row-to-row change in the canvas is
// the profile and nothing else; a window carrying fewer than two pixels per
// line used to turn the scanline gaps into coarse horizontal bands, 8% deep and
// 7 px apart at 480 lines across 555 pixels. Reports, per viewport, the
// strongest ripple slower than the line pitch — which the structure itself
// cannot produce, so anything there is the beat.
//
// A retina window carries twice the pixels per line and never showed the fault,
// which is why both device pixel ratios are in the list.
// Usage: node scripts/bandcheck.mjs [port]

import puppeteer from 'puppeteer-core'

import { FIREFOX } from './browser.mjs'

const port = process.argv[2] ?? '5199'
const url = `http://localhost:${port}/app/#src=bars&set=scanBeam:1,scanBloom:0,maskAmt:0,crtZoom:1`

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
const page = await browser.newPage()
page.on('pageerror', err =>
  console.log('[pageerror]', String(err).slice(0, 300)),
)

// A retina screen doubles the canvas, so the same window lands at twice the
// pixels per line — the check has to cover both or it only ever sees one half
// of the range the fault lives in.
const sizes = [
  [1352, 900, 1],
  [1280, 800, 1],
  [1100, 760, 1],
  [1600, 1100, 1],
  [1920, 1300, 1],
  [1352, 900, 2],
  [1100, 760, 2],
]

await page.setViewport({ width: sizes[0][0], height: sizes[0][1] })
await page.goto(url, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 6000))

let fails = 0
for (const [w, h, dpr] of sizes) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr })
  await new Promise(r => setTimeout(r, 1200))
  await page.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      window.vf?.step()
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 15))
    }
  })
  const r = await page.evaluate(() => {
    const cv = document.querySelector('canvas')
    const oc = new OffscreenCanvas(cv.width, cv.height)
    const g = oc.getContext('2d')
    g.drawImage(cv, 0, 0)
    // A column band inside one colour bar, away from the letterbox edges.
    const x0 = Math.round(cv.width * 0.3)
    const x1 = Math.round(cv.width * 0.36)
    const y0 = Math.round(cv.height * 0.25)
    const y1 = Math.round(cv.height * 0.75)
    const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data
    const wid = x1 - x0
    const rows = []
    for (let y = 0; y < y1 - y0; y++) {
      let s = 0
      for (let x = 0; x < wid; x++) {
        const i = (y * wid + x) * 4
        s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      }
      rows.push(s / wid)
    }
    return { rows, cw: cv.width, ch: cv.height }
  })
  const scale = Math.min(r.cw / 4, r.ch / 3)
  const pxPerLine = (3 * scale) / 480
  const N = r.rows.length
  const mean = r.rows.reduce((a, b) => a + b, 0) / N
  // Shading down the picture is content, not a beat, so take it out: subtract a
  // 41-px running mean and look only at what is left.
  const w2 = 20
  const det = r.rows.map((v, n) => {
    let s = 0
    let c = 0
    for (let k = Math.max(0, n - w2); k <= Math.min(N - 1, n + w2); k++) {
      s += r.rows[k]
      c++
    }
    return v - s / c
  })
  // Strongest periodic component at 3 px and slower, as a share of the mean:
  // a genuine line pitch below 3 px cannot produce one, so whatever shows here
  // is the beat rather than the structure.
  let worst = 0
  let worstPeriod = 0
  // Only periods well slower than the line pitch itself: at the pitch the ripple
  // is the scanlines, which is the thing being kept.
  for (
    let period = Math.max(3, 1.6 * pxPerLine);
    period <= 20;
    period += 0.125
  ) {
    let re = 0
    let im = 0
    for (let n = 0; n < N; n++) {
      const th = (2 * Math.PI * n) / period
      re += det[n] * Math.cos(th)
      im -= det[n] * Math.sin(th)
    }
    const amp = (2 * Math.hypot(re, im)) / N
    if (amp > worst) {
      worst = amp
      worstPeriod = period
    }
  }
  // How much scanline is left: peak-to-peak of the detrended rows, which at
  // these sizes is the line structure and nothing else.
  const contrast = (Math.max(...det) - Math.min(...det)) / mean
  const depth = (100 * worst) / mean
  // Grain and the picture's own shading leave about 1.5% behind at every size,
  // so the floor is noise rather than a beat. The fault this guards ran 5.5% to
  // 8.2%; 3% sits clear of both.
  const ok = depth < 3
  fails += ok ? 0 : 1
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${w}x${h} @${dpr}x  canvas ${r.cw}x${r.ch}  ` +
      `px/line ${pxPerLine.toFixed(3)}  band ${depth.toFixed(2)}% ` +
      `at ${worstPeriod.toFixed(2)} px  scanlines ${(100 * contrast).toFixed(1)}%`,
  )
}

await page.evaluate(() => window.vf?.destroy())
await browser.close()
if (fails > 0) {
  console.error(`FAILED: ${fails} viewport(s) band above 3%`)
  process.exit(1)
}

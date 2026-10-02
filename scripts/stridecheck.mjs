// Does this browser build a VideoFrame from padded rows the way FrameRead
// needs it to?
//
//   node scripts/stridecheck.mjs [--browser=firefox|chrome] [--width=1494]
//
// A GPU copy pads each row to a multiple of 256 bytes, so a take whose width is
// not a multiple of 64 hands the recorder rows longer than `width * 4`. Three
// questions, each about a way of telling a VideoFrame that:
//
//   - layout: `new VideoFrame(buffer, { layout: [{ stride }] })`, read back
//     with `copyTo`. Firefox Nightly 151 ignores the stride and reads row 1
//     from the padding; Chrome 154 reads it right.
//   - crop: a coded width of `stride / 4` cropped by `visibleRect`, read back
//     with `copyTo`. Both browsers read it right.
//   - encoded: the crop, through the H.264 encoder and back. Firefox scales the
//     whole coded width down to the visible one, so bars drawn 64 px apart come
//     back 62.25 px apart; Chrome crops them and keeps 64.
//
// FrameRead packs the rows itself (`frameread.ts`), so none of these decides
// whether a take comes out right today. Rerun this against a new browser build
// before going back to a cheaper route. WebCodecs only: no WebGPU and no dev
// server needed.

import puppeteer from 'puppeteer-core'

import { CHROME, FIREFOX } from './browser.mjs'

import { createServer } from 'node:http'
import process from 'node:process'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}
const which = flag('browser', 'firefox')
const W = Number(flag('width', '1494'))
const H = 902

// Over http://localhost: WebCodecs is secure-context only, and about:blank is
// not one.
const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end('<!doctype html><meta charset=utf-8><title>stridecheck</title><body>')
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const browser = await puppeteer.launch({
  browser: which === 'chrome' ? 'chrome' : 'firefox',
  executablePath: which === 'chrome' ? CHROME : FIREFOX,
  headless: true,
  protocolTimeout: 120_000,
})
const page = await browser.newPage()
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' })

const out = await page.evaluate(
  async (W, H) => {
    const stride = Math.ceil((W * 4) / 256) * 256
    // Grey bars 64 px wide on black, and red in the padding, so a misread row
    // and a scaled one both show.
    const buf = new Uint8Array(stride * H)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < stride / 4; x++) {
        const o = y * stride + x * 4
        const v = x >= W ? 0 : Math.floor(x / 64) % 2 === 0 ? 255 : 0
        buf.set(x >= W ? [0, 0, 255, 255] : [v, v, v, 255], o)
      }
    const rowsRight = async frame => {
      const tight = new Uint8Array(W * H * 4)
      await frame.copyTo(tight, {
        rect: { x: 0, y: 0, width: W, height: H },
        layout: [{ offset: 0, stride: W * 4 }],
      })
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (tight[(y * W + x) * 4] !== buf[y * stride + x * 4])
            return `first wrong pixel at (${x}, ${y})`
      return 'right'
    }
    const init = { format: 'BGRX', codedHeight: H, timestamp: 0 }
    const layout = new VideoFrame(buf, {
      ...init,
      codedWidth: W,
      layout: [{ offset: 0, stride }],
    })
    const crop = new VideoFrame(buf, {
      ...init,
      codedWidth: stride / 4,
      visibleRect: { x: 0, y: 0, width: W, height: H },
    })
    const r = {
      stride,
      layout: await rowsRight(layout),
      crop: await rowsRight(crop),
    }
    layout.close()

    let config = null
    const chunks = []
    const enc = new VideoEncoder({
      output: (c, m) => {
        if (m?.decoderConfig) config = m.decoderConfig
        chunks.push(c)
      },
      error: e => (r.encoded = String(e)),
    })
    enc.configure({
      codec: 'avc1.640032',
      width: W,
      height: H,
      bitrate: 20e6,
      framerate: 60,
      avc: { format: 'avc' },
    })
    enc.encode(crop, { keyFrame: true })
    crop.close()
    await enc.flush()
    let back = null
    const dec = new VideoDecoder({
      output: f => (back = f),
      error: e => (r.encoded = String(e)),
    })
    dec.configure(config)
    dec.decode(chunks[0])
    await dec.flush()
    const g = new OffscreenCanvas(W, H).getContext('2d')
    g.drawImage(back, 0, 0)
    const row = g.getImageData(0, H >> 1, W, 1).data
    const edges = []
    for (let x = 1; x < W; x++)
      if (row[x * 4] > 128 !== row[(x - 1) * 4] > 128) edges.push(x)
    const n = Math.floor(W / 64) - 2
    r.encoded = `bars ${((edges[n] - edges[0]) / n).toFixed(2)} px apart`
    return r
  },
  W,
  H,
)

const version = await browser.version()
await browser.close()
server.close()
console.log(`${version} at ${W} wide, stride ${out.stride}`)
console.log(`  layout:  ${out.layout}`)
console.log(`  crop:    ${out.crop}`)
console.log(`  encoded: ${out.encoded}, 64 if cropped`)

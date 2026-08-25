// What the encoder will accept, and what the picture costs at each setting.
//
//   node scripts/enccheck.mjs [--browser=chrome|firefox] [--path=<binary>]
//
// A measurement, not a check — it is not in `sweep.mjs`, and it prints numbers
// rather than passing or failing. It is the working-out behind
// [`adr/0008`](../docs/adr/0008-record-h264-high-and-mind-the-chroma.md), kept
// so the numbers there can be re-derived against a new browser build rather
// than believed.
//
// It never touches the app. Every frame it encodes is synthetic and handed over
// as raw planar YUV — `I420` for the profile arm, `I444` for the chroma arm —
// so nothing measured here depends on a canvas, a device, or an RGB->YUV
// conversion on the way in. That is deliberate: `ui/record.ts` feeds the
// encoder from a WebGPU canvas, and a conversion in that path would be a
// constant across every arm below and so cannot change the ranking, but it
// would sit in every absolute number and make them mean something else.
//
// **The source is deliberately worse than the app's picture.** Grain at 46/255
// with one-pixel structure over it is close to incompressible, so the Mbps
// figures are an upper bound and the dB figures a lower one. What transfers is
// the ordering between arms, which is what the ADR reads off it.
//
// Three arms, and the third is the one that changed a design:
//
//   1. **Support.** Which profile/level/mode combinations `isConfigSupported`
//      admits at 2560x1600. It is worth asking rather than assuming: this is
//      what says the probe in `ui/record.ts` discriminates at all.
//   2. **Profile.** Baseline vs Main vs High at one bitrate, plus what raising
//      the bitrate and forcing software actually buy.
//   3. **Chroma.** The same picture through a 4:2:0 codec and a 4:4:4 one,
//      scored on chroma separately from luma. The luma columns are close and
//      the chroma columns are 25 dB apart, which is the finding.
//
// PSNR is measured by decoding the file back and comparing against the source
// planes — for a 4:2:0 arm the decoded chroma is upsampled to full resolution
// first, because the fidelity being scored is the one a viewer sees and not the
// one the codec's own sample grid flatters.

import puppeteer from 'puppeteer-core'

import { createServer } from 'node:http'
import process from 'node:process'

const arg = (name, fallback) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const which = arg(
  'browser',
  process.platform === 'darwin' ? 'chrome' : 'firefox',
)
const path = arg(
  'path',
  which === 'chrome' ? CHROME : '/usr/bin/firefox-nightly',
)

// WebCodecs is secure-context only and `about:blank` is not one, so this serves
// an empty page over http://localhost rather than probing somewhere the app
// never runs. `codeccheck.mjs` learned that the expensive way.
const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end('<!doctype html><meta charset=utf-8><title>enccheck</title><body>')
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const browser = await puppeteer.launch({
  browser: which,
  executablePath: path,
  headless: false,
  protocolTimeout: 1_800_000,
})
const page = await browser.newPage()
page.on('pageerror', e => console.error('pageerror', String(e).slice(0, 300)))
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' })
await page.bringToFront()

const support = await page.evaluate(async () => {
  const rows = []
  const profiles = {
    baseline: 'avc1.4200',
    main: 'avc1.4d00',
    high: 'avc1.6400',
    high10: 'avc1.6e00',
    'high 4:2:2': 'avc1.7a00',
    'high 4:4:4': 'avc1.f400',
  }
  for (const [name, prefix] of Object.entries(profiles)) {
    const levels = []
    for (const [ln, code] of Object.entries({
      4.2: '2a',
      '5.0': '32',
      5.1: '33',
      '6.0': '3c',
    })) {
      const ok = await VideoEncoder.isConfigSupported({
        codec: `${prefix}${code}`,
        width: 2560,
        height: 1600,
        bitrate: 60e6,
        framerate: 60,
        avc: { format: 'avc' },
        latencyMode: 'quality',
      }).then(
        r => r.supported === true,
        () => false,
      )
      if (ok) levels.push(ln)
    }
    rows.push([name, levels])
  }
  const others = []
  for (const [name, codec] of [
    ['VP9 p0 4:2:0', 'vp09.00.51.08'],
    ['VP9 p1 4:4:4', 'vp09.01.51.08.03'],
    ['AV1 4:2:0', 'av01.0.13M.08'],
    ['AV1 4:4:4', 'av01.1.13M.08'],
    ['HEVC main', 'hvc1.1.6.L153.B0'],
  ]) {
    const ok = await VideoEncoder.isConfigSupported({
      codec,
      width: 2560,
      height: 1600,
      bitrate: 60e6,
      framerate: 60,
      latencyMode: 'quality',
    }).then(
      r => r.supported === true,
      () => false,
    )
    others.push([name, ok])
  }
  return { rows, others }
})

console.log(
  '\n--- 1. what configure will admit, 2560x1600 @60 -----------------\n',
)
for (const [name, levels] of support.rows) {
  console.log(
    `  H.264 ${name}`.padEnd(24),
    levels.length === 0
      ? 'declined at every level'
      : `levels ${levels.join(' ')}`,
  )
}
for (const [name, ok] of support.others) {
  console.log(`  ${name}`.padEnd(24), ok ? 'yes' : 'no')
}

// The two quality arms share a shape: build planar frames, encode, decode back,
// score against the planes that went in.
const measure = async (page, opts) =>
  page.evaluate(async o => {
    const { W, H, N, FPS, chroma444, cases } = o
    const ps = W * H
    let seed = 12345
    const rnd = () =>
      ((seed = (seed * 1664525 + 1013904223) >>> 0) >>> 8) / 16777216
    const planes = chroma444 ? 3 : 1.5
    const src = []
    for (let f = 0; f < N; f++) {
      const b = new Uint8Array(ps * planes)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const line = ((x + f) & 1) * 40 + ((y & 3) < 2 ? 18 : 0)
          const band =
            60 + 50 * Math.sin((x + f * 7) * 0.11) * Math.sin(y * 0.013)
          b[y * W + x] = Math.max(16, Math.min(235, band + line + rnd() * 46))
        }
      }
      if (chroma444) {
        // One-pixel alternating chroma: what dot crawl is, and what a 4:2:0
        // sample grid has nowhere to put.
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = y * W + x
            b[ps + i] = Math.max(
              16,
              Math.min(
                240,
                128 + ((x + y + f) & 1 ? 45 : -45) + 30 * Math.sin(y * 0.05),
              ),
            )
            b[ps * 2 + i] = Math.max(
              16,
              Math.min(
                240,
                128 + ((x - y + f) & 1 ? -40 : 40) + 30 * Math.cos(x * 0.04),
              ),
            )
          }
        }
      } else {
        const cs = (W / 2) * (H / 2)
        for (let i = 0; i < cs; i++) {
          const cx = i % (W / 2)
          const cy = (i / (W / 2)) | 0
          b[ps + i] = Math.max(
            16,
            Math.min(
              240,
              128 + 40 * Math.sin((cx + f * 3) * 0.21) + rnd() * 20,
            ),
          )
          b[ps + cs + i] = Math.max(
            16,
            Math.min(240, 128 + 40 * Math.cos(cy * 0.17 + f) + rnd() * 20),
          )
        }
      }
      src.push(b)
    }

    const psnr = (sse, n) =>
      +(10 * Math.log10((255 * 255) / (sse / n))).toFixed(2)

    const run = async c => {
      const chunks = []
      let desc = null
      let failure = ''
      const enc = new VideoEncoder({
        output: (chunk, meta) => {
          const d = meta?.decoderConfig?.description
          if (desc === null && d !== undefined) {
            desc = ArrayBuffer.isView(d)
              ? new Uint8Array(
                  d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength),
                )
              : new Uint8Array(d)
          }
          const data = new Uint8Array(chunk.byteLength)
          chunk.copyTo(data)
          chunks.push({
            data,
            type: chunk.type,
            timestamp: chunk.timestamp,
            duration: chunk.duration,
          })
        },
        error: e => {
          failure = String(e)
        },
      })
      const isAvc = c.codec.startsWith('avc1')
      enc.configure({
        codec: c.codec,
        width: W,
        height: H,
        framerate: FPS,
        bitrate: c.bitrate,
        latencyMode: 'quality',
        ...(isAvc ? { avc: { format: 'avc' } } : {}),
        ...(c.qp === undefined ? {} : { bitrateMode: 'quantizer' }),
        ...(c.hw === undefined ? {} : { hardwareAcceleration: c.hw }),
      })
      for (let i = 0; i < N; i++) {
        const frame = new VideoFrame(src[i], {
          format: chroma444 ? 'I444' : 'I420',
          codedWidth: W,
          codedHeight: H,
          timestamp: Math.round((i * 1e6) / FPS),
          duration: Math.round(1e6 / FPS),
        })
        const encodeOpts = { keyFrame: i === 0 }
        if (c.qp !== undefined) encodeOpts.avc = { quantizer: c.qp }
        enc.encode(frame, encodeOpts)
        frame.close()
        // The encoder is handed the main thread back periodically: a few
        // thousand unreleased frames in flight is how this harness first ran
        // out of memory rather than out of patience.
        if (i % 4 === 3) await new Promise(r => setTimeout(r, 0))
      }
      await enc.flush()
      enc.close()
      if (failure !== '') return { error: failure.slice(0, 90) }

      const bytes = chunks.reduce((a, c2) => a + c2.data.length, 0)
      let ySse = 0
      let cSse = 0
      let n = 0
      let fmt = ''
      let derr = ''
      const dec = new VideoDecoder({
        output: async frame => {
          fmt = frame.format
          const rect = { x: 0, y: 0, width: W, height: H }
          const buf = new Uint8Array(frame.allocationSize({ rect }))
          const L = await frame.copyTo(buf, { rect })
          const S = src[Math.round((frame.timestamp * FPS) / 1e6)]
          for (let y = 0; y < H; y++) {
            const so = y * W
            const dof = L[0].offset + y * L[0].stride
            for (let x = 0; x < W; x++) {
              const d = S[so + x] - buf[dof + x]
              ySse += d * d
            }
          }
          if (chroma444) {
            // Decoded chroma is read back at full resolution whatever grid it
            // was coded on, so a 4:2:0 arm is scored on what it can actually
            // reconstruct.
            const half = fmt.startsWith('NV12') || fmt.startsWith('I420')
            for (let y = 0; y < H; y++) {
              const sy = half ? y >> 1 : y
              for (let x = 0; x < W; x++) {
                const sx = half ? x >> 1 : x
                let u
                let v
                if (fmt.startsWith('NV12')) {
                  const o = L[1].offset + sy * L[1].stride + sx * 2
                  u = buf[o]
                  v = buf[o + 1]
                } else {
                  u = buf[L[1].offset + sy * L[1].stride + sx]
                  v = buf[L[2].offset + sy * L[2].stride + sx]
                }
                const du = S[ps + y * W + x] - u
                const dv = S[ps * 2 + y * W + x] - v
                cSse += du * du + dv * dv
              }
            }
          }
          n++
          frame.close()
        },
        error: e => {
          derr = String(e)
        },
      })
      dec.configure({
        codec: c.codec,
        codedWidth: W,
        codedHeight: H,
        ...(desc === null ? {} : { description: desc }),
      })
      for (const chunk of chunks) dec.decode(new EncodedVideoChunk(chunk))
      await dec.flush()
      dec.close()
      if (derr !== '') return { error: derr.slice(0, 90) }
      return {
        mbps: +((bytes * 8 * FPS) / N / 1e6).toFixed(1),
        luma: psnr(ySse, n * ps),
        chroma: chroma444 ? psnr(cSse, n * ps * 2) : null,
        fmt,
      }
    }

    const out = []
    for (const c of cases) {
      try {
        out.push([c.name, await run(c)])
      } catch (e) {
        out.push([c.name, { error: String(e).slice(0, 110) }])
      }
    }
    return out
  }, opts)

const profile = await measure(page, {
  W: 2560,
  H: 1600,
  N: 16,
  FPS: 60,
  chroma444: false,
  cases: [
    { name: 'baseline 5.0  VBR  60M', codec: 'avc1.420032', bitrate: 60e6 },
    { name: 'main     5.0  VBR  60M', codec: 'avc1.4d0032', bitrate: 60e6 },
    { name: 'high     5.0  VBR  60M', codec: 'avc1.640032', bitrate: 60e6 },
    { name: 'high     5.0  VBR 100M', codec: 'avc1.640032', bitrate: 100e6 },
    { name: 'high     5.0  VBR 200M', codec: 'avc1.640032', bitrate: 200e6 },
    { name: 'high     5.0  VBR 400M', codec: 'avc1.640032', bitrate: 400e6 },
    {
      name: 'high     5.0  sw  100M',
      codec: 'avc1.640032',
      bitrate: 100e6,
      hw: 'prefer-software',
    },
    {
      name: 'high     5.0  QP16',
      codec: 'avc1.640032',
      bitrate: 100e6,
      qp: 16,
    },
    {
      name: 'high     5.0  QP20',
      codec: 'avc1.640032',
      bitrate: 100e6,
      qp: 20,
    },
    {
      name: 'high     5.0  QP24',
      codec: 'avc1.640032',
      bitrate: 100e6,
      qp: 24,
    },
  ],
})

console.log(
  '\n--- 2. profile and rate, 2560x1600, 16 frames of grain ----------\n',
)
console.log(
  '  arm'.padEnd(26),
  'asked'.padStart(7),
  'written'.padStart(9),
  'luma'.padStart(9),
)
for (const [name, r] of profile) {
  const asked = name.match(/(\d+)M|QP(\d+)/)
  console.log(
    `  ${name}`.padEnd(26),
    (asked === null ? '' : asked[0]).padStart(7),
    r.error === undefined ? `${r.mbps} Mbps`.padStart(9) : `ERROR ${r.error}`,
    r.error === undefined ? `${r.luma} dB`.padStart(9) : '',
  )
}

const chroma = await measure(page, {
  W: 1280,
  H: 800,
  N: 12,
  FPS: 60,
  chroma444: true,
  cases: [
    { name: 'H.264 High 4:2:0', codec: 'avc1.640028', bitrate: 80e6 },
    { name: 'VP9   p0   4:2:0', codec: 'vp09.00.41.08', bitrate: 80e6 },
    { name: 'VP9   p1   4:4:4', codec: 'vp09.01.41.08.03', bitrate: 80e6 },
    { name: 'AV1   high 4:4:4', codec: 'av01.1.09M.08', bitrate: 80e6 },
  ],
})

console.log(
  '\n--- 3. chroma, 1280x800, one-pixel chroma detail, 80M asked -----\n',
)
console.log(
  '  arm'.padEnd(22),
  'written'.padStart(9),
  'luma'.padStart(9),
  'chroma'.padStart(9),
  '  decoded as',
)
for (const [name, r] of chroma) {
  console.log(
    `  ${name}`.padEnd(22),
    r.error === undefined ? `${r.mbps} Mbps`.padStart(9) : `ERROR ${r.error}`,
    r.error === undefined ? `${r.luma} dB`.padStart(9) : '',
    r.error === undefined ? `${r.chroma} dB`.padStart(9) : '',
    r.error === undefined ? `  ${r.fmt}` : '',
  )
}
console.log()

await browser.close()
server.close()

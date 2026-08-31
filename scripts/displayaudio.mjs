// What a share actually hands over when the page asks getDisplayMedia for
// audio — the two questions `AudioState.enableSystem` is written against, both
// of which the specs leave to the browser:
//
//   1. Does the audio survive the video track being stopped? There is no
//      audio-only display capture, so the app asks for a video track it has no
//      use for. If stopping it takes the sound with it, the app has to hold a
//      screen capture open for the whole session instead.
//   2. What does the default audio processing do to music? Display audio comes
//      through the same constraints a microphone does, and their defaults are
//      built for speech.
//
// Self-capture (`preferCurrentTab` + `--auto-accept-this-tab-capture`), so it
// runs unattended: the page plays a tone into its own output and then captures
// the tab it is playing in. That is a probe rig, not the app's patch — the app
// shares somebody else's tab, and capturing its own would be a loop.
//
// Chrome 151 / macOS 15.8, one 220 Hz tone, rms of the captured track:
//
//     arm                     channels  rate     before   after video.stop()
//     defaults                1         48000    0.0773   0.0259
//     processing off          2         44100    0.1759   0.1760
//
// Both answers are in that table. The audio track reads `live` and keeps its
// level after the video track ends, so the app stops that track on arrival; and
// the default chain costs two thirds of the level, a channel and a resample —
// and does not cost a fixed amount, which is the part that matters here. The
// defaults row is the only one that moves between runs (0.0589/0.0198 on the
// first), because what moves it is a gain control working, and a level that
// moves on its own is precisely what `stepHit` is built to read as a kick.
//
// Chrome only, and not because of what it measures — the flag that accepts a
// share without a hand on it is Chrome's. Firefox and Safari are documented to
// capture no audio here at all, which is the 'no-audio' answer the app's picker
// explains rather than a failure of this harness, and is the one claim on this
// page that was read rather than measured.
//
// Usage: node scripts/displayaudio.mjs

import puppeteer from 'puppeteer-core'

import { CHROME } from './browser.mjs'

import { createServer } from 'node:http'

const PAGE = `<!doctype html>
<meta charset=utf-8>
<title>display-audio probe</title>
<button id=go>go</button>
<pre id=out></pre>
<script>
const out = document.getElementById('out')
const log = m => { out.textContent += m + '\\n'; console.log('[probe] ' + m) }

// Something for the tab to be playing, so captured tab audio is not silence.
const ctx = new AudioContext()
const osc = ctx.createOscillator()
osc.frequency.value = 220
const g = ctx.createGain()
g.gain.value = 0.25
osc.connect(g).connect(ctx.destination)
osc.start()

const rms = async (track) => {
  const c = new AudioContext()
  const src = c.createMediaStreamSource(new MediaStream([track]))
  const an = c.createAnalyser()
  an.fftSize = 2048
  src.connect(an)
  await new Promise(r => setTimeout(r, 600))
  const buf = new Float32Array(an.fftSize)
  an.getFloatTimeDomainData(buf)
  let s = 0
  for (const v of buf) s += v * v
  await c.close()
  return Math.sqrt(s / buf.length)
}

// One arm: capture this tab, measure, drop the video track, measure again.
window.arm = async (processing) => {
  await ctx.resume()
  const audio = processing
    ? true
    : { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio,
    preferCurrentTab: true,
  })
  const a = stream.getAudioTracks()[0]
  const v = stream.getVideoTracks()[0]
  if (a === undefined) {
    for (const t of stream.getTracks()) t.stop()
    return { audio: false }
  }
  const settings = a.getSettings()
  const before = await rms(a)
  v.stop()
  await new Promise(r => setTimeout(r, 800))
  const state = a.readyState
  const after = state === 'live' ? await rms(a) : 0
  for (const t of stream.getTracks()) t.stop()
  return {
    audio: true,
    label: a.label,
    channels: settings.channelCount,
    rate: settings.sampleRate,
    before,
    state,
    after,
  }
}
</script>
`

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(PAGE)
})
await new Promise(r => server.listen(0, r))
const url = `http://localhost:${server.address().port}/`

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    '--auto-accept-this-tab-capture',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const page = await browser.newPage()
page.on('pageerror', e => console.log('[pageerror]', String(e)))
await page.goto(url, { waitUntil: 'load' })

const rows = []
for (const processing of [true, false]) {
  // The click is the transient activation getDisplayMedia requires; the arm
  // itself runs in the page and hands its numbers back.
  const r = await page.evaluate(
    p => window.arm(p).catch(e => ({ error: `${e.name}: ${e.message}` })),
    processing,
  )
  rows.push({ arm: processing ? 'defaults' : 'processing off', ...r })
}
await browser.close()
server.close()

const n = x => (typeof x === 'number' ? x.toFixed(4) : String(x))
console.log('arm             audio  ch  rate   before   after    state')
for (const r of rows) {
  console.log(
    `${r.arm.padEnd(15)} ${String(r.audio).padEnd(6)} ${String(r.channels ?? '-').padEnd(3)} ${String(r.rate ?? '-').padEnd(6)} ${n(r.before ?? 0)}   ${n(r.after ?? 0)}   ${r.state ?? r.error ?? '-'}`,
  )
}

// The two facts enableSystem is written against, asserted rather than eyeballed.
const raw = rows[1]
const failures = [
  raw.audio === true ? '' : 'no audio track on the processing-off arm',
  raw.state === 'live' ? '' : 'audio track died with the video track',
  raw.after > 0.5 * raw.before
    ? ''
    : 'audio level fell when the video track stopped',
].filter(m => m !== '')
if (failures.length > 0) {
  console.log(`FAIL: ${failures.join('; ')}`)
  process.exitCode = 1
} else {
  console.log('OK: audio outlives the video track, and outlives it at level')
}

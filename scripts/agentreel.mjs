// Record a real Claude session driving the real app in a real Chrome, with both
// windows in frame.
//
// Usage: node scripts/agentreel.mjs [--base=URL] [--out=DIR] [--model=sonnet]
//        [--task=FILE] [--seconds=N] [--display=:99] [--upload] [--keep]
//   needs the dev server (pnpm dev), Xvfb, xterm, xdotool, ffmpeg, google-chrome,
//   and a logged-in `claude` on PATH.
//
// The AI usage page claims this app is built to be played by an agent. That
// claim was prose, and prose is the one thing a reader cannot check. This
// records the claim being true: Claude reads the page, types into the command
// palette, and the picture comes apart — in one frame, beside the terminal it
// is thinking in.
//
// **Nothing here is staged.** `appreel.mjs`, next door, draws a pointer and
// walks it along a scripted timeline, which is right for a product reel and
// wrong for this one: what makes this recording worth anything is that the
// timing, the mistakes and the order of the presses come from the model rather
// than from a list in this file. All this script does is set the stage, start
// the shutter, and stop when the session lands.
//
// Three things it has to arrange, and each one cost a wrong answer first:
//
// **A nested X display, not the desktop.** This box runs GNOME on Wayland, and
// `x11grab` against `:0` there grabs nothing — mutter composites outside X, so
// the root window a screen grab reads is empty. An Xvfb is its own root window
// with our two clients in it, so the grab is exact, the layout is ours, and the
// recording does not contain whatever else was on the developer's screen.
//
// **Chrome needs telling to keep the GPU there.** On a plain Xvfb its default
// path opens the DRM card node, which a desktop session's ACLs do not grant, and
// WebGPU then loses its device every few seconds — the app's own "this page
// keeps rebuilding its GPU engine" banner, recorded four times before this was
// understood. GPU_ARGS below routes it through Vulkan on the render node, which
// the seat user does hold, and the picture comes back.
//
// **`chrome-devtools-mcp` attaches to the Chrome we launched** (`--browserUrl`)
// rather than starting its own. A server that launches its own browser would put
// a second Chrome somewhere off-frame and record an empty window.
//
// What the session may do is scoped to that browser: every file and shell tool
// is denied, so the recording cannot wander off into the repo.

import puppeteer from 'puppeteer-core'

import { CHROME } from './browser.mjs'
import { appUp } from './until.mjs'

import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit === undefined ? fallback : hit.slice(name.length + 3)
}
const base = flag('base', 'http://localhost:5199/app/?src=cat')
// Where the clip lands and where its poster does. `clips/` is gitignored, the
// same place `docshots.mjs` leaves its recordings — a 5MB mp4 belongs on S3
// beside the guide's other clips, not in the tree. The poster is a still and is
// committed, so a reader with no network still gets a frame.
const outDir = flag('out', 'clips')
const posterDir = flag('posters', 'docs/img')
const model = flag('model', 'sonnet')
const display = flag('display', ':99')
const capSecs = Number(flag('seconds', '240'))
const keep = argv.includes('--keep')
// Sending the clip where the docs point. Off by default: a recording is worth
// looking at before it is published, and every take but the last one is a take
// that was not good enough.
const upload = argv.includes('--upload')

// Pinned, not `@latest`: the tool list this server exposes is what the task
// below is written against, and a server that grows or renames a tool mid-run
// would change what the recording is of.
const MCP = 'chrome-devtools-mcp@1.8.0'

const WIDTH = 1920
const HEIGHT = 1080
// Chrome takes the left, the terminal the right. The panel is 360px of the
// app's own width, so this leaves the picture about 1000px — wide enough that a
// tear reads at half size on a page.
const CHROME_W = 1300
// What is left for the terminal, which `xdotool` then holds it to. xterm is
// sized in *cells* and its `-fs` is in points, so a geometry picked in
// characters lands wherever the font server rounds it to — the first take ran 60
// pixels off the right of the frame and cut a word off every line Claude wrote.
// Asking for the pixels and letting xterm round down to whole cells is the only
// way this fits by construction.
const TERM_X = CHROME_W
const TERM_W = WIDTH - CHROME_W

const FPS = 24
// Two encodes, because they want opposite things. The grab has to keep up with
// a compositor and a WebGPU app on the same box, so it is cheap and fat;
// the file that ships is squeezed afterwards, off disk, with time to spare.
const GRAB_CRF = 18
// The clip is hosted, not committed, so this is set for how it looks rather than
// for what it weighs — 24 over the 34 it started at, which held the terminal's
// nine-pixel text but left the picture's grain smeared, and grain is half of
// what the app is. A minute at 1080p lands around 30MB.
const FINAL_CRF = 24

const sleep = ms => new Promise(r => setTimeout(r, ms))

// The default task. A file via `--task=` replaces it, which is how a second
// recording gets a different sentence without this file growing a list.
//
// It names the palette rather than describing the app, because the palette is
// what the page claims an agent can use — and it ends on `board as text`, which
// gives the recording a legible last beat and gives this script something
// unambiguous to stop on.
//
// **The rows are the ones the reel already screened, in the order it screened
// them into.** The first take of this typed `head switch 9` and `noise 12`,
// which are real edits and read on camera as almost nothing: a 9µs tear is a
// band at one edge of the frame and 12 IRE of noise is grain. `reel.mjs` carries
// the answer, off thirty-six rows tried one at a time on the same photograph —
// most of the panel reads as nothing on its own, three rows read alone and read
// *better* stacked, and two more shear the result once it is already coming
// apart. Sync suppression scrambles the picture into inverted bands with a black
// bar walking through it; subcarrier detune barber-poles the hue down the frame;
// chroma gain makes the whole scrambled thing rainbow; HV sag and supply ring
// then bend all of it into waves. Every pull lands on what the last one did,
// which is the rule that made the reel work and is the only reason five edits in
// a minute read as an escalation rather than a list.
//
// Values, not travel fractions, because the palette takes what a person would
// type. They are the reel's own drags read back through `travel.ts`: its 0.811
// on subcarrier detune is 7kHz, its 0.695 on HV sag is 16µs.
const TASK = `You are demonstrating videoskillet.js, a live NTSC signal-path simulator, in the Chrome window beside you. Work only in that browser. After each step, take a screenshot and say in one line what changed in the picture.

Each of these is typed into the command palette, which you open with ctrl+k. Type the whole line, check the row it lands on says what you meant, then press Enter.

1. sync suppression 1
2. subcarrier detune 7
3. chroma gain 3.5
4. HV sag 16
5. supply ring 0.84

Then open the palette once more, run "board as text", and tell me what the board says.

Keep every reply to a line or two.`

const die = msg => {
  console.error(`agentreel: ${msg}`)
  process.exit(1)
}

for (const bin of ['Xvfb', 'xterm', 'xdotool', 'ffmpeg', 'claude']) {
  if (spawnSync('which', [bin]).status !== 0) die(`${bin} is not on PATH`)
}
if (!existsSync(CHROME)) die(`no Chrome at ${CHROME}`)

const taskFile = flag('task', '')
const task =
  taskFile === ''
    ? TASK
    : (await import('node:fs')).readFileSync(taskFile, 'utf8')

const tmp = mkdtempSync(join(tmpdir(), 'agentreel-'))
mkdirSync(outDir, { recursive: true })
const mp4 = resolve(outDir, 'agent-drive.mp4')
const poster = resolve(posterDir, 'agent-drive-poster.jpg')
const grab = join(tmp, 'grab.mp4')
// Where the clip is served from. Its own bucket rather than the one the guide's
// other clips are in: those are seconds of canvas and this is minutes of a whole
// window, and the size a good take costs is not a reason to make a worse one.
const S3_PREFIX = 's3://myloveydove.com/videoskillet/'
const CLIP_URL = 'https://myloveydove.com/videoskillet/agent-drive.mp4'
const uploadCmd = ['aws', 's3', 'cp', mp4, S3_PREFIX, '--profile', 'colin']
const termLog = join(tmp, 'terminal.log')

const kids = []
const spawnKid = (cmd, args, opts = {}) => {
  const kid = spawn(cmd, args, { stdio: 'ignore', ...opts })
  kids.push(kid)
  return kid
}
const cleanUp = () => {
  for (const kid of kids.toReversed()) {
    try {
      kid.kill()
    } catch {
      // Already gone: the ffmpeg that was asked to stop, a Chrome that died
      // with its display. Nothing to do about either, and throwing here would
      // lose the recording that prompted the tidy-up.
    }
  }
}
process.on('exit', cleanUp)
process.on('SIGINT', () => {
  cleanUp()
  process.exit(130)
})

// ------------------------------------------------------------------ the stage

console.log(`agentreel: display ${display}`)
spawnKid('Xvfb', [
  display,
  '-screen',
  '0',
  `${WIDTH}x${HEIGHT}x24`,
  '-nolisten',
  'tcp',
])
await sleep(2000)

// Why each of these is here is in the header. `--test-type` is the one that is
// only cosmetic: without it Chrome hangs a yellow "unsupported flag" ribbon
// across the top of every frame.
const GPU_ARGS = [
  '--enable-unsafe-webgpu',
  '--use-angle=vulkan',
  '--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
]
const CDP_PORT = 9333
spawnKid(
  CHROME,
  [
    `--user-data-dir=${join(tmp, 'chrome')}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--test-type',
    '--ozone-platform=x11',
    '--window-position=0,0',
    `--window-size=${CHROME_W},${HEIGHT}`,
    `--remote-debugging-port=${CDP_PORT}`,
    ...GPU_ARGS,
    base,
  ],
  { env: { ...process.env, DISPLAY: display } },
)

console.log('agentreel: waiting for the app')
let page
for (let tries = 0; page === undefined && tries < 40; tries++) {
  await sleep(1000)
  try {
    const browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${CDP_PORT}`,
      defaultViewport: null,
    })
    page = (await browser.pages()).find(p => p.url().includes('/app/'))
  } catch {
    // Chrome has not opened its debugging port yet.
  }
}
if (page === undefined) die('Chrome never came up with the app on it')
await appUp(page, 30000)
// Real seconds, not stepped frames: the recording is of the app running, and
// the phosphor and the tape wobble both need a wall clock to look like
// themselves.
await sleep(4000)
const health = await page.evaluate(() => ({
  rebuilding: document.body.innerText.includes('keeps rebuilding'),
  canvas: document.querySelector('canvas') !== null,
}))
if (!health.canvas) die('the app has no canvas')
if (health.rebuilding) die('the GPU device is being rebuilt — check GPU_ARGS')

// The browser tools, pointed at the Chrome that is already on screen.
const mcpConfig = join(tmp, 'mcp.json')
writeFileSync(
  mcpConfig,
  JSON.stringify({
    mcpServers: {
      chrome: {
        command: 'npx',
        args: ['-y', MCP, '--browserUrl', `http://127.0.0.1:${CDP_PORT}`],
      },
    },
  }),
)
// Warmed before the shutter opens. The first `npx` of a package spends up to a
// minute fetching it, and a minute of an empty terminal is a minute of
// recording nobody will watch.
console.log('agentreel: warming the mcp server')
spawnSync('npx', ['-y', MCP, '--help'], { stdio: 'ignore' })

// --------------------------------------------------------------- the shutter

console.log('agentreel: recording')
const recStart = Date.now()
const rec = spawnKid('ffmpeg', [
  '-y',
  '-v',
  'error',
  '-f',
  'x11grab',
  '-framerate',
  String(FPS),
  '-video_size',
  `${WIDTH}x${HEIGHT}`,
  // The X pointer never moves — every click comes through CDP — so drawing it
  // would park an arrow in the middle of the frame for the whole recording.
  '-draw_mouse',
  '0',
  '-i',
  display,
  '-c:v',
  'libx264',
  '-preset',
  'ultrafast',
  '-crf',
  String(GRAB_CRF),
  '-pix_fmt',
  'yuv420p',
  grab,
])

// A session of its own, not a child of whatever is running this. Claude Code
// reads its own variables out of the environment, and inherited they make the
// recorded session describe the wrong thing: `CLAUDE_CODE_CHILD_SESSION` puts a
// "transcript saving is off" warning across the first frame, and the parent's
// effort and model settings quietly override the `--model` this was asked for.
const childEnv = { ...process.env, DISPLAY: display }
for (const name of Object.keys(childEnv)) {
  // CLAUDE_CONFIG_DIR stays: it is where the credentials are.
  if (/^CLAUDE(CODE|_CODE|_EFFORT|_PID)/.test(name)) delete childEnv[name]
}

// The session. Interactive rather than `--print`, because the window is half the
// point: print mode holds everything back until the end and would record a blank
// terminal. Tools are scoped to the browser — every file and shell tool is
// denied, so a recording cannot wander into the repo it is being run from.
spawnKid(
  'xterm',
  [
    // A starting size only; `xdotool` below is what makes it fit.
    '-geometry',
    `60x50+${TERM_X}+0`,
    '-fa',
    'DejaVu Sans Mono',
    '-fs',
    '11',
    '-bg',
    '#16161a',
    '-fg',
    '#d8d8dc',
    '-tn',
    'xterm-256color',
    '-l',
    '-lf',
    termLog,
    '-e',
    'claude',
    // The prompt goes first, ahead of anything variadic. `--disallowedTools` and
    // `--mcp-config` both take a list and both keep eating arguments until the
    // next flag, so a prompt written after one of them is read as a tool name —
    // the first take of this was four minutes of Claude Code sitting at an empty
    // prompt with nothing to do.
    task,
    '--model',
    model,
    '--mcp-config',
    mcpConfig,
    '--strict-mcp-config',
    '--permission-mode',
    'bypassPermissions',
    '--disallowedTools',
    'Bash,Edit,Write,Read,Glob,Grep,NotebookEdit,WebFetch,WebSearch,Task',
  ],
  { env: childEnv },
)

// Held to the pixels it was budgeted, once it exists. There is no window
// manager on this display — that is deliberate, since a WM would put a title bar
// and a drop shadow in every frame — so nothing else is going to lay these two
// windows out, and xterm's own idea of its size is in cells it rounds for
// itself.
await sleep(2500)
const xdo = (...args) =>
  spawnSync('xdotool', args, { env: { ...process.env, DISPLAY: display } })
const termId = xdo('search', '--class', 'xterm')
  .stdout.toString()
  .trim()
  .split('\n')
  .at(-1)
if (termId === undefined || termId === '') {
  console.warn('agentreel: no xterm window to place — recording it where it is')
} else {
  xdo('windowsize', termId, String(TERM_W), String(HEIGHT))
  xdo('windowmove', termId, String(TERM_X), '0')
}

// Stop on the last beat of the task rather than on a stopwatch: the model works
// at whatever pace it works at, and a fixed length would either cut the ending
// off or hold on a finished screen for a minute. The cap is the fallback for a
// session that never gets there.
const deadline = Date.now() + capSecs * 1000
let landed = false
let landedAt = 0
while (Date.now() < deadline) {
  await sleep(2000)
  landed = await page
    // By accessible name, which is the one handle on this app that is held
    // still on purpose (`buttonNames.test.ts`, PanelSheet's `label`). Asked for
    // as a `<dialog>` this broke silently the week the sheets moved into the
    // sidebar, and a broken stop condition looks exactly like a model that never
    // finished.
    .evaluate(
      () => document.querySelector('[aria-label="board as text"] pre') !== null,
    )
    .catch(() => false)
  if (landed) {
    landedAt = Date.now()
    break
  }
}
console.log(
  landed
    ? 'agentreel: the session landed — holding on it'
    : `agentreel: no landing inside ${capSecs}s — stopping anyway`,
)
// The dialog opening is the *second to last* beat: Claude still has to read the
// board and write what it says, which is the sentence the recording is for. So
// the tail waits on the terminal going quiet — xterm is logging every byte it
// draws, and a session that has stopped writing has stopped working.
if (landed) {
  const sizeOf = () => (existsSync(termLog) ? statSync(termLog).size : 0)
  let quietSince = Date.now()
  let last = sizeOf()
  const tailUntil = Date.now() + 90000
  while (Date.now() - quietSince < 6000 && Date.now() < tailUntil) {
    await sleep(500)
    const now = sizeOf()
    if (now !== last) {
      last = now
      quietSince = Date.now()
    }
  }
}
// A beat on the finished screen, so the last frame is the answer rather than
// the moment it arrived.
await sleep(2000)

rec.kill('SIGINT')
await sleep(2000)

// The file that ships. Kept at the display's own size: at 1080p the terminal's
// text is nine pixels tall, and every scale that saves bytes spends them on the
// half of the frame the recording exists to prove.
console.log('agentreel: encoding')
spawnSync('ffmpeg', [
  '-y',
  '-v',
  'error',
  '-i',
  grab,
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  String(FINAL_CRF),
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  mp4,
])

// The poster: the frame just before the board sheet opens.
//
// Not the first frame, which is an app nobody has touched yet, and not the last
// either — that one was tried, and the sheet takes the sidebar, so the thumbnail
// a reader decides on is half a column of text. Three seconds earlier the
// picture is at its worst across the whole width with the transcript beside it,
// which is the frame that makes the case.
//
// No GIF. One was tried, and this recording as a GIF is 45MB against the mp4's
// six: 1920 pixels of live analog grain is the worst case a palette-indexed
// format has, and every crop small enough to fix it drops one of the two windows
// the recording is about.
const posterAt = Math.max(
  1,
  (landed ? landedAt - recStart : Date.now() - recStart) / 1000 - 3,
).toFixed(1)
mkdirSync(posterDir, { recursive: true })
spawnSync('ffmpeg', [
  '-y',
  '-v',
  'error',
  '-ss',
  String(posterAt),
  '-i',
  mp4,
  '-frames:v',
  '1',
  '-q:v',
  '4',
  poster,
])

cleanUp()
if (!keep) rmSync(tmp, { recursive: true, force: true })
console.log(`agentreel: ${mp4} (${(statSync(mp4).size / 1e6).toFixed(0)}MB)`)
console.log(`agentreel: ${poster}`)
if (upload) {
  console.log('agentreel: uploading')
  const up = spawnSync(uploadCmd[0], uploadCmd.slice(1), { stdio: 'inherit' })
  if (up.status !== 0) die('the upload failed — the clip is still on disk')
  console.log(`agentreel: ${CLIP_URL}`)
} else {
  console.log(`agentreel: upload with ${uploadCmd.join(' ')}`)
}
if (keep) console.log(`agentreel: kept ${tmp} (terminal log, chrome profile)`)
if (!landed) process.exit(1)

// Cut the waiting out of an agentreel.mjs recording.
//
// Usage: node scripts/agenttrim.mjs <in.mp4> <out.mp4> [--speed=1.25]
//        [--from=SECONDS|auto] [--to=SECONDS] [--split=1300]
//        [--layout=full|split]
//   needs ffmpeg.
//
// A recorded session is mostly a model thinking: the terminal shows a spinner
// and the picture sits still. What a viewer wants is the moments where
// something lands, so this keeps a window around every event and drops the
// rest. Two things count as an event:
//
// - **New text in the terminal.** A paragraph arriving moves far more of the
//   pane than the spinner and its timer do, so a plain threshold on the change
//   between frames separates the two.
// - **A step in the picture.** A look built on noise or a feedback loop moves
//   every frame, so a fixed threshold would keep all of it. The change is
//   compared with the median of the second before it, and only a jump well
//   above that counts.
//
// The take starts where the prompt lands, which `--from=auto` finds on its own.
// Claude Code starting up before it, the banner and the empty pane, is cut.
//
// Both halves of the frame are cut together, so the picture and the text
// beside it stay in step. The layout is agentreel.mjs's: the app on the left
// and the terminal from x `--split` to the right edge, which is the take's
// `--chrome-width`. The picture's box is found from the frames themselves.
//
// `--layout=split` keeps only the picture and the terminal beside it, without
// the browser's chrome and the app's panel, so the text is as large as it can
// be when the clip is shown in a page column.

import { flag } from './harness.mjs'

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [input, output] = process.argv.slice(2).filter(a => !a.startsWith('--'))
if (input === undefined || output === undefined) {
  console.error('usage: node scripts/agenttrim.mjs <in.mp4> <out.mp4>')
  process.exit(1)
}
const speed = Number(flag('speed', '1.25'))
const fromFlag = flag('from', 'auto')
const to = Number(flag('to', 'Infinity'))

const median = xs => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)]
const split = Number(flag('split', '1300'))
const layout = flag('layout', 'full')

const RATE = 10
const WIDTH = 1920
const HEIGHT = 1080
// The app's panel, at the right of the browser window, and the browser's own
// tab strip and toolbar above the page. Neither is part of the picture.
const PANEL = 370
const BROWSER_TOP = 110
const PAGE_BOTTOM = 1020

// The picture's box: the median of the lit area in a dozen frames across the
// take, left of the panel and inside the page. The canvas letterboxes the 4:3
// raster in black, so a frame's lit area is the raster. A median, because one
// frame can light something else, such as a sheet or a flash, and a dark frame
// lights nothing.
const pictureBox = () => {
  const q = 4
  const [w, h] = [WIDTH / q, HEIGHT / q]
  const duration = Number(
    spawnSync('ffprobe', [
      ...['-v', 'error', '-show_entries', 'format=duration'],
      ...['-of', 'csv=p=0', input],
    ]).stdout,
  )
  const boxes = []
  for (let i = 1; i <= 12; i++) {
    const frame = spawnSync(
      'ffmpeg',
      [
        ...[
          '-v',
          'error',
          '-ss',
          ((duration * i) / 13).toFixed(2),
          '-i',
          input,
        ],
        ...['-frames:v', '1', '-vf', `scale=${w}:${h},format=gray`],
        ...['-f', 'rawvideo', '-'],
      ],
      { maxBuffer: 1 << 24 },
    ).stdout
    let [x0, y0, x1, y1] = [w, h, -1, -1]
    for (let y = Math.ceil(BROWSER_TOP / q); y < PAGE_BOTTOM / q; y++) {
      for (let x = 0; x < (split - PANEL) / q; x++) {
        if (frame[y * w + x] > 24) {
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
          y0 = Math.min(y0, y)
          y1 = Math.max(y1, y)
        }
      }
    }
    if (x1 >= 0) boxes.push([x0, y0, x1, y1])
  }
  const [x0, y0, x1, y1] = [0, 1, 2, 3].map(i => median(boxes.map(b => b[i])))
  const even = n => 2 * Math.round(n / 2)
  return {
    x: even(x0 * q),
    y: even(y0 * q),
    w: even((x1 - x0 + 1) * q),
    h: even((y1 - y0 + 1) * q),
  }
}

const pic = pictureBox()
const termW = WIDTH - split
// The newest lines are at the bottom of the terminal, so its slice is the
// bottom of the pane, as tall as the picture beside it.
const term = { x: split, y: HEIGHT - pic.h, w: termW, h: pic.h }
console.log(
  `agenttrim: picture ${pic.w}x${pic.h}+${pic.x}+${pic.y}, terminal ${term.w}x${term.h}+${term.x}+${term.y}`,
)
const PANES = {
  terminal: {
    crop: `${termW}:600:${split}:${HEIGHT - 702}`,
    w: Math.round(termW / 4),
    h: 150,
  },
  picture: { crop: `${pic.w}:${pic.h}:${pic.x}:${pic.y}`, w: 94, h: 70 },
}
// Mean absolute change per pixel, on 0–255 grey, between consecutive samples.
// A new paragraph measured 9 to 20 on the takes this was written against, and
// the spinner under 1.5.
const TEXT_STEP = 4
// A picture step is a change this many times the second before it, and at
// least this large in absolute terms.
const PICTURE_RATIO = 3
const PICTURE_STEP = 6
// How much of each event is kept, in seconds of the recording: a little before,
// so the cut lands on the frame before the change, and enough after to read a
// paragraph or watch a look settle.
const TEXT_KEEP = [0.3, 2.6]
const PICTURE_KEEP = [0.6, 3.2]
// The last event is the session's answer, and it is held for longer.
const TAIL = 6

const diffs = pane => {
  const { crop, w, h } = PANES[pane]
  const raw = spawnSync(
    'ffmpeg',
    [
      ...['-v', 'error', '-i', input],
      ...['-vf', `fps=${RATE},crop=${crop},scale=${w}:${h},format=gray`],
      ...['-f', 'rawvideo', '-'],
    ],
    { maxBuffer: 1 << 30 },
  ).stdout
  const size = w * h
  const frames = Math.floor(raw.length / size)
  const out = [0]
  for (let f = 1; f < frames; f++) {
    let sum = 0
    for (let i = 0; i < size; i++) {
      sum += Math.abs(raw[f * size + i] - raw[(f - 1) * size + i])
    }
    out.push(sum / size)
  }
  return out
}

const text = diffs('terminal')
const picture = diffs('picture')
const events = []
for (let f = 1; f < text.length; f++) {
  const t = f / RATE
  if (text[f] > TEXT_STEP) events.push({ t, keep: TEXT_KEEP })
  const before = picture.slice(Math.max(0, f - RATE), f)
  if (
    picture[f] > PICTURE_STEP &&
    picture[f] > PICTURE_RATIO * (median(before) ?? 0)
  ) {
    events.push({ t, keep: PICTURE_KEEP })
  }
}
const firstPicture = events.find(e => e.keep === PICTURE_KEEP)?.t ?? Infinity
// The prompt is the text the model then sits thinking about, so it is the last
// text before the longest quiet stretch ahead of the first picture change.
const early = events.filter(e => e.keep === TEXT_KEEP && e.t < firstPicture)
const prompt = early.reduce(
  (best, e, i) => {
    const gap = (early[i + 1]?.t ?? firstPicture) - e.t
    return gap > best.gap ? { t: e.t, gap } : best
  },
  { t: TEXT_KEEP[0], gap: 0 },
)
const from = fromFlag === 'auto' ? prompt.t - TEXT_KEEP[0] : Number(fromFlag)
console.log(`agenttrim: from ${from.toFixed(1)}s`)
const inRange = events.filter(e => e.t >= from && e.t <= to)
if (inRange.length === 0) {
  console.error('agenttrim: nothing happens in that range')
  process.exit(1)
}

const last = inRange.at(-1)
const windows = inRange
  .map(e => [
    e.t - e.keep[0],
    e.t + (e === last ? Math.max(e.keep[1], TAIL) : e.keep[1]),
  ])
  .toSorted((a, b) => a[0] - b[0])
  .reduce((merged, [a, b]) => {
    const prev = merged.at(-1)
    if (prev !== undefined && a <= prev[1] + 0.5) prev[1] = Math.max(prev[1], b)
    else merged.push([Math.max(0, a), b])
    return merged
  }, [])

const timing = `setpts=PTS/${speed},fps=30`
const frameFilter =
  layout === 'split'
    ? [
        `[0]split[a][b]`,
        `[a]crop=${pic.w}:${pic.h}:${pic.x}:${pic.y}[p]`,
        `[b]crop=${term.w}:${term.h}:${term.x}:${term.y},pad=${term.w + 12}:${term.h}:12:0:color=0x16161a[t]`,
        `[p][t]hstack,${timing}`,
      ].join(';')
    : timing

const scratch = mkdtempSync(join(tmpdir(), 'agenttrim-'))
const parts = windows.map(([a, b], i) => {
  const part = join(scratch, `${String(i).padStart(3, '0')}.mp4`)
  spawnSync(
    'ffmpeg',
    [
      ...['-v', 'error', '-y', '-ss', a.toFixed(2), '-t', (b - a).toFixed(2)],
      ...['-i', input, '-filter_complex', frameFilter, '-an'],
      ...['-c:v', 'libx264', '-crf', '14', '-preset', 'fast'],
      ...['-pix_fmt', 'yuv420p', part],
    ],
    { stdio: 'inherit' },
  )
  return `file '${part}'`
})
const list = join(scratch, 'list.txt')
writeFileSync(list, `${parts.join('\n')}\n`)
const joined = spawnSync(
  'ffmpeg',
  [
    ...['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list],
    ...['-c:v', 'libx264', '-crf', '24', '-preset', 'slow'],
    ...['-pix_fmt', 'yuv420p', '-movflags', '+faststart', output],
  ],
  { stdio: 'inherit' },
)
rmSync(scratch, { recursive: true, force: true })
if (joined.status !== 0) process.exit(1)

const kept = windows.reduce((s, [a, b]) => s + (b - a), 0)
console.log(
  windows.map(([a, b]) => `  ${a.toFixed(1)}–${b.toFixed(1)}`).join('\n'),
)
console.log(
  `agenttrim: ${windows.length} windows, ${kept.toFixed(1)}s of the recording, ${(kept / speed).toFixed(1)}s at ${speed}× → ${output}`,
)

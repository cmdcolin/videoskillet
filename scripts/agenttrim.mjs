// Cut the waiting out of an agentreel.mjs recording.
//
// Usage: node scripts/agenttrim.mjs <in.mp4> <out.mp4> [--speed=1.25]
//        [--from=SECONDS] [--to=SECONDS]
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
// Both halves of the frame are cut together, so the picture and the text
// beside it stay in step. The layout is agentreel.mjs's: the app on the left,
// its picture in the top 936 pixels of the window's width, and the terminal
// from x 1300 to the right edge.

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
const from = Number(flag('from', '0'))
const to = Number(flag('to', 'Infinity'))

const RATE = 10
const PANES = {
  terminal: { crop: '620:600:1300:378', w: 155, h: 150 },
  picture: { crop: '936:702:0:216', w: 94, h: 70 },
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

const median = xs => xs.toSorted((a, b) => a - b)[Math.floor(xs.length / 2)]

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

const scratch = mkdtempSync(join(tmpdir(), 'agenttrim-'))
const parts = windows.map(([a, b], i) => {
  const part = join(scratch, `${String(i).padStart(3, '0')}.mp4`)
  spawnSync(
    'ffmpeg',
    [
      ...['-v', 'error', '-y', '-ss', a.toFixed(2), '-t', (b - a).toFixed(2)],
      ...['-i', input, '-vf', `setpts=PTS/${speed},fps=30`, '-an'],
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

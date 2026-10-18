import { rngFor } from '../core/rng'
import { LINES, SAMPLE_RATE } from '../core/signal/constants'
import { LineState, type LineStateControls } from '../core/signal/linestate'
import { TrackingServo } from '../core/signal/servo'

// The deck's per-line timing and tracking, run on the CPU through the same
// LineState and TrackingServo the engine steps each frame, from a fixed seed so
// a drawing holds still between writes. The RF nulls are channel.wgsl's
// tracking band and prelude.ts's shuttleNull, repeated here.

const SEED = 0x7a9e
const REST: LineStateControls = {
  tbJitterNs: 0,
  tbWowNs: 0,
  tbStickNs: 0,
  underJitterDeg: 0,
  headSwitchShiftUs: 0,
  trackAmt: 0,
  trackPos: 0.85,
  shuttleBars: 0,
  shuttlePhase: 0,
}

const toUs = (samples: number) => (samples / SAMPLE_RATE) * 1e6

/** The raster line the timing-over-time trace follows. */
export const MID_LINE = Math.round(LINES / 2)

export type Transport = Pick<
  LineStateControls,
  'tbJitterNs' | 'tbWowNs' | 'tbStickNs' | 'headSwitchShiftUs'
>

// Each line's timebase offset, in µs early, for the last of `frames` frames
// down the raster, and at MID_LINE for every frame.
export function lineTiming(t: Transport, frames: number) {
  const state = new LineState(rngFor(SEED))
  const c = { ...REST, ...t }
  const over: number[] = []
  let data = state.update(c, 0)
  over.push(toUs(data[MID_LINE * 8]!))
  for (let f = 1; f < frames; f++) {
    data = state.update(c, f)
    over.push(toUs(data[MID_LINE * 8]!))
  }
  const field = Array.from({ length: LINES }, (_, row) => toUs(data[row * 8]!))
  return { field, over }
}

// A still of the crossing pattern, which the engine precesses frame by frame:
// at this phase the sweep starts centred on its own track.
export const SHUTTLE_STILL = 0.5

export interface Tracking {
  trackAmt: number
  trackPos: number
  /** shuttleX - 1, as the engine hands it to LineState and the shader. */
  bars: number
}

// The tear the tracking band and the shuttle strips put on each line, in µs
// early.
export function trackingTear(k: Tracking) {
  const data = new LineState(rngFor(SEED)).update(
    {
      ...REST,
      trackAmt: k.trackAmt,
      trackPos: k.trackPos,
      shuttleBars: k.bars,
      shuttlePhase: SHUTTLE_STILL,
    },
    0,
  )
  return Array.from({ length: LINES }, (_, row) => toUs(data[row * 8]!))
}

// channel.wgsl's tracking band: severity amt × edge × 1.3 over 3 + 18·amt lines
// either side of the band centre.
export function trackNull(row: number, amt: number, pos: number) {
  if (amt <= 0) return 0
  const half = 3 + 18 * amt
  const d = Math.abs(row - pos * LINES)
  return d < half ? amt * (1 - d / half) * 1.3 : 0
}

// prelude.ts shuttleNull: the RF nulls within 8 lines of each crossing.
export function shuttleNull(row: number, bars: number, phase: number) {
  if (bars === 0) return 0
  const ab = Math.abs(bars)
  const x = (row / LINES) * ab + phase
  const fx = x - Math.floor(x)
  const dLines = (Math.min(fx, 1 - fx) / ab) * LINES
  return dLines < 8 ? (1 - dLines / 8) * 1.7 : 0
}

// What rfNull leaves of a line after each null in turn: mix toward noise by the
// severity, clamped to 0.95.
export const lost = (...severities: number[]) =>
  1 -
  severities.reduce((keep, s) => keep * (1 - Math.min(Math.max(s, 0), 0.95)), 1)

export interface Servo {
  trackPos: number
  trackAmt: number
  trackHunt: number
  trackKick: number
}

const SETTLE_FRAMES = 240

// Where the servo puts the band, in lines below where the hand set it, frame by
// frame after one full kick. It runs four seconds first so it starts settled.
export function servoKick(s: Servo, frames: number) {
  const servo = new TrackingServo(rngFor(SEED))
  const c = {
    target: s.trackPos,
    amt: s.trackAmt,
    hunt: s.trackHunt,
    kick: s.trackKick,
  }
  for (let f = 0; f < SETTLE_FRAMES; f++) servo.update(c)
  servo.kick(1)
  return Array.from(
    { length: frames },
    () => (servo.update(c).pos - s.trackPos) * LINES,
  )
}

// A servo rings when its error swings back across the target more than once
// by over a tenth of its largest swing, and by more than two lines.
export function rings(error: readonly number[]) {
  const slack = Math.max(2, 0.1 * Math.max(...error.map(Math.abs)))
  let side = 0
  let flips = 0
  for (const e of error) {
    if (Math.abs(e) < slack) continue
    const now = Math.sign(e)
    if (side !== 0 && now !== side) flips += 1
    side = now
  }
  return flips > 1
}

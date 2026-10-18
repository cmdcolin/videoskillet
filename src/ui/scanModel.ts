import {
  ACTIVE_HEIGHT,
  ACTIVE_START,
  ACTIVE_TOP,
  ACTIVE_WIDTH,
  F_H,
  IRE_BLACK,
  IRE_BLANK,
  IRE_SYNC,
  IRE_VIDEO_RANGE,
  IRE_WHITE,
  LINES,
  SAMPLE_RATE,
  SAMPLES_PER_LINE,
  usToSamples,
  VSYNC_FIRST,
  VSYNC_LAST,
} from '../core/signal/constants'

// The receiver's scan recurrences run on the CPU against a clean test signal,
// so a drawing can plot what a knob does to the raster. sync.wgsl's flywheel,
// vertical trigger, sag tank and beam limiter are repeated here line for line;
// decode.wgsl's bend and EHT widening turn their state into where the picture
// lands. Noise, the free-run walk of an unlocked oscillator, the roll and the
// AGC are left out, because a clean signal never reaches them, and so is the DC
// restorer's offset, which a clean signal holds at zero.

const SPL = SAMPLES_PER_LINE
const PICTURE_ROWS = (row: number) =>
  row >= ACTIVE_TOP && row < ACTIVE_TOP + ACTIVE_HEIGHT

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi)

const samplesToUs = (s: number) => (s / SAMPLE_RATE) * 1e6

// Wraps a horizontal offset into the half line either side, where the decoder
// reads the neighbouring line's content.
const wrapLine = (s: number) => s - SPL * Math.floor(s / SPL + 0.5)

const wrapFrame = (v: number) => v - LINES * Math.floor(v / LINES + 0.5)

// ntscLineSlot in prelude.ts, for the samples past the burst that
// sync_measure reads: equalizing and serrated broad pulses in the vertical
// interval, blanking on every other line outside the picture.
function blankingLevel(row: number, s: number) {
  if (row < VSYNC_FIRST || (row > VSYNC_LAST && row < 12)) {
    return s % 455 < 33 ? IRE_SYNC : IRE_BLANK
  }
  if (row >= VSYNC_FIRST && row <= VSYNC_LAST) {
    const serration = (s >= 388 && s < 455) || s >= 843
    return serration ? IRE_BLANK : IRE_SYNC
  }
  return IRE_BLANK
}

/** Picture lines, from the top, that the test card paints white. */
export const WHITE_BAR = [160, 320] as const

const LOAD_TAPS = 24
const LOAD_STEP = Math.floor(ACTIVE_WIDTH / LOAD_TAPS)

// sync_measure's beam load per raster line: the mean of 24 samples across the
// active window, for a card that is black with WHITE_BAR across it, or white.
export function cardLoads(card: 'bar' | 'white') {
  const picture = (line: number) =>
    card === 'white' || (line >= WHITE_BAR[0] && line < WHITE_BAR[1])
      ? IRE_WHITE
      : IRE_BLACK
  return Array.from({ length: LINES }, (_, row) => {
    if (PICTURE_ROWS(row)) return picture(row - ACTIVE_TOP)
    let sum = 0
    for (let k = 0; k < LOAD_TAPS; k++) {
      sum += blankingLevel(row, ACTIVE_START + k * LOAD_STEP)
    }
    return sum / LOAD_TAPS
  })
}

// The mean beam current both servos in sync.wgsl sense, in IRE.
export function beamIre(loads: readonly number[]) {
  const lines = loads.slice(VSYNC_LAST + 4)
  return clamp(lines.reduce((a, b) => a + b, 0) / lines.length, 0, 160)
}

const ablWant = (abl: number, beam: number) =>
  Math.min(1, mix(85, 28, abl) / Math.max(beam, 6))

// The beam limiter's drive, frame by frame, after a cut from a picture it had
// no quarrel with to one of mean level `beam`.
export function ablDrive(abl: number, beam: number, frames: number) {
  let g = 1
  let v = 0
  const wn = 0.16
  const zeta = mix(0.9, 0.1, abl)
  const want = ablWant(abl, beam)
  return Array.from({ length: frames }, () => {
    if (abl > 0) {
      v = clamp(v + wn * wn * (want - g) - 2 * zeta * wn * v, -0.25, 0.25)
      g = clamp(g + v, 0.06, 1.15)
    }
    return g
  })
}

// The sag tank down the raster, in its normalized units, settled over enough
// frames that the state the flyback hands on has stopped changing.
export function sagLines(
  ring: number,
  ablHeld: number,
  loads: readonly number[],
) {
  const r = clamp(ring, 0, 1)
  const w = mix(0.35, 0.08, r)
  const damp = mix(0.55, 0.015, r)
  let sag = 0
  let vel = 0
  const out = Array.from({ length: LINES }, () => 0)
  for (let frame = 0; frame < 6; frame++) {
    vel -= 0.4 * (0.5 + r)
    for (let ry = 0; ry < LINES; ry++) {
      const load =
        (Math.max(loads[ry]! - IRE_BLACK, 0) / IRE_VIDEO_RANGE) * ablHeld
      vel = vel + w * (load - sag) - damp * vel
      sag = 3 * Math.tanh((sag + w * vel) / 3)
      out[ry] = sag
    }
  }
  return out
}

// decode.wgsl's bendAt, against the picture line.
export function bendAt(y: number, shape: number, period: number) {
  const t = y / ACTIVE_HEIGHT
  const per = Math.max(period, 1)
  if (shape < 0.5) return Math.exp(-y / per)
  if (shape < 1.5) return t
  if (shape < 2.5) return Math.sin(Math.PI * t)
  return Math.sin((2 * Math.PI * y) / per)
}

export interface Deflection {
  bendUs: number
  bendShape: number
  bendPeriod: number
  hvSagUs: number
  hvRing: number
  abl: number
}

const EHT_MAX = 0.15
const EHT_KNEE = 0.12 * SPL
const SCAN_MID = ACTIVE_WIDTH / 2

// Where the left edge of each picture line lands on the glass, in µs right of
// where it belongs, with the bar card on screen and the limiter settled on it.
// A positive offset in decode reads later into the line, which moves the
// picture left; the EHT drop widens the line about the centre, which moves the
// left edge further out.
export function leftEdges(d: Deflection) {
  const loads = cardLoads('bar')
  const hvSag = usToSamples(d.hvSagUs)
  const bend = usToSamples(d.bendUs)
  const held = d.abl > 0 ? clamp(ablWant(d.abl, beamIre(loads)), 0.06, 1.15) : 1
  const sag = hvSag !== 0 ? sagLines(d.hvRing, held, loads) : null
  return Array.from({ length: ACTIVE_HEIGHT }, (_, y) => {
    const s = sag?.[ACTIVE_TOP + y] ?? 0
    const hoff = hvSag * s + bend * bendAt(y, d.bendShape, d.bendPeriod)
    const eht = clamp(
      EHT_MAX * Math.tanh(Math.abs(hvSag) / EHT_KNEE) * s,
      0,
      0.25,
    )
    const scan = Math.sqrt(1 - eht)
    return samplesToUs(SCAN_MID * (1 - 1 / scan) - hoff / scan)
  })
}

export interface Hold {
  hHold: number
  hDetuneHz: number
  syncBendUs: number
  vHold: number
  vFreqHz: number
}

const H_PULL_MAX = 40
const V_PULL_MAX = 30

// uniforms.ts: the phase the free-running oscillators gain per line and per
// frame.
export const hRateOf = (detuneHz: number) => SPL * (F_H / (F_H + detuneHz) - 1)
export const vRateOf = (freqHz: number) => LINES * (60 / freqHz - 1)

// Whether the flywheel can absorb the detune: past H_PULL_MAX of correction a
// line, the phase gains every line and the raster shears.
export const hLocks = (h: Hold) =>
  Math.abs(hRateOf(h.hDetuneHz)) <= h.hHold * H_PULL_MAX

// The flywheel down a clean signal, every edge where it belongs, settled over a
// few frames. Each picture line's shift, in µs right, wrapped to half a line.
export function lineShifts(h: Hold) {
  const rate = hRateOf(h.hDetuneHz)
  const kick = usToSamples(h.syncBendUs)
  const auth = h.hHold * H_PULL_MAX
  let pll = 0
  const out = Array.from({ length: ACTIVE_HEIGHT }, () => 0)
  for (let frame = 0; frame < 4; frame++) {
    for (let row = 0; row < LINES; row++) {
      if (row === ACTIVE_TOP) pll += kick
      pll += rate
      pll += clamp(h.hHold * -pll, -auth, auth)
      if (PICTURE_ROWS(row)) out[row - ACTIVE_TOP] = samplesToUs(-wrapLine(pll))
    }
    pll = wrapLine(pll)
  }
  return out
}

// Whether the vertical trigger can pull the oscillator back each frame. Locked,
// the phase settles where the pull cancels the drift, so the pull it needs is
// the drift itself.
export const vLocks = (h: Hold) =>
  Math.abs(vRateOf(h.vFreqHz)) <= h.vHold * V_PULL_MAX

// The vertical oscillator's phase frame by frame from a locked start, in lines
// the picture has moved up, wrapped to half a frame.
export function frameShifts(h: Hold, frames: number) {
  const rate = vRateOf(h.vFreqHz)
  const auth = V_PULL_MAX * h.vHold
  let v = 0
  return Array.from({ length: frames }, () => {
    v = wrapFrame(v + rate)
    v += clamp(-0.35 * v, -auth, auth)
    if (Math.abs(v) < 0.6) v = 0
    return v
  })
}

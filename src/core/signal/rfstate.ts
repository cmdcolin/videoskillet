// The adjacent channel's transmitter: its own sync generator and its own
// crystals, nothing about it locked to us. What the shader needs per frame is
// where that raster sits against ours (a time offset in samples, plus the
// line-rate mismatch that slants and sweeps its bars) and where the two beat
// carriers' phases have got to. The mismatch wanders instead of ticking — two
// head-end oscillators drift against each other, they do not oscillate — and
// it crosses zero, which is where the wiper bars hang, flatten, and reverse.
// Everything is a function of the frame count, so harness runs reproduce.
//
// The same state carries our own station's fading. The wanted carrier arrives
// by two paths whose difference wanders, so it nulls deeply and briefly and
// peaks broadly, on top of a slow tropospheric loss. The tuner's AGC turns its
// IF gain up to hold the carrier level, which turns up the receiver's own
// noise floor and every interferer with it: snow surges at the bottom of each
// fade, and past the AGC's range the carrier itself sinks and sync goes.

import { clamp, wrap } from '../math'
import { LINES, SAMPLES_PER_LINE } from './constants'
import { valueNoise } from './noise'

const N = SAMPLES_PER_LINE * LINES
const TAU = 2 * Math.PI

// The tuner AGC's range: past this the carrier itself falls.
const IF_GAIN_MAX = 20
// The receiver's own noise referred to its input, against a nominal carrier.
const FADE_FLOOR = 0.08
// The AGC detector's filter: gain comes down within a frame or two and goes
// back up over a fifth of a second.
const AGC_ATTACK = 0.5
const AGC_RELEASE = 0.08
// The IF stage overloads a little past nominal on a gain left high.
const IF_OVERLOAD = 1.3

export interface RfControls {
  rfFade: number
  rfFadeHz: number
}

interface RfUniforms {
  rfAdjEps: number
  rfAdjTau: number
  rfAdjPhase: number
  rfAdjPhaseS: number
  ingressCps: number
  ingressRowCyc: number
  ingressPhase: number
  ingressKey: number
  rfFadeK: number
  rfFadeG: number
  rfFloor: number
}

export class RfState {
  private tau = 0
  private phV = 0
  private phS = 0
  private phI = 0
  private pathPhase = 0
  private ifGain = 1

  update(frame: number, c: RfControls): RfUniforms {
    const t = frame / 60
    // Their line rate off ours, as a fraction. Biased off zero — a neighbour's
    // crystal has some fixed error — with a wander wide enough to swing
    // through zero now and then. At the top of the range their blanking bar
    // slants a full screen width over the height and crosses in about a
    // second; near zero it stands almost vertical and creeps.
    const eps =
      1.6e-3 *
      (0.3 + 0.55 * valueNoise(t * 0.17, 21) + 0.15 * valueNoise(t * 0.9, 22))
    this.tau = wrap(this.tau + eps * N, N)
    // Residual carrier offsets off the exact 6.0 / 1.5 MHz beat grid: a few
    // hundred Hz of drift keeps the fine texture boiling rather than frozen.
    this.phV = wrap(this.phV + (TAU * 700 * valueNoise(t * 0.31, 23)) / 60, TAU)
    // The sound beat also carries their audio: FM at speech-ish rates, so the
    // herringbone sways with a programme nobody can hear.
    this.phS = wrap(
      this.phS +
        (TAU *
          (160 * valueNoise(t * 0.23, 24) + 45 * valueNoise(t * 2.3, 25))) /
          60,
      TAU,
    )
    // The ingress rig: a two-way radio whose carrier owes nothing to any NTSC
    // frequency. Its visible beat wanders around ~2.3 MHz — the herringbone
    // holds no fixed angle — and the operator keys the mic in stretches, so
    // the interference arrives in transmissions with real silence between,
    // not as a steady tone.
    const cps =
      0.16 + 0.045 * valueNoise(t * 0.19, 33) + 0.008 * valueNoise(t * 1.7, 34)
    this.phI = wrap(this.phI + TAU * cps * N, TAU)
    // Biased so a turned-up knob shows something within a few seconds, while
    // the slow term still drops the sum below zero for real off-air stretches.
    const key = Math.min(
      1,
      Math.max(
        0,
        0.2 + 1.5 * valueNoise(t * 0.34, 31) + 0.7 * valueNoise(t * 1.2, 32),
      ),
    )
    return {
      rfAdjEps: eps,
      rfAdjTau: this.tau,
      rfAdjPhase: this.phV,
      rfAdjPhaseS: this.phS,
      ingressCps: cps,
      ingressRowCyc:
        SAMPLES_PER_LINE * cps - Math.floor(SAMPLES_PER_LINE * cps),
      ingressPhase: this.phI,
      ingressKey: key,
      ...this.fade(t, c),
    }
  }

  private fade(t: number, c: RfControls) {
    // The two paths' phase difference drifts at a rate that wanders and now
    // and then reverses, so a null can hang for a second or sweep past.
    const cps = c.rfFadeHz * (0.9 + 1.2 * valueNoise(t * c.rfFadeHz * 0.7, 51))
    this.pathPhase = wrap(this.pathPhase + (TAU * cps) / 60, TAU)
    const r = c.rfFade * (0.8 + 0.2 * valueNoise(t * 0.35, 52))
    const paths =
      Math.hypot(
        1 + r * Math.cos(this.pathPhase),
        r * Math.sin(this.pathPhase),
      ) /
      (1 + r)
    const tropoDb = 18 * c.rfFade * Math.max(0, valueNoise(t * 0.06, 53) + 0.35)
    const carrier = paths * 10 ** (-tropoDb / 20)
    const want = clamp(1 / Math.max(carrier, 1e-6), 1, IF_GAIN_MAX)
    this.ifGain +=
      (want - this.ifGain) * (want < this.ifGain ? AGC_ATTACK : AGC_RELEASE)
    return c.rfFade > 0
      ? {
          rfFadeK: clamp(this.ifGain * carrier, 0.01, IF_OVERLOAD),
          rfFadeG: this.ifGain,
          rfFloor: FADE_FLOOR,
        }
      : { rfFadeK: 1, rfFadeG: 1, rfFloor: 0 }
  }
}

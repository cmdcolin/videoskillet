// The deck's auto-tracking servo, as a machine that searches rather than a
// knob that parks.
//
// `trackPos` used to be where the mistracked band sits. On a real deck it is
// where the servo has *got to*: it reads the RF envelope, steps the capstan
// phase until the envelope peaks, and the band of noise is the picture of it
// being wrong. Every disturbance shows in the same place — a scene change on
// the tape, coming out of shuttle, a splice going past, a stretched patch of
// tape, the cabinet being thumped — the servo loses the peak, sweeps, overshoots
// and settles, and a loose one never quite settles at all.
//
// So this is a second-order loop with a dead band and a slow tape-stretch walk.
// Inside the dead band it does nothing and the stretch carries the band away;
// past it the loop pulls, with a damping that `hunt` takes down toward zero so
// the correction rings. The mistrack severity is read off the loop's own error
// and velocity: at rest the band all but disappears, and every sweep brings it
// back. A kick is a shove on the velocity plus a jump in tape tension, and
// tension is what the vertical seam flags on — the top of the picture flinches
// with the same events that unseat the tracking.
//
// `hunt` at 0 hands the two tracking controls back exactly as they were: the
// band parks where `trackPos` says at the severity `trackAmt` says, and nothing
// here costs a frame anything.

import { clamp, clamp01 } from '../math'

const DT = 1 / 60

export interface ServoControls {
  target: number // trackPos, where the servo is trying to sit
  amt: number // trackAmt, the severity the hand asked for
  hunt: number // 0 parked .. 1 a servo that cannot settle
  kick: number // how hard an event unseats it
}

export interface ServoOut {
  pos: number
  amt: number
  // Extra retrace flag from tape tension, in µs, on top of syncBendUs.
  flagUs: number
}

const MAX_VEL = 3

export class TrackingServo {
  private pos = 0.85
  private vel = 0
  private stretch = 0
  private tension = 0
  private pending = 0

  constructor(private rand: () => number = Math.random) {}

  // An event the tape or the room delivered this frame, 0..1. Several in one
  // frame add up; a frame with none is the common case.
  kick(size: number): void {
    this.pending += size
  }

  update(c: ServoControls): ServoOut {
    const hunt = clamp01(c.hunt)
    this.tension *= 0.94
    if (hunt === 0) {
      this.pos = c.target
      this.vel = 0
      this.stretch = 0
      this.pending = 0
      return { pos: c.target, amt: c.amt, flagUs: 0 }
    }
    // Tape stretch: an OU walk that carries the true track away from where the
    // servo last found it, so a settled loop drifts back out of its dead band.
    this.stretch += -this.stretch * 0.02 + (this.rand() - 0.5) * 0.012 * hunt
    // A bad tape trips the RF detector on its own now and then.
    if (this.rand() < 0.015 * hunt * hunt)
      this.pending += 0.3 + 0.7 * this.rand()

    const shove = this.pending * c.kick
    this.pending = 0
    if (shove > 0) {
      this.vel += shove * (1.5 + 3 * hunt) * (this.rand() < 0.5 ? -1 : 1)
      this.tension += shove
    }

    const err = c.target + this.stretch - this.pos
    const dead = 0.01 + 0.03 * hunt
    const k = 4 + 20 * hunt
    const zeta = 0.9 - 0.75 * hunt
    const damp = 2 * Math.sqrt(k) * zeta
    const acc = (Math.abs(err) > dead ? k * err : 0) - damp * this.vel
    this.vel = clamp(this.vel + acc * DT, -MAX_VEL, MAX_VEL)
    this.pos += this.vel * DT
    // The band cannot leave the picture; a servo slammed against its end stop
    // bounces back in.
    if (this.pos < 0 || this.pos > 1) {
      this.pos = clamp01(this.pos)
      this.vel = -this.vel * 0.5
    }

    const unrest =
      Math.abs(err) * 8 + Math.abs(this.vel) * 1.2 + this.tension * 0.6
    return {
      pos: this.pos,
      amt: Math.min(c.amt + hunt * Math.min(unrest, 1), 1),
      flagUs: Math.min(this.tension, 3) * 4 * hunt,
    }
  }
}

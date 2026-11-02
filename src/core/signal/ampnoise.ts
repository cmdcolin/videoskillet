// The deck's video amplifier with a defective transistor in it. Two kinds of
// low-frequency noise come out of one bad junction, and both move the stage's
// operating point, so each is a DC level and a gain at once:
//
// - Popcorn (burst, RTS) noise: a trap in the junction captures and releases
//   one carrier, and the current switches between two discrete values at
//   random intervals. Two traps give four levels. The picture clunks between
//   them, and a switch lands partway down a field, so the frame it happens in
//   carries the step as a horizontal edge.
// - Flicker (1/f) noise: a slow wander with no corner, summed here from three
//   relaxations an octave-and-more apart, so black level breathes over
//   seconds.
//
// Everything is drawn from hashes of the frame count, so a take reproduces.

import { LINES } from './constants'
import { hash01, hashGauss } from './noise'

export interface AmpNoiseControls {
  popcornIre: number
  popcornHz: number
  flickerIre: number
}

export interface AmpNoiseUniforms {
  ampLvl0: number
  ampLvl1: number
  ampStep: number
  ampStepRow: number
}

// Each trap's switching rates as multiples of the control's rate, low-to-high
// then high-to-low, and its step as a fraction of the control's step. The
// first trap mostly sits low and pops up briefly; the second is slower and
// holds either state for longer.
const TRAPS = [
  { up: 0.6, down: 1.6, size: 1 },
  { up: 0.25, down: 0.4, size: -0.55 },
]

const FLICKER_TAU_S = [0.7, 4, 25]
const FLICKER_W = [0.5, 0.6, 0.65]
const FLICKER_NORM = 1 / Math.hypot(...FLICKER_W)
const DT = 1 / 60

export class AmpNoise {
  private readonly high = TRAPS.map(() => false)
  private readonly ou = FLICKER_TAU_S.map((_, i) => hashGauss(0x51, 0xf1c0 + i))

  update(frame: number, c: AmpNoiseControls): AmpNoiseUniforms {
    const flick0 = c.flickerIre * this.flicker()
    if (c.flickerIre > 0) this.stepFlicker(frame)
    const flick1 = c.flickerIre * this.flicker()
    const pop0 = c.popcornIre * this.popcorn()
    const switched = c.popcornIre > 0 && this.stepTraps(frame, c.popcornHz)
    const pop1 = c.popcornIre * this.popcorn()
    return {
      ampLvl0: flick0 + pop0,
      ampLvl1: flick1 + pop0,
      ampStep: pop1 - pop0,
      ampStepRow: switched ? LINES * hash01(frame, 0x7a11) : LINES,
    }
  }

  // Zero-mean over a long run: each trap's level less its share of time high.
  private popcorn(): number {
    return TRAPS.reduce(
      (sum, t, k) =>
        sum + t.size * ((this.high[k] ? 1 : 0) - t.up / (t.up + t.down)),
      0,
    )
  }

  private stepTraps(frame: number, hz: number): boolean {
    let switched = false
    TRAPS.forEach((t, k) => {
      const rate = hz * (this.high[k] ? t.down : t.up)
      if (hash01(frame, 0x90c0 + k) < rate * DT) {
        this.high[k] = !this.high[k]
        switched = true
      }
    })
    return switched
  }

  private flicker(): number {
    return (
      FLICKER_NORM * this.ou.reduce((sum, x, i) => sum + FLICKER_W[i]! * x, 0)
    )
  }

  private stepFlicker(frame: number): void {
    FLICKER_TAU_S.forEach((tau, i) => {
      const a = Math.exp(-DT / tau)
      this.ou[i] =
        a * this.ou[i]! + Math.sqrt(1 - a * a) * hashGauss(frame, 0xf11c + i)
    })
  }
}

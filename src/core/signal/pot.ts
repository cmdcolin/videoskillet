// A dirty potentiometer and the hand on its knob. The wiper's speed is what a
// dirty carbon track turns into crackle, so this is the CPU half: it walks the
// knob and reports how fast the wiper is moving, and the shaders turn that
// speed into contact breaks along the raster.

import type { Rand } from '../rng'

// The pot clipped in series with one source's cable: a linear-taper 10 kΩ, the
// common one in a parts drawer. Into a 75 Ω load nearly all of its travel is
// darkness, and the picture lives in the first few percent, which is where a
// hand fiddling with it ends up working.
export const POT_OHMS = 10000

// The pot wired as a passive crossfader, A on one end, B on the other and the
// wiper out to the bus. A 10 kΩ track there would leave the middle of the throw
// black, so this one is 1 kΩ.
export const MIX_POT_OHMS = 1000

// How far a fiddling hand twists either side of where the knob is set, as a
// fraction of the travel, and how fast the wiper catches up with a twist.
const HAND_REACH = 0.04
// A crossfader is thrown, not trimmed, so a hand on one swings further.
export const MIX_POT_HAND_REACH = 0.25
const TWIST_S = 0.05
// How long a turn keeps the wiper crackling once the knob stops. A drag
// arrives as a few slider events a frame apart, so the speed is held across
// the gaps between them.
const SPEED_HOLD_S = 0.15

export interface PotWiper {
  // where the wiper is, as a fraction of the travel
  travel: number
  // how fast it is moving, fractions of the travel per second
  speed: number
}

export class PotHand {
  private offset = 0
  private target = 0
  private lastTravel = 0
  private speed = 0

  // Rolls dice only while the hand is fiddling, so a take with the hand off
  // leaves every other roll where it was.
  constructor(
    private readonly rand: Rand,
    private readonly reach = HAND_REACH,
  ) {}

  update(setTravel: number, fiddle: number, dt: number): PotWiper {
    if (fiddle > 0 && this.rand() < dt * (1 + 5 * fiddle)) {
      this.target = (this.rand() * 2 - 1) * fiddle * this.reach
    } else if (fiddle <= 0) {
      this.target = 0
    }
    this.offset += (this.target - this.offset) * (1 - Math.exp(-dt / TWIST_S))
    const travel = Math.min(Math.max(setTravel + this.offset, 0), 1)
    const moved = Math.abs(travel - this.lastTravel) / dt
    this.lastTravel = travel
    this.speed = Math.max(moved, this.speed * Math.exp(-dt / SPEED_HOLD_S))
    return { travel, speed: this.speed }
  }
}

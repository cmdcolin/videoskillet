// A burst of snow on the way in: the link's way of starting a loop that cannot
// start itself.
//
// A camera feedback look is an amplifier that boots with nothing in it. VRAM
// comes up empty (useEngine says the same thing about a device-loss rebuild:
// "a feedback look takes a second or two to build back up"), so a loop whose
// mix and exposure multiply past unity has nothing to multiply, and a board
// that spirals within seconds of a hand crossing the lens opens black and stays
// black. The burst is the hand: broadband noise at the input, long enough for
// the loop to take hold of it and gone by the time the structure it started is
// worth looking at.
//
// Snow rather than a flash of white, because a loop amplifies detail and a flat
// field has none: what comes back on the next lap is the same flat field one
// gain step brighter. Noise arrives with every spatial frequency the loop's
// zoom and rotate have anything to do, which is why a real set's own snow is
// what people point a camera at to start one.
//
// A fault (`signal/fault.ts`) rather than a look, because it has to leave
// nothing behind. Everything a fault drives is restored per frame, so the board
// the reader ends on is the board the link says — a burst that raised `noiseIre`
// and left it there would be a link lying about its own picture.

import { clamp } from '../core/math'

import type { Controls } from '../core/controls'
import type { FaultPlan } from '../core/signal/fault'

// Long enough for the loop to take hold, short enough that the picture is not
// what the burst is doing. Measured against the camera-feedback presets: a
// spiral is visibly building by 1s and self-sustaining by 2s, and past about 4s
// the snow is what the reader thinks they were sent.
export const SNOW_SECONDS = 1.5

// The bounds a hand-written `#snow=` is held to. A link is untrusted input and
// this one drives an envelope: unbounded, `#snow=1e9` is a burst that outlives
// the session, which is indistinguishable from the app having loaded on snow.
export const SNOW_MIN_SECONDS = 0.1
export const SNOW_MAX_SECONDS = 10

// The peak, in IRE. Well past the 40 the slider redlines at, because this is
// the far end of a bad channel rather than tape grain — the loop needs enough
// signal to still be above its own noise floor after a lap or two of a mix
// under unity.
const SNOW_IRE = 60

// `#snow=`, as seconds. The flag alone is the default duration, and so is
// anything unreadable: a link that asks for a burst and misspells how long
// should get a burst, not silence.
export const snowSeconds = (raw: string): number => {
  const n = Number(raw)
  return raw === '' || !Number.isFinite(n)
    ? SNOW_SECONDS
    : clamp(n, SNOW_MIN_SECONDS, SNOW_MAX_SECONDS)
}

// The burst as a fault plan, against the board it is landing on.
//
// `resting` is read for one key: a fault travels to a destination rather than
// adding an offset (fault.ts), so a look already noisier than the peak would be
// *cleaned* for a second by a burst that named a fixed 60. Taking the higher of
// the two makes this a kick on any board.
export const snowPlan = (resting: Controls, seconds: number): FaultPlan => ({
  peak: { noiseIre: Math.max(SNOW_IRE, resting.noiseIre) },
  // The sim's own rate, which is what `FaultPlan.frames` counts in — the same
  // conversion the transition shelf makes.
  frames: Math.round(clamp(seconds, SNOW_MIN_SECONDS, SNOW_MAX_SECONDS) * 60),
  // Full depth on the first frame, healing over the rest of the span. This is
  // the degenerate cut fault.ts names and declines to put on the shelf — wrong
  // for a transition, which needs a fault to arrive before it hides an edit,
  // and the only shape for this one: the loop wants its energy before it has
  // anything of its own, and a burst that ramped in would be seeding a picture
  // that had already settled into black.
  cut: 0,
  // The cut also kicks the tracking servo (pipeline.ts), which is the whole of
  // what the burst does besides the noise, and is what a set does when it is
  // switched on.
  onCut: () => {},
})

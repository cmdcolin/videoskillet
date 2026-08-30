// The look nudging itself, on a clock, for as long as you leave it.
//
// Every other roll in the app answers a press: you ask for something else and
// the board hands it over. This one is the same gentle nudge `mutate` already
// makes, fired every fifteen seconds by nobody, arriving over most of the gap
// so the picture never cuts. What it is for is the case the panel cannot serve
// — a set running while your hands are on something else, a screen in a room
// with no one at the keyboard — and the shape of it is one switch you flip and
// forget rather than a rundown you author.
//
// **The strip is the other answer to this, and they are not the same tool.**
// A shake row on loop (`strip.ts`, the tray's ＋ shake) jitters the live look
// every few bars and is the right thing when the wander is part of a piece:
// it is authored, saved, seeded, reproducible, and it holds in bars because it
// is cut to music. This holds in seconds, keeps nothing, and takes one press
// from anywhere including the keyboard — so a drift is a mode the app is in,
// where a strip is a thing you made.
//
// The word is spoken for twice in this repo, and the other one is not this:
// `Hold.drift` in `strip.ts` is how loose a row's bar count is, and it reaches
// the panel as the `≈` in "≈4 bars" rather than as a word. Nothing here is that.
//
// Nothing here banks a step. A drift left running overnight would otherwise be
// a walk of a thousand looks nobody chose, with the one you did choose at the
// far end of it; the caller banks a single step when it starts (`app.tsx`), so
// one ctrl+z puts back the look you set drifting.

import { snapToStep } from './controls'
import { MUTATE_AMOUNTS, ROLL_NEVER_STARTS, mutate } from './mutate'
import { fromTravel, toTravel } from './travel'

import type { Controls } from '../core/controls'
import type { Rand } from '../core/rng'
import type { SliderDef } from './controls'

// How often a leg sets off. Long enough that a leg reads as the board changing
// its mind rather than as motion — modulation is what moves a control on a
// timescale you watch, and a drift that fired every second would be a bad LFO
// on every control at once — and short enough that a picture left alone is
// somewhere else within a minute.
export const DRIFT_SECONDS = 15

// The share of that gap a leg spends travelling. Under 1 so every leg lands
// before the next sets off: a morph interrupted mid-flight starts from the
// tween and the board never reaches anywhere it was going, which is a drift
// that wanders half as far as it says it does. The remainder is the pause at
// the end of a leg, and it is what makes the mode read as a board settling and
// then thinking again rather than as one continuous slide.
export const DRIFT_ARRIVE = 0.85

// The roll a leg makes: the gentlest one the panel offers, which is the amount
// the modifier ladder gives to `alt`. Anything harder compounds — this is the
// only roll in the app that fires again without being asked — so the step size
// here is a statement about the hundredth press, not the first.
export const DRIFT_AMOUNT = MUTATE_AMOUNTS.gentle

// How far each leg falls back toward the look you set drifting, as a share of
// the distance.
//
// **Without it the mode destroys what it is showing.** A free jitter is a
// random walk, and a random walk with a wall at each end of every track spends
// its first hour spreading out and every hour after that parked against the
// rails: `mutate` also wakes a resting control with probability `amt/2`, so a
// board left drifting overnight ends as every fault in the rig switched on at
// once, which is the exact look mutate's own `wake` rule exists to avoid making
// in one press.
//
// A pull turns the walk into one that has somewhere to be. At 0.02 a leg gives
// back a fiftieth of its distance from the anchor, so the anchor stops mattering
// after about 35 legs (nine minutes) and the wander still settles at a spread of
// roughly a tenth of a track rather than growing without limit — near enough to
// the look you left it on to still be that look, far enough that a minute of
// watching shows something new.
export const DRIFT_PULL = 0.02

// How long a leg travels for, given how often one sets off.
export const driftLegSeconds = (everyS = DRIFT_SECONDS): number =>
  everyS * DRIFT_ARRIVE

// Whether two looks agree on everything a drift is allowed to touch. The view
// is deliberately out of it, because it is out of `MUTATE_SLIDERS` and out of a
// morph (`morphTo`'s `holdKeys`): a magnifier moved mid-drift must not read as
// somebody having replaced the look.
export const sameDrift = (
  sliders: readonly SliderDef[],
  a: Controls,
  b: Controls,
): boolean => sliders.every(s => a[s.key] === b[s.key])

// One leg: a gentle nudge to where the board is, pulled a little back toward
// where it set off from.
//
// The pull is applied in travel rather than in value, so a curved control comes
// home the way its slider would bring it home, and through `snapToStep` so a
// mode control lands on a mode. It can only ever move a control toward a value
// the anchor already holds, which is what keeps it inside the rule every roll
// obeys — a drift starts no strobe a hand did not start (`ROLL_NEVER_STARTS`),
// including by pulling one back up off its floor.
export function driftLeg(
  from: Controls,
  anchor: Controls,
  sliders: readonly SliderDef[],
  rand: Rand = Math.random,
): Controls {
  const next = mutate(from, sliders, DRIFT_AMOUNT, rand)
  for (const s of sliders) {
    if (ROLL_NEVER_STARTS.has(s.key) && from[s.key] === 0) continue
    const t = toTravel(s, next[s.key])
    const home = toTravel(s, anchor[s.key])
    next[s.key] = snapToStep(s, fromTravel(s, t + (home - t) * DRIFT_PULL))
  }
  return next
}

export interface DriftDeps {
  // Where the board has settled, or where a morph in flight is taking it — the
  // question `useMix.banked` asks, and asked here for the same reason: a tween
  // is a frame, not a look, and a leg rolled off one would jitter a board that
  // is still on its way somewhere.
  getSettled: () => Controls
  // Hand the next look over to travel to. The seconds are the leg's own rather
  // than the look bar's morph setting, deliberately: at `morph: cut` a drift
  // would fire the board somewhere new every fifteen seconds, which is a
  // slideshow of accidents rather than a wander, and the setting is about what
  // your hands do.
  land: (to: Controls, seconds: number) => void
  sliders: readonly SliderDef[]
  rand?: Rand
  everyS?: number
}

// The walk itself, with no React in it — the same split `useStrip` makes, and
// for the same reason: what is worth pinning down is when a leg fires and what
// it rolls off, and a plain object is testable with fake timers where a hook is
// not testable at all in this repo.
export function makeDrift(deps: DriftDeps) {
  const everyS = deps.everyS ?? DRIFT_SECONDS
  let timer: ReturnType<typeof setInterval> | undefined
  // Where the wander is tethered, and where the last leg was headed. The pair
  // is what lets a drift notice it is no longer the only thing moving the
  // board: a leg that finds the board somewhere other than where it aimed takes
  // that as the new anchor, so a preset clicked or a slider dragged mid-drift
  // becomes the look the wander is now around instead of being slowly undone by
  // a pull toward a look you left ten minutes ago.
  let anchor: Controls | null = null
  let aim: Controls | null = null

  const leg = () => {
    const from = deps.getSettled()
    // The board is where the last leg aimed it, or somebody else has been at
    // it. Only the first of those keeps the tether.
    const home =
      anchor !== null && aim !== null && sameDrift(deps.sliders, from, aim)
        ? anchor
        : from
    anchor = home
    const next = driftLeg(from, home, deps.sliders, deps.rand)
    aim = next
    deps.land(next, driftLegSeconds(everyS))
  }

  return {
    // The first leg fires on the press. A mode whose first fifteen seconds look
    // exactly like the mode being off is one you press twice.
    start() {
      if (timer !== undefined) return
      leg()
      timer = setInterval(leg, everyS * 1000)
    },
    // The leg in flight is the caller's to stop (`stopGlide`), and it stops it:
    // this promises to keep the board wherever it has got to, and a leg left
    // travelling would spend another twelve seconds carrying it somewhere
    // nobody asked for — which is the drift still running under another name.
    stop() {
      if (timer !== undefined) clearInterval(timer)
      timer = undefined
      anchor = null
      aim = null
    },
  }
}

export type Drift = ReturnType<typeof makeDrift>

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
// **What wanders is a scope.** The look bar's switch sets the whole board
// going; a stage heading's switch sets that stage going and leaves the rest of
// the rig standing still, which is the version a session with somebody in the
// room actually wants — the tape path breathing under a look you are still
// dialing in on the sync card. Same clock, same leg, same tether: a scope is a
// slider list and a name, and everything below reads the list it was handed.
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
//
// **Three modes, one clock, one tether.** A wander never comes back — it leans
// toward the anchor and re-aims from wherever it got to. The other two are round
// trips: the board travels out to an away look and then travels back to the
// anchor exactly, so every other leg is the look you set going. That is what
// lets a trip be bold where a wander has to be gentle (`DRIFT_AMOUNT` against
// `CYCLE_AMOUNT`): a wander compounds and a trip cannot, because half of it is
// the anchor itself.
//
// The gate in `signal/stab.ts` is the same round trip at frames instead of
// seconds, and the two are not interchangeable. A gate *cuts*, several times a
// second, and a fade at that rate would redesign the filter bank every frame;
// this morphs, because a leg is `land(to, seconds)` and the glide is already
// there. So a trip is a board changing its mind and coming back, and a gate is a
// thumb on a kill switch.

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

// How much of a scope resting at stock a leg wakes, which is `mutate`'s own
// default for the amount above — named here because a scope has to say what its
// first leg wakes, and the board's switch says this.
export const DRIFT_WAKE = DRIFT_AMOUNT / 2

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
  wake: number = DRIFT_WAKE,
): Controls {
  const next = mutate(from, sliders, DRIFT_AMOUNT, rand, wake)
  for (const s of sliders) {
    if (ROLL_NEVER_STARTS.has(s.key) && from[s.key] === 0) continue
    const t = toTravel(s, next[s.key])
    const home = toTravel(s, anchor[s.key])
    next[s.key] = snapToStep(s, fromTravel(s, t + (home - t) * DRIFT_PULL))
  }
  return next
}

// Which of the three shapes a scope is moving in.
//
// `wander` is the mode this file started as: a nudge to where the board is, and
// it never arrives anywhere. The other two are the round trip — out to an away
// look, back to the anchor, out again — and they differ in one thing only, which
// is whether the far end is the same look every time. `cycle` holds the away
// look it rolled on the press, so the board alternates between two settings the
// way an intermittent contact does. `tour` rolls a fresh one for every trip out,
// so the board comes home between excursions that are each somewhere new.
//
// Held at look level rather than per control, because that is what it is for: a
// wobble on one knob is what the modulation bay is, and it has waves of its own
// (`modstate.ts`). This is the whole board leaving and returning.
export type DriftMode = 'wander' | 'cycle' | 'tour'

// What each shape is called, and the clause that says what it does to a scope.
//
// Here rather than in the row that draws the switch because two surfaces name
// the same three things — the look bar's switch, which has a caret and a
// tooltip, and every stage heading, which has neither and still has to say what
// pressing it will do.
export const DRIFT_MODE_WORDS: Record<
  DriftMode,
  { label: string; does: string }
> = {
  wander: {
    label: 'drift',
    does: 'wander, staying around the look it set off from',
  },
  cycle: {
    label: 'cycle',
    does: 'travel out to one look and back to this one, over and over',
  },
  tour: {
    label: 'tour',
    does: 'travel out somewhere new and back to this one, over and over',
  },
}

// How far an away look stands from the anchor, as a share of each slider's
// travel: the roll a plain press of `random nudge` makes.
//
// Three times `DRIFT_AMOUNT`, and the difference is the whole reason a trip can
// afford it. A wander's legs compound — leg 400 is rolled off leg 399 — so its
// step size is a statement about the hundredth press, and `DRIFT_PULL` exists
// because even at 0.04 the walk would otherwise end up against the rails. A trip
// rolls every away look off the anchor and returns to it exactly, so nothing
// accumulates and there is nothing to pull back: what is left is taste, and at
// 0.04 a round trip is a board that appears not to be doing anything.
export const CYCLE_AMOUNT = MUTATE_AMOUNTS.normal

// How much of a scope resting at stock an away look wakes — `mutate`'s own
// default for the amount above.
//
// A scope says what its first leg wakes (`DriftScope.wake`) and a trip cannot
// simply use that. The board's answer is `DRIFT_WAKE`, which is deliberately
// stingy because a wander fills the board in over a minute of compounding legs;
// a trip has no minute — the away look it rolls is the one you will be looking
// at for as long as the mode runs, so a board set cycling from stock at 2% would
// travel between two looks nobody could tell apart. A stage that says 1 means
// it, and keeps it.
export const CYCLE_WAKE = CYCLE_AMOUNT / 2

const awayWake = (wake: number) => Math.max(wake, CYCLE_WAKE)

// The look at the far end of a trip: a nudge to the anchor, at the amount above.
//
// A nudge rather than a `spike` or a fresh `random look`. What comes back has to
// still be the look you set going — a trip to somewhere unrelated is a slideshow
// of two slides — and it inherits every rule a roll obeys by being one, which
// includes the one that matters most here: `mutate` will not start a strobe on a
// control resting at zero, so neither end of a trip can.
export const cycleAway = (
  anchor: Controls,
  sliders: readonly SliderDef[],
  rand: Rand = Math.random,
  wake: number = CYCLE_WAKE,
): Controls => mutate(anchor, sliders, CYCLE_AMOUNT, rand, awayWake(wake))

// One leg of a round trip: the scope's own controls taken from wherever this leg
// is headed, and every other control left exactly as the caller handed it over.
//
// No roll and no pull, which is what makes the trip a trip: both ends are looks
// that already exist — the anchor, and an away look rolled off it — so a leg is
// a copy rather than a draw, and the board arrives on the anchor to the digit
// however many hundred trips it has made.
export function cycleLeg(
  from: Controls,
  to: Controls,
  sliders: readonly SliderDef[],
): Controls {
  const next = { ...from }
  for (const s of sliders) next[s.key] = to[s.key]
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
  rand?: Rand
  everyS?: number
}

// What one switch set wandering. The look bar's switch names the whole board;
// a stage heading's names that stage, so a card can wander while the rest of
// the rig holds still — which is the shape a session actually reaches for, one
// circuit breathing under a look you are still dialing in.
//
// Named rather than anonymous because the name is what turns the switch off
// again, and what the heading reads to know it is lit.
export interface DriftScope {
  name: string
  sliders: readonly SliderDef[]
  // Which shape this scope moves in. Named per scope rather than held by the
  // walk because a scope is the unit a switch turns on, and the mode is part of
  // what the switch means: two stages can be touring while a third wanders.
  mode: DriftMode
  // How much of the scope the *first* leg wakes — the share of its controls
  // sitting at stock that get moved off it, on the press rather than every
  // fifteen seconds after.
  //
  // It is the split `mutateGroup` and `mutateLook` already make, arriving here
  // for the reason it arrives there. A stage's switch names that stage, and a
  // stage sitting at stock that answers the press by doing nothing for a minute
  // reads as a switch that did not work — so it wakes all of it (`1`). The
  // board's switch names everything, where waking all of it is a fresh
  // randomize with the old look showing through (`mutate`'s own note on
  // `wake`), so it wakes `DRIFT_WAKE` and the wander finds the rest in its own
  // time.
  //
  // A round trip reads the same number and floors it at `CYCLE_WAKE`, since it
  // has no "in its own time" to find anything in — see the note there.
  wake: number
}

// The whole board's own scope name. Every other scope is named for the group it
// covers, so this one is spelled the way a group never is and the look bar's
// switch keeps its own tether.
export const DRIFT_BOARD = 'the board'

// One scope as the walk holds it: what it moves, and the pair of looks that
// tells it whether it is still the only thing moving them.
interface Tether {
  sliders: readonly SliderDef[]
  wake: number
  mode: DriftMode
  // Where this scope's wander is tethered, and where its last leg was headed.
  // The pair is what lets a drift notice it is no longer the only thing moving
  // the board: a leg that finds a control somewhere other than where it aimed
  // takes that as the new anchor, so a preset clicked or a slider dragged
  // mid-drift becomes the look the wander is now around instead of being slowly
  // undone by a pull toward a look you left ten minutes ago.
  anchor: Controls | null
  aim: Controls | null
  // The far end of a round trip, and which end the next leg is headed for.
  //
  // `away` is null until the first trip out rolls one, and again whenever the
  // tether moves: an away look is a nudge to a particular anchor, so one kept
  // across a re-anchor would carry the board back to a look a hand has already
  // replaced. `tour` re-rolls it every trip out regardless, which is the only
  // difference between the two round trips.
  //
  // `out` is true when the next leg travels away. It starts true so the press
  // sets off immediately — a switch whose first fifteen seconds are a trip home
  // to where the board already is looks exactly like a switch that did nothing.
  away: Controls | null
  out: boolean
}

// The walk itself, with no React in it — the same split `useStrip` makes, and
// for the same reason: what is worth pinning down is when a leg fires and what
// it rolls off, and a plain object is testable with fake timers where a hook is
// not testable at all in this repo.
//
// One clock for every scope, and that is the constraint rather than a
// convenience: the app has a single glide (`useMix.landDrift` hands the whole
// look to `startGlide`), so two scopes on two timers would land two morphs a
// few seconds apart and each would cut the other short — which is exactly what
// `DRIFT_ARRIVE` is under 1 to prevent. So a leg is every drifting scope's leg,
// composed into the one look that travels.
export function makeDrift(deps: DriftDeps) {
  const everyS = deps.everyS ?? DRIFT_SECONDS
  let timer: ReturnType<typeof setInterval> | undefined
  const tethers = new Map<string, Tether>()

  const leg = () => {
    const from = deps.getSettled()
    let next = from
    for (const t of tethers.values()) {
      // The board is where the last leg aimed it, or somebody else has been at
      // it. Only the first of those keeps the tether — and it is asked per
      // scope, so a hand on the tape controls re-tethers the tape's drift and
      // leaves the sync card's wander tethered where it was.
      const kept =
        t.anchor !== null && t.aim !== null && sameDrift(t.sliders, from, t.aim)
          ? t.anchor
          : null
      const home = kept ?? from
      // A tether with no anchor yet has never travelled: this is the leg that
      // fired on its press, and the one that has to be seen.
      const wake = t.anchor === null ? t.wake : DRIFT_WAKE
      t.anchor = home
      if (t.mode === 'wander') {
        next = driftLeg(next, home, t.sliders, deps.rand, wake)
        continue
      }
      // A hand on the board re-tethered this scope, so whatever it was
      // travelling to belonged to the look that hand has replaced.
      if (kept === null) t.away = null
      if (t.out) {
        const away =
          t.mode === 'tour' || t.away === null
            ? cycleAway(home, t.sliders, deps.rand, t.wake)
            : t.away
        t.away = away
        next = cycleLeg(next, away, t.sliders)
      } else {
        next = cycleLeg(next, home, t.sliders)
      }
      t.out = !t.out
    }
    // After the loop, so every scope aims at the look that actually travels.
    // Scopes never share a control (`add` sees to it), so each still reads its
    // own keys out of this and ignores what the others did to theirs.
    for (const t of tethers.values()) t.aim = next
    deps.land(next, driftLegSeconds(everyS))
  }

  const tick = () => {
    if (timer !== undefined) clearInterval(timer)
    timer = setInterval(leg, everyS * 1000)
  }

  const stopAll = () => {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
    tethers.clear()
  }

  return {
    // Which scopes are wandering, for the switches that turned them on.
    running: (): string[] => [...tethers.keys()],
    // Set one scope going. The first leg fires on the press — a switch whose
    // first fifteen seconds look exactly like the switch being off is one you
    // press twice — and the clock restarts with it, so the leg in flight is
    // always the only one and always has its full travel.
    //
    // **One control, one anchor.** A scope takes over from every scope it
    // overlaps rather than layering on it: two pulls toward two different homes
    // on one control is a tug of war rather than a wander, and it would read as
    // the drift having stopped working on exactly the controls you aimed two
    // switches at. So the board's switch takes the cards over, and a card's
    // switch narrows a board drift down to that stage.
    //
    // A scope already running in another mode is re-tethered rather than left
    // alone: the mode is part of what the switch says, so picking one is a press
    // and has to answer like one. Asked again in the mode it is already in, this
    // is the second press of a switch that is on, and does nothing.
    add(scope: DriftScope) {
      if (tethers.get(scope.name)?.mode !== scope.mode) {
        tethers.delete(scope.name)
        const keys = new Set(scope.sliders.map(s => s.key))
        for (const [name, t] of tethers) {
          if (t.sliders.some(s => keys.has(s.key))) tethers.delete(name)
        }
        tethers.set(scope.name, {
          sliders: scope.sliders,
          wake: scope.wake,
          mode: scope.mode,
          anchor: null,
          aim: null,
          away: null,
          out: true,
        })
        leg()
        tick()
      }
    },
    // One switch off, the rest left wandering. No leg fires: this promises the
    // stage stays wherever it has got to, and the others are mid-leg.
    remove(name: string) {
      tethers.delete(name)
      if (tethers.size === 0) stopAll()
    },
    // Everything off. The leg in flight is the caller's to stop (`stopGlide`),
    // and it stops it: this promises to keep the board wherever it has got to,
    // and a leg left travelling would spend another twelve seconds carrying it
    // somewhere nobody asked for — which is the drift still running under
    // another name.
    stop: stopAll,
  }
}

export type Drift = ReturnType<typeof makeDrift>

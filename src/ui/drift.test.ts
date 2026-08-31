// What a mode nobody is watching has to be right about.
//
// The two halves are tested for opposite reasons. `driftLeg` is a roll like the
// ones in `mutate.test.ts` and inherits their rules — in range, modes on whole
// values, no strobe started — but it also carries the one claim that cannot be
// read off a single press: that pressing it four hundred more times leaves the
// board somewhere worth looking at. The walk is tested on its clock, because
// when a leg fires and what it rolls off is the whole of what the mode is.

import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { rngFor } from '../core/rng'
import { MUTATE_CIRCUIT_BY_GROUP, MUTATE_SLIDERS } from './controls'
import {
  DRIFT_AMOUNT,
  DRIFT_BOARD,
  DRIFT_SECONDS,
  DRIFT_WAKE,
  driftLeg,
  driftLegSeconds,
  makeDrift,
  sameDrift,
} from './drift'
import { mutate } from './mutate'
import { toTravel } from './travel'

import type { Controls } from '../core/controls'

// The panel's own set, not a hand-picked one: the claims below are about what
// the mode does to the board somebody left it running on.
const SLIDERS = MUTATE_SLIDERS

// How far a look stands from the one it is tethered to, averaged over every
// control, in track rather than in value — the same measure a slider's length
// is, so a hue trim and a five-decade oscillator count the same.
const spread = (look: Controls, anchor: Controls): number =>
  SLIDERS.reduce(
    (sum, s) =>
      sum + Math.abs(toTravel(s, look[s.key]) - toTravel(s, anchor[s.key])),
    0,
  ) / SLIDERS.length

const widest = (look: Controls, anchor: Controls): number =>
  Math.max(
    ...SLIDERS.map(s =>
      Math.abs(toTravel(s, look[s.key]) - toTravel(s, anchor[s.key])),
    ),
  )

// Room for the two 960-leg walks below. They are 5760 rolls over the panel's
// whole 248 controls, and a roll costs a `toFixed` per control on its way back
// through `snapToStep` — about eleven seconds of arithmetic, against a default
// timeout of five. The number is the claim's, not the machine's: shortening the
// walk is what the walk is here to refuse.
const LONG_WALK_MS = 60_000

describe('a leg', () => {
  it('keeps every control in range and every mode on a whole value', () => {
    for (const rand of [() => 0, () => 1, () => 0.5, rngFor(3)]) {
      const out = driftLeg(DEFAULT_CONTROLS, DEFAULT_CONTROLS, SLIDERS, rand)
      for (const s of SLIDERS) {
        expect(out[s.key], s.key).toBeGreaterThanOrEqual(s.min)
        expect(out[s.key], s.key).toBeLessThanOrEqual(s.max)
        if (s.step === 1) expect(Number.isInteger(out[s.key]), s.key).toBe(true)
      }
    }
  })

  // The rule every roll obeys (`ROLL_NEVER_STARTS`), and this is the roll with
  // the most chances to break it: it fires 240 times an hour with nobody in the
  // room, and the pull is a second write per control that the nudge does not
  // have. A tether that strobes must not be able to bring a floor back up.
  it('never starts a strobe on a look that has none', () => {
    const strobing = { ...DEFAULT_CONTROLS, strobeHz: 8, clipHz: 3 }
    let live: Controls = DEFAULT_CONTROLS
    for (let i = 0; i < 200; i++) {
      live = driftLeg(live, strobing, SLIDERS, rngFor(i + 1))
      expect(live.strobeHz).toBe(0)
      expect(live.clipHz).toBe(0)
    }
  })

  // And not on the one leg that wakes everything, which is the leg a stage's
  // switch fires on the press: waking a control is how a roll starts something
  // that was off, and these two are the pair no roll may start.
  it('never starts one on the leg that wakes the whole scope either', () => {
    for (let i = 0; i < 200; i++) {
      const woke = driftLeg(
        DEFAULT_CONTROLS,
        DEFAULT_CONTROLS,
        SLIDERS,
        rngFor(i + 1),
        1,
      )
      expect(woke.strobeHz).toBe(0)
      expect(woke.clipHz).toBe(0)
    }
  })

  // The pull on its own: a rand of 0.5 draws a jitter of exactly zero and wakes
  // nothing, so what is left is the fall back toward the anchor.
  it('brings a control that has wandered back toward where it set off', () => {
    const away = { ...DEFAULT_CONTROLS, fbMix: 0.8 }
    const back = driftLeg(away, DEFAULT_CONTROLS, SLIDERS, () => 0.5)

    expect(back.fbMix).toBeLessThan(away.fbMix)
    expect(back.fbMix).toBeGreaterThan(DEFAULT_CONTROLS.fbMix)
  })

  it('is a pure function of its rand, leaving the input untouched', () => {
    const input = { ...DEFAULT_CONTROLS }
    expect(driftLeg(input, input, SLIDERS, rngFor(11))).toEqual(
      driftLeg(input, input, SLIDERS, rngFor(11)),
    )
    expect(input).toEqual(DEFAULT_CONTROLS)
  })

  // The claim the pull exists for, and the only one that needs four hours of
  // presses to see: a drift settles into a neighbourhood, where the same nudge
  // without a tether keeps going. Measured at 960 legs — four hours at the
  // fifteen-second period — over seeded rolls, so these are exact numbers and
  // not a tolerance: the free walk drags a control the entire width of its
  // track and averages four times the spread, which is a board with every fault
  // in the rig switched on rather than the look somebody left running.
  it(
    'settles into a neighbourhood where a free nudge runs away',
    () => {
      for (let seed = 1; seed <= 3; seed++) {
        const rand = rngFor(seed)
        let tethered: Controls = DEFAULT_CONTROLS
        let free: Controls = DEFAULT_CONTROLS
        for (let i = 0; i < 960; i++) {
          tethered = driftLeg(tethered, DEFAULT_CONTROLS, SLIDERS, rand)
          free = mutate(free, SLIDERS, DRIFT_AMOUNT, rand)
        }

        expect(spread(tethered, DEFAULT_CONTROLS)).toBeLessThan(0.08)
        expect(widest(tethered, DEFAULT_CONTROLS)).toBeLessThan(0.8)
        expect(spread(free, DEFAULT_CONTROLS)).toBeGreaterThan(0.15)
        expect(widest(free, DEFAULT_CONTROLS)).toBeGreaterThan(0.85)
      }
    },
    LONG_WALK_MS,
  )

  // Not so tethered that the mode does nothing: an hour in, something on the
  // board has to have gone somewhere you would notice.
  it('still takes a control a long way from where it started', () => {
    const rand = rngFor(4)
    let live: Controls = DEFAULT_CONTROLS
    for (let i = 0; i < 240; i++) {
      live = driftLeg(live, DEFAULT_CONTROLS, SLIDERS, rand)
    }

    expect(widest(live, DEFAULT_CONTROLS)).toBeGreaterThan(0.25)
  })
})

describe('what a look is measured against', () => {
  it('reads a look the drift has not touched as the same look', () => {
    expect(sameDrift(SLIDERS, DEFAULT_CONTROLS, { ...DEFAULT_CONTROLS })).toBe(
      true,
    )
  })

  // The view is out of `MUTATE_SLIDERS`, out of a morph's travelling keys, and
  // so out of this: aiming the magnifier mid-drift is not somebody replacing
  // the look, and a drift that re-tethered on it would forget where it was.
  it('ignores where the magnifier is pointed', () => {
    const looked = { ...DEFAULT_CONTROLS, zoom: 2.4 }

    expect(sameDrift(SLIDERS, DEFAULT_CONTROLS, looked)).toBe(true)
    expect(
      sameDrift(SLIDERS, DEFAULT_CONTROLS, { ...looked, fbMix: 0.5 }),
    ).toBe(false)
  })
})

// The whole board, as the look bar's switch sets it going.
const BOARD = { name: DRIFT_BOARD, sliders: SLIDERS, wake: DRIFT_WAKE }

// Two stages that share no control, as two stage switches set them going.
const stage = (name: string) => ({
  name,
  sliders: MUTATE_CIRCUIT_BY_GROUP.get(name) ?? [],
  wake: 1,
})
const [FIRST, SECOND] = [...MUTATE_CIRCUIT_BY_GROUP.keys()].map(stage)

describe('the walk', () => {
  // A board the drift is the only thing writing to: `land` records where it was
  // told to go, and `getSettled` answers with it, which is what the app does
  // through the glide target.
  const board = () => {
    const legs: { to: Controls; seconds: number }[] = []
    let settled: Controls = DEFAULT_CONTROLS
    return {
      legs,
      put: (next: Controls) => {
        settled = next
      },
      deps: {
        getSettled: () => settled,
        land: (to: Controls, seconds: number) => {
          legs.push({ to, seconds })
          settled = to
        },
        rand: rngFor(9),
      },
    }
  }

  it('fires the first leg on the press, then one a period', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.add(BOARD)

    expect(b.legs).toHaveLength(1)
    vi.advanceTimersByTime(DRIFT_SECONDS * 1000 * 3)
    expect(b.legs).toHaveLength(4)

    drift.stop()
    vi.advanceTimersByTime(DRIFT_SECONDS * 1000 * 3)
    expect(b.legs).toHaveLength(4)
    vi.useRealTimers()
  })

  // Every leg lands before the next one sets off. A morph still travelling when
  // the next leg starts is a board that never arrives anywhere, which is a
  // wander half as wide as the one the period promises.
  it('travels for less than the gap it fires in', () => {
    expect(driftLegSeconds(DRIFT_SECONDS)).toBeLessThan(DRIFT_SECONDS)
    expect(driftLegSeconds(DRIFT_SECONDS)).toBeGreaterThan(DRIFT_SECONDS / 2)

    vi.useFakeTimers()
    const b = board()
    makeDrift(b.deps).add(BOARD)

    expect(b.legs[0].seconds).toBe(driftLegSeconds(DRIFT_SECONDS))
    vi.useRealTimers()
  })

  it('rolls each leg off where the last one was headed', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.add(BOARD)
    vi.advanceTimersByTime(DRIFT_SECONDS * 1000)
    drift.stop()

    // Nothing between the two legs moved the board, so the second is a nudge to
    // the first rather than to the look the mode started on.
    expect(b.legs[1].to).not.toEqual(b.legs[0].to)
    expect(spread(b.legs[1].to, b.legs[0].to)).toBeLessThan(
      spread(b.legs[1].to, DEFAULT_CONTROLS),
    )
    vi.useRealTimers()
  })

  // The one that keeps a drift from undoing a hand. A leg that finds the board
  // somewhere it did not put it takes that as the look to wander around, so a
  // preset clicked ten minutes in is not slowly pulled back to whatever was up
  // when the switch went on.
  it('re-tethers when something else moves the board', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.add(BOARD)

    const elsewhere = mutate(DEFAULT_CONTROLS, SLIDERS, 0.4, rngFor(2), 1)
    b.put(elsewhere)
    for (let i = 0; i < 60; i++) vi.advanceTimersByTime(DRIFT_SECONDS * 1000)
    drift.stop()

    const landed = b.legs.at(-1)!.to
    expect(spread(landed, elsewhere)).toBeLessThan(
      spread(landed, DEFAULT_CONTROLS),
    )
    vi.useRealTimers()
  })

  it('starts once however many times it is asked to', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.add(BOARD)
    drift.add(BOARD)
    vi.advanceTimersByTime(DRIFT_SECONDS * 1000)

    expect(b.legs).toHaveLength(2)
    drift.stop()
    vi.useRealTimers()
  })
})

// What a stage's own switch has to be right about, and all of it is about the
// scopes not being one drift wearing several switches.
describe('a scope', () => {
  const board = () => {
    const legs: Controls[] = []
    let settled: Controls = DEFAULT_CONTROLS
    return {
      legs,
      deps: {
        getSettled: () => settled,
        land: (to: Controls) => {
          legs.push(to)
          settled = to
        },
        rand: rngFor(5),
      },
    }
  }

  // The claim a stage switch is for: the rest of the rig is exactly where you
  // left it, however long the one stage has been wandering.
  it('moves its own stage and leaves every other control alone', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.add(FIRST)
    for (let i = 0; i < 20; i++) vi.advanceTimersByTime(DRIFT_SECONDS * 1000)
    drift.stop()

    const landed = b.legs.at(-1)!
    const moved = FIRST.sliders.filter(
      s => landed[s.key] !== DEFAULT_CONTROLS[s.key],
    )
    expect(moved.length).toBeGreaterThan(0)
    for (const s of SLIDERS) {
      if (!FIRST.sliders.includes(s))
        expect(landed[s.key], s.key).toBe(DEFAULT_CONTROLS[s.key])
    }
    vi.useRealTimers()
  })

  // The press has to be visible, and a stage sitting at stock is the case that
  // makes it hard: a leg wakes 2% of what rests, so a ten-control card left at
  // stock would answer the switch by doing nothing for a minute and a half. The
  // first leg wakes the whole scope instead — `mutateGroup`'s rule, for
  // `mutateGroup`'s reason — and only the first.
  it('moves a stage sitting at stock on the press, not a minute later', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.add(FIRST)

    // Most of it rather than all of it: a mode select steps by 1, so a gentle
    // jitter on one snaps back to the mode it was already on.
    const woke = (from: Controls, to: Controls) =>
      FIRST.sliders.filter(s => to[s.key] !== from[s.key]).length
    const first = b.legs[0]
    expect(woke(DEFAULT_CONTROLS, first)).toBeGreaterThan(
      FIRST.sliders.length / 2,
    )

    // The second leg is a wander again, and leaves alone most of what the first
    // one has not already moved.
    vi.advanceTimersByTime(DRIFT_SECONDS * 1000)
    expect(woke(first, b.legs[1])).toBeLessThan(woke(DEFAULT_CONTROLS, first))

    drift.stop()
    vi.useRealTimers()
  })

  // One clock, not one per switch. Two timers would land two morphs a few
  // seconds apart and each would cut the other short, which is the thing
  // DRIFT_ARRIVE is under 1 to prevent.
  it('fires one leg for however many stages are wandering', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.add(FIRST)
    drift.add(SECOND)
    expect(b.legs).toHaveLength(2)

    vi.advanceTimersByTime(DRIFT_SECONDS * 1000)
    expect(b.legs).toHaveLength(3)

    const landed = b.legs.at(-1)!
    for (const scope of [FIRST, SECOND]) {
      expect(
        scope.sliders.some(s => landed[s.key] !== DEFAULT_CONTROLS[s.key]),
        scope.name,
      ).toBe(true)
    }
    drift.stop()
    vi.useRealTimers()
  })

  // One control, one anchor. The board's switch takes over from every stage
  // switch, and a stage switch narrows a board drift down to that stage.
  it('takes over from every scope it overlaps', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.add(FIRST)
    drift.add(SECOND)
    drift.add(BOARD)
    expect(drift.running()).toEqual([DRIFT_BOARD])

    drift.add(FIRST)
    expect(drift.running()).toEqual([FIRST.name])
    drift.stop()
    vi.useRealTimers()
  })

  // A stage switched off stays where it got to while the others carry on, and
  // the clock only goes with the last one out.
  it('stops one stage without stopping the rest', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.add(FIRST)
    drift.add(SECOND)
    drift.remove(FIRST.name)
    expect(drift.running()).toEqual([SECOND.name])

    const before = b.legs.length
    vi.advanceTimersByTime(DRIFT_SECONDS * 1000)
    expect(b.legs).toHaveLength(before + 1)

    const landed = b.legs.at(-1)!
    const parked = b.legs[before - 1]
    for (const s of FIRST.sliders)
      expect(landed[s.key], s.key).toBe(parked[s.key])

    drift.remove(SECOND.name)
    vi.advanceTimersByTime(DRIFT_SECONDS * 1000 * 3)
    expect(b.legs).toHaveLength(before + 1)
    vi.useRealTimers()
  })
})

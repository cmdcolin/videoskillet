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
import { MUTATE_SLIDERS } from './controls'
import {
  DRIFT_AMOUNT,
  DRIFT_SECONDS,
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
  it('settles into a neighbourhood where a free nudge runs away', () => {
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
  })

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
        sliders: SLIDERS,
        rand: rngFor(9),
      },
    }
  }

  it('fires the first leg on the press, then one a period', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.start()

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
    makeDrift(b.deps).start()

    expect(b.legs[0].seconds).toBe(driftLegSeconds(DRIFT_SECONDS))
    vi.useRealTimers()
  })

  it('rolls each leg off where the last one was headed', () => {
    vi.useFakeTimers()
    const b = board()
    const drift = makeDrift(b.deps)
    drift.start()
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
    drift.start()

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
    drift.start()
    drift.start()
    vi.advanceTimersByTime(DRIFT_SECONDS * 1000)

    expect(b.legs).toHaveLength(2)
    drift.stop()
    vi.useRealTimers()
  })
})

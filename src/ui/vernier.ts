// The minor-adjustment card's arithmetic, in its two modes.
//
// Cents (`vernier: true`) reads a control's value between the notches of its
// own step grid. The loop's geometry is what needs one. `fbZoom` steps by 0.001
// and its curve is solved so a notch of track near ×1 is worth exactly that (see
// curve.ts), which is the right coarseness for finding a tunnel and too coarse
// for settling one: a thousandth of zoom is the difference between a spiral
// that unwinds over a second and one that unwinds over ten, and the interesting
// offsets are smaller again. So the row keeps its step — the shared readout
// column and the curve are both sized off it — and this splits the stored value
// into that grid plus a remainder the card steers in hundredths.
//
// Both modes derive everything and store nothing. The control still holds one
// number, so a look, a link or a preset carries a trimmed value without knowing
// the card exists, and a row that has never been trimmed reads exactly as it
// always did.

import { clamp } from '../core/math'
import { snapToStep } from './controls'

export const CENTS_PER_STEP = 100

// The remainder runs [-50, +49] rather than symmetrically, because `snapToStep`
// rounds a half up: half a step above a notch already belongs to the next notch
// as -50. Every value therefore has exactly one (notch, cents) reading and none
// sits on a tie — which is what stops the card's thumb from teleporting stop to
// stop mid-drag as the notch it is measured against ticks over.
export const CENT_MIN = -CENTS_PER_STEP / 2
export const CENT_MAX = CENTS_PER_STEP / 2 - 1

export interface VernierSpan {
  min: number
  max: number
  step: number
}

// One cent of the control, in the control's own units.
export const centOf = (span: VernierSpan) => span.step / CENTS_PER_STEP

// The notch of the control's own grid a value belongs to — where the row's
// track and its readout both put it.
export const notchOf = (span: VernierSpan, value: number) =>
  snapToStep(span, value)

// How far past that notch the value sits. Clamped as well as rounded: at the
// ends of the control `notchOf` clamps too, and float dust on a remainder that
// is already half a step would otherwise read as a 50th cent the card has no
// position for.
export const centsOf = (span: VernierSpan, value: number) =>
  Math.min(
    CENT_MAX,
    Math.max(
      CENT_MIN,
      Math.round((value - notchOf(span, value)) / centOf(span)),
    ),
  )

// The same notch carrying a different remainder, landed on the cent grid and
// inside the control's range.
export const atCents = (span: VernierSpan, value: number, cents: number) =>
  snapToStep(
    { ...span, step: centOf(span) },
    notchOf(span, value) + cents * centOf(span),
  )

// Window (`vernier: { span }`) is for a linear or geometric track, where a
// pixel of the row is hundreds of steps and the step itself is already fine
// enough. A pixel of `cfbDelayUs` on the docked panel is about 0.2 µs, over
// half a turn of hue, and one step is a nanosecond. The card spreads `span` of
// the control across its track at the control's own step, or at a finer one the
// definition names. Ghost delay steps by 50 ns, 64° of the ghost's hue, so its
// card walks in nanoseconds. A finer step has to be whole hundredths of the
// row's, which is the finest the wire carries (packed.ts).
//
// The window centres on the value, pushed inside the control's range so the
// card's whole width always reaches something. The card recentres when it opens
// and when the value leaves the window from elsewhere; a drag on the card keeps
// the window still, which keeps the thumb under the pointer.

export interface VernierWindow extends VernierSpan {
  span: number
}

export const centreOf = (w: VernierWindow, value: number) =>
  snapToStep(w, clamp(value, w.min + w.span / 2, w.max - w.span / 2))

// Steps either side of the centre.
export const reachOf = (w: VernierWindow) => Math.round(w.span / 2 / w.step)

export const offsetOf = (w: VernierWindow, centre: number, value: number) =>
  Math.round((value - centre) / w.step)

export const atOffset = (w: VernierWindow, centre: number, steps: number) =>
  snapToStep(w, centre + steps * w.step)

export const holds = (w: VernierWindow, centre: number, value: number) =>
  Math.abs(offsetOf(w, centre, value)) <= reachOf(w)

import { snapToStep } from './controls'

import type { SliderDef } from './controls'

// Reading a palette query as a control and a setting for it: "noise 9".
//
// The arrow keys in the palette nudge, and nudging is the wrong gesture for
// arriving somewhere — 0 to 9 IRE is thirty presses, and an exact value asked
// for by name is the one thing the panel behind the palette is slower at than
// typing. It is also the whole of what a browsing agent can do here: it types
// into a box and reads the list back, and clicking a track at the right x is a
// thing it cannot aim.
//
// Its own module rather than the component's private half, because what is easy
// to get wrong here is the reading — which queries split, what a tail means on a
// mode switch, what an out-of-range number does — and a dialog is an expensive
// place to find that out.

// The query's last word, held apart from what the search runs on. Split only on
// a real space, so a one-word query behaves exactly as it did before any of this
// existed.
export function splitTail(q: string): { head: string; tail: string } {
  const at = q.lastIndexOf(' ')
  return at < 0
    ? { head: q, tail: '' }
    : { head: q.slice(0, at).trim(), tail: q.slice(at + 1) }
}

// Where the tail sends one control, or null when it says nothing about it.
//
// A number lands on the control's own step grid, and `snapToStep` clamps, so an
// out-of-range ask arrives at the end of the track rather than being refused —
// the same thing dragging past the end does.
//
// On a mode switch a prefix of an option name picks it, which is the only way
// "synth mix ring" means anything: those controls read as words on the panel and
// nobody knows that ring modulation is 2.
export function tailTarget(s: SliderDef, tail: string): number | null {
  if (tail === '') return null
  if (/^-?\d+(\.\d+)?$/.test(tail)) return snapToStep(s, Number(tail))
  if (s.choices === undefined) return null
  const i = s.choices.findIndex(c => c.toLowerCase().startsWith(tail))
  return i < 0 ? null : i
}

// When the mixer loop's frame store (`compPrev`, written by `storePrev`)
// records, and which fill the keyer reads. The store is a frame synchronizer:
// the loop fader reads it, and so does the keyer when its fill is patched to
// the loop bus or to freeze.
//
// - Plain recording runs while something reads a live store: the loop fader up,
//   or the keyer cutting with the loop bus as its fill. `cfbHold` strobes both
//   by skipping frames, and trails force an even period so every capture shares
//   one subcarrier frame parity.
// - Freeze is the synchronizer's freeze button. The store records the program
//   on the frame freeze is selected and holds it from then on, whatever the
//   loop fader and the strobe are set to. On that frame the keyer still shows
//   the fill selected before, so going to freeze from the loop bus keeps the
//   trails, and going from program A holds A with the subject keyed over it.
// - Until the page's own link has loaded, freeze holds nothing: the store
//   records every frame keyed over program A. A page opened from a link with
//   freeze set would otherwise hold its first frames, which show colour bars,
//   or black while a cued clip seeks to its in-point. Once the link has
//   settled, freeze holds the last frame recorded, and a source picked by hand
//   leaves it alone, so a frozen picture can sit behind whatever is keyed in
//   next.

import { bOn } from './feedgates'

import type { Controls } from '../controls'

export type KeyFill = 'program' | 'matte' | 'loop' | 'freeze'

export const KEY_FILLS: readonly KeyFill[] = [
  'program',
  'matte',
  'loop',
  'freeze',
]

const FREEZE = KEY_FILLS.indexOf('freeze')

// The fill the keyer is cutting to this frame, or null when the keyer is out of
// circuit: mix_b reads a fill only on the genlocked path, with the key on, in a
// frame that dispatches the B chain at all.
export function keyFillOf(c: Controls, bEnabled: boolean): KeyFill | null {
  if (!bOn(c, bEnabled) || c.bGenlock <= 0.5 || c.bKey === 0) return null
  return KEY_FILLS[Math.round(c.bKeyFill)] ?? 'program'
}

export function strobePeriod(c: Controls): number {
  return c.cfbTrail > 0
    ? 2 * Math.ceil((c.cfbHold + 1) / 2)
    : Math.round(c.cfbHold) + 1
}

export interface StoreFrame {
  // Whether `storePrev` writes this frame.
  records: boolean
  // The `bKeyFill` value mix_b reads this frame.
  fill: number
}

// Frames a settled link must stay quiet before freeze holds: about a second,
// which covers the frame a video has finished seeking to reaching the program.
const QUIET_FRAMES = 60

export class FrameStore {
  private frozen = false
  private before = 0
  private settling = false
  private quiet = 0
  // Whether freeze still tracks the program: true until the page's link has
  // settled. A reset keeps it.
  loading: boolean

  constructor(loading = true) {
    this.loading = loading
  }

  // The page's link has finished loading. A clip it named may still be waiting
  // on its first frame or seeking to a cue, so freeze starts holding once
  // `step` has been told neither is happening for `QUIET_FRAMES` in a row.
  settle(): void {
    this.settling = true
  }

  // Call once per frame. `busy` says a source slot is still waiting on its
  // first frame or seeking.
  step(
    c: Controls,
    bEnabled: boolean,
    frame: number,
    busy = false,
  ): StoreFrame {
    this.quiet = busy ? 0 : this.quiet + 1
    if (this.settling && this.quiet >= QUIET_FRAMES) {
      this.loading = false
      this.settling = false
    }
    const fill = keyFillOf(c, bEnabled)
    const entering = fill === 'freeze' && !this.frozen
    this.frozen = fill === 'freeze'
    if (this.frozen) {
      if (this.loading) return { records: true, fill: 0 }
      return {
        records: entering,
        fill: entering ? this.before : FREEZE,
      }
    }
    this.before = Math.round(c.bKeyFill) === FREEZE ? 0 : c.bKeyFill
    return {
      records:
        (c.cfbMix !== 0 || fill === 'loop') && frame % strobePeriod(c) === 0,
      fill: c.bKeyFill,
    }
  }
}

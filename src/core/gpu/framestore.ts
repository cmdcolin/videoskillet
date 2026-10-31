// When the mixer loop's frame store (`compPrev`, written by `storePrev`)
// records, and which fill the keyer reads. The store is a frame synchronizer:
// the loop fader reads it, and so do the keyer and the character generator when
// their fill is patched to the loop bus (the keyer also to freeze).
//
// - Plain recording runs while something reads a live store: the loop fader up,
//   or the keyer or the character generator cutting with the loop bus as its
//   fill. `cfbHold` strobes both
//   by skipping frames, and trails force an even period so every capture shares
//   one subcarrier frame parity.
// - Freeze is the synchronizer's freeze button. The store records the program
//   on the frame freeze is selected and holds it from then on, whatever the
//   loop fader and the strobe are set to. On that frame the keyer still shows
//   the fill selected before, so going to freeze from the loop bus keeps the
//   trails, and going from program A holds A with the subject keyed over it.
// - Until the page's own link has loaded, freeze and the loop bus hold
//   nothing: the store records every frame keyed over program A. A page opened
//   from a link with either set would otherwise hold its first frames, which
//   show colour bars, or black while a cued clip seeks to its in-point. Once
//   the link has settled, freeze holds the last frame recorded and the loop bus
//   builds its trails over it, and a source picked by hand leaves it alone, so
//   a frozen picture can sit behind whatever is keyed in next.
// - The character generator's bus fill is always colour framed. Its fill input
//   is a switcher input, and a frame sync that fed one out of colour frame
//   could not be timed into the switcher at all.

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

const chyronReadsBus = (c: Controls) => c.cgMix > 0 && c.cgFillFrom > 0.5

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
  // Whether colour framing inverts the store's chroma this frame: it is on, and
  // the store was last written on the other subcarrier phase.
  flip: boolean
  // The `cgBus` value chyron reads: 0 its own characters, 1 the bus while the
  // store still tracks program, 2 the bus once the store holds.
  cgBus: number
  // The character generator's colour framing, which is always on.
  cgFlip: boolean
}

// Frames a settled link must stay quiet before freeze holds: about a second,
// which covers the frame a video has finished seeking to reaching the program.
const QUIET_FRAMES = 60

export class FrameStore {
  private frozen = false
  private before = 0
  private settling = false
  private quiet = 0
  private writtenAt = 0
  // Whether freeze and the loop bus still track the program: true until the page's link has
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

  // A fresh store for a reset, which keeps whether the link has loaded and a
  // settle still counting down. Dropping the second left a reset in that window
  // tracking the program until the page reloaded.
  restart(): FrameStore {
    const next = new FrameStore(this.loading)
    next.settling = this.settling
    return next
  }

  // Call once per frame. `busy` says a source slot is still waiting on its
  // first frame or seeking.
  step(
    c: Controls,
    bEnabled: boolean,
    frame: number,
    busy = false,
  ): StoreFrame {
    const at = this.decide(c, bEnabled, frame, busy)
    const otherPhase = (frame - this.writtenAt) % 2 !== 0
    const flip = c.bKeyFillFraming > 0.5 && at.fill > 1.5 && otherPhase
    const bus = chyronReadsBus(c)
    if (at.records) this.writtenAt = frame
    return {
      ...at,
      flip,
      cgBus: bus ? (this.loading ? 1 : 2) : 0,
      cgFlip: bus && otherPhase,
    }
  }

  private decide(
    c: Controls,
    bEnabled: boolean,
    frame: number,
    busy: boolean,
  ): Pick<StoreFrame, 'records' | 'fill'> {
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
    // On the strobe period while loading as well, so trails peak-hold captures of
    // one subcarrier parity from the start.
    if (this.loading && fill === 'loop')
      return { records: frame % strobePeriod(c) === 0, fill: 0 }
    return {
      records:
        (c.cfbMix !== 0 || fill === 'loop' || chyronReadsBus(c)) &&
        frame % strobePeriod(c) === 0,
      fill: c.bKeyFill,
    }
  }
}

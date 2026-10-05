// A deck's on-screen display: the word it draws over the output when the
// transport moves, and takes down again a few seconds later.
//
// The label follows the tape speed. Play, pause and slow motion are the three
// states a deck names with a word; anything faster or backwards is its search
// mode. The same state also decides when to show it: a change of speed, or the
// display being switched on, starts the hold.

export const OSD_PLAY = 0
export const OSD_PAUSE = 1
export const OSD_SLOW = 2
export const OSD_FF = 3
export const OSD_REW = 4

export function osdLabel(shuttleX: number): number {
  if (shuttleX === 1) return OSD_PLAY
  if (shuttleX === 0) return OSD_PAUSE
  if (shuttleX > 1) return OSD_FF
  if (shuttleX < 0) return OSD_REW
  return OSD_SLOW
}

export interface OsdStep {
  label: number
  visible: boolean
}

export class OsdState {
  private lastShuttle = 1
  private wasOn = false
  private shownAt = Number.NEGATIVE_INFINITY

  step(on: boolean, shuttleX: number, holdS: number, nowMs: number): OsdStep {
    if ((on && !this.wasOn) || shuttleX !== this.lastShuttle) {
      this.shownAt = nowMs
    }
    this.wasOn = on
    this.lastShuttle = shuttleX
    return {
      label: osdLabel(shuttleX),
      visible: on && nowMs - this.shownAt < holdS * 1000,
    }
  }

  reset(shuttleX: number): void {
    this.lastShuttle = shuttleX
    this.wasOn = false
    this.shownAt = Number.NEGATIVE_INFINITY
  }
}

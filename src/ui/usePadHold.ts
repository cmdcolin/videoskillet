import { useState } from 'react'

import type { MouseEvent, PointerEvent } from 'react'

// Fires the fault, held or not, and returns its release.
type Start = (held: boolean) => (() => void) | undefined

// What a fault pad's presses mean, split out of the hook so it has a test. A
// pointer down breaks the picture and keeps it broken until that pointer comes
// up, so a quick tap still runs the whole fault. A click with no press before
// it, from the keyboard or a screen reader, runs the fault as a tap.
export class PadPresses {
  private releases = new Map<number, () => void>()
  private pressed = false

  down(id: number, start: Start): void {
    const release = start(true)
    if (release !== undefined) this.releases.set(id, release)
  }

  up(id: number): void {
    if (this.releases.has(id)) this.pressed = true
    this.cancel(id)
  }

  cancel(id: number): void {
    this.releases.get(id)?.()
    this.releases.delete(id)
  }

  click(start: Start): void {
    if (this.pressed) this.pressed = false
    else start(false)
  }
}

export function usePadHold() {
  const [presses] = useState(() => new PadPresses())
  return (start: Start) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      presses.down(e.pointerId, start)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => presses.up(e.pointerId),
    onPointerCancel: (e: PointerEvent<HTMLElement>) =>
      presses.cancel(e.pointerId),
    onClick: () => presses.click(start),
    onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
  })
}

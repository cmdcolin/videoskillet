import { useRef } from 'react'

import type { MouseEvent, PointerEvent } from 'react'

// A fault pad's button: a press breaks the picture and keeps it broken while
// the pointer stays down, and lifting heals it. A quick tap runs the whole
// fault, so the pad still works as a one-shot. A click with no press before
// it, from the keyboard or a screen reader, runs the fault as a tap.
//
// `start` fires the fault, held or not, and returns its release.
export function usePadHold() {
  const releases = useRef(new Map<number, () => void>())
  const pressed = useRef(false)

  const lift = (e: PointerEvent<HTMLElement>) => {
    releases.current.get(e.pointerId)?.()
    releases.current.delete(e.pointerId)
  }

  return (start: (held: boolean) => (() => void) | undefined) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const release = start(true)
      if (release !== undefined) releases.current.set(e.pointerId, release)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (releases.current.has(e.pointerId)) pressed.current = true
      lift(e)
    },
    onPointerCancel: lift,
    onClick: () => {
      if (pressed.current) pressed.current = false
      else start(false)
    },
    onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
  })
}

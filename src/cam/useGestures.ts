import { useRef } from 'react'

import type { PointerEvent } from 'react'

// A press becomes the original after it has been held this long, so a swipe or
// a tap never flashes it.
const HOLD_MS = 180
const SWIPE_PX = 40
const TAP_PX = 10

interface Gesture {
  id: number
  x: number
  y: number
  timer: number
  kind: 'pending' | 'compare' | 'swipe'
}

interface Pinch {
  span: number
  zoom: number
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

// What a finger does on the picture: a hold shows the original, a sideways
// swipe steps the look, two fingers pinch the zoom and a short press taps.
export function useGestures(opts: {
  zoom: { zoom: number; set: (zoom: number) => void }
  onPress: () => void
  onCompare: (on: boolean) => void
  onSwipe: (dir: 1 | -1) => void
  onTap: (e: PointerEvent<HTMLCanvasElement>) => void
}) {
  const gesture = useRef<Gesture | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<Pinch | null>(null)

  // A second finger turns whatever the first one started into a pinch.
  const press = (e: PointerEvent<HTMLCanvasElement>) => {
    opts.onPress()
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const g = gesture.current
      if (g !== null) {
        window.clearTimeout(g.timer)
        if (g.kind === 'compare') opts.onCompare(false)
        gesture.current = null
      }
      const [a, b] = [...pointers.current.values()]
      pinch.current = { span: dist(a, b), zoom: opts.zoom.zoom }
      return
    }
    if (pointers.current.size > 2) return
    const timer = window.setTimeout(() => {
      const g = gesture.current
      if (g !== null && g.kind === 'pending') {
        g.kind = 'compare'
        opts.onCompare(true)
      }
    }, HOLD_MS)
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      timer,
      kind: 'pending',
    }
  }

  const drag = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = pinch.current
    if (p !== null && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      opts.zoom.set((p.zoom * dist(a, b)) / Math.max(p.span, 1))
      return
    }
    const g = gesture.current
    if (g === null || g.id !== e.pointerId || g.kind !== 'pending') return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      window.clearTimeout(g.timer)
      g.kind = 'swipe'
      opts.onSwipe(dx < 0 ? 1 : -1)
    }
  }

  const release =
    (cancelled: boolean) => (e: PointerEvent<HTMLCanvasElement>) => {
      pointers.current.delete(e.pointerId)
      if (pointers.current.size < 2) pinch.current = null
      const g = gesture.current
      if (g === null || g.id !== e.pointerId) return
      window.clearTimeout(g.timer)
      gesture.current = null
      if (g.kind === 'compare') {
        opts.onCompare(false)
      } else if (
        !cancelled &&
        g.kind === 'pending' &&
        Math.hypot(e.clientX - g.x, e.clientY - g.y) < TAP_PX
      ) {
        opts.onTap(e)
      }
    }

  return { press, drag, release }
}

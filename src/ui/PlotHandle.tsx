import styles from './PlotHandle.module.css'

import type { KeyboardEvent, PointerEvent } from 'react'

// The pointer in the drawing's own units.
const at = (e: PointerEvent<SVGCircleElement>) => {
  const to = e.currentTarget.ownerSVGElement!.getScreenCTM()!.inverse()
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(to)
  return { x: pt.x, y: pt.y }
}

// A point on a plot that the pointer drags. `onMove` gets the pointer in the
// drawing's own units; the arrow keys call `onNudge` with the direction.
export function PlotHandle({
  x,
  y,
  label,
  reading,
  onGrab,
  onMove,
  onNudge,
}: {
  x: number
  y: number
  label: string
  reading: string
  onGrab: () => void
  onMove: (at: { x: number; y: number }) => void
  onNudge: (dx: number, dy: number) => void
}) {
  const key = (e: KeyboardEvent<SVGCircleElement>) => {
    const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    const dy = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
    if (dx === 0 && dy === 0) return
    e.preventDefault()
    onGrab()
    onNudge(dx, dy)
  }
  return (
    <>
      <circle
        cx={x}
        cy={y}
        r={9}
        className={styles.hit}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuetext={reading}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          onGrab()
          onMove(at(e))
        }}
        onPointerMove={e => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) onMove(at(e))
        }}
        onKeyDown={key}
      >
        <title>{`${label} — drag, or use the arrow keys`}</title>
      </circle>
      <circle cx={x} cy={y} r={3.5} className={styles.knob} />
    </>
  )
}

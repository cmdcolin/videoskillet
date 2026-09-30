import { useRef } from 'react'

import { clamp01 } from '../core/math'
import { cx } from '../ui/cx'
import styles from './cam.module.css'

import type { CSSProperties, ReactNode } from 'react'

// How far a finger travels before a press is a drag, and how far a drag runs
// the weight from nothing to all of it.
const SLOP = 6
const FULL = 90

// A chip on the strip. A tap puts its look up; a drag up mixes it in partway,
// the way the app's preset chips mix on a sideways drag. Up rather than
// sideways, since sideways scrolls the strip. The chip fills to its weight.
export function LookChip(props: {
  name: string
  label: string
  up: boolean
  weight: number
  children?: ReactNode
  onPick: () => void
  onWeigh: (weight: number) => void
}) {
  // Gesture bookkeeping only. `last` is null until the press has gone far
  // enough up or down to be a drag; a press that goes sideways first is the
  // strip's to scroll.
  const drag = useRef<{
    id: number
    x: number
    y: number
    w: number
    last: number | null
  } | null>(null)
  const dragged = useRef(false)
  const fill: CSSProperties & Record<'--w', string> = {
    '--w': `${Math.round(props.weight * 100)}%`,
  }
  return (
    <button
      data-look={props.name}
      style={fill}
      className={cx(
        styles.chip,
        props.up && styles.chipOn,
        !props.up && props.weight > 0 && styles.chipMixed,
      )}
      aria-pressed={props.up}
      title="tap to put this look up, drag up to mix it in partway"
      onPointerDown={e => {
        drag.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          w: props.weight,
          last: null,
        }
        dragged.current = false
      }}
      onPointerMove={e => {
        const d = drag.current
        if (d === null || d.id !== e.pointerId) return
        if (d.last === null) {
          const dy = d.y - e.clientY
          if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(e.clientX - d.x)) {
            d.last = e.clientY
            dragged.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          return
        }
        d.w = clamp01(d.w + (d.last - e.clientY) / FULL)
        d.last = e.clientY
        props.onWeigh(d.w)
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onClick={() => {
        if (dragged.current) dragged.current = false
        else props.onPick()
      }}
    >
      {props.label}
      {props.children}
    </button>
  )
}

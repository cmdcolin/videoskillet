import { useState, type PointerEvent } from 'react'

import { Label } from './DiagramParts'
import styles from './PlotProbe.module.css'

export interface Reading {
  /** Where the crosshair stands, in drawing units. */
  x: number
  /** Where the trace is under it, when the plot has one. */
  y?: number
  text: string
}

// A crosshair that follows the pointer across a plot, with the figure the
// trace has there. `read` takes how far along the plot the pointer is, 0 to 1.
export function PlotProbe({
  left,
  right,
  top,
  bottom,
  read,
}: {
  left: number
  right: number
  top: number
  bottom: number
  read: (along: number) => Reading
}) {
  const [along, setAlong] = useState<number | null>(null)
  const reading = along === null ? null : read(along)
  const track = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    setAlong(Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1))
  }
  const rightHalf = reading !== null && reading.x > (left + right) / 2
  return (
    <>
      <rect
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        className={styles.catch}
        onPointerDown={track}
        onPointerMove={track}
        onPointerLeave={() => setAlong(null)}
        onPointerCancel={() => setAlong(null)}
      />
      {reading && (
        <g className={styles.reading}>
          <line
            x1={reading.x}
            x2={reading.x}
            y1={top}
            y2={bottom}
            className={styles.cross}
          />
          {reading.y !== undefined && (
            <circle
              cx={reading.x}
              cy={reading.y}
              r={2.2}
              className={styles.dot}
            />
          )}
          <Label
            x={reading.x + (rightHalf ? -4 : 4)}
            y={top + 9}
            anchor={rightHalf ? 'end' : 'start'}
            on
          >
            {reading.text}
          </Label>
        </g>
      )}
    </>
  )
}

import { LINES } from '../core/signal/constants'
import styles from './Diagram.module.css'
import { Label } from './DiagramParts'

import type { Band } from './cableModel'
import type { ReactNode } from 'react'

export function BandLane({
  x0,
  x1,
  top,
  bottom,
  bands,
  className,
}: {
  x0: number
  x1: number
  top: number
  bottom: number
  bands: readonly Band[]
  className: string
}) {
  const rowY = (row: number) => top + ((bottom - top) * row) / LINES
  return bands.map(b => (
    <rect
      key={b.row}
      x={x0}
      y={rowY(b.row)}
      width={x1 - x0}
      height={Math.max(rowY(b.rows) - rowY(0), 1)}
      className={className}
    />
  ))
}

export interface RasterLane {
  name: string
  /** Where the lane runs across the frame, as fractions of its width. */
  span: readonly [number, number]
  on: boolean
  /** Sets of bands down the lane, one class to a set. */
  layers: readonly { bands: readonly Band[]; className: string }[]
}

// A frame of the picture drawn as a box, with lanes down it that mark the
// bands of lines a fault reaches, each named underneath.
export function RasterPanel({
  left,
  right,
  top,
  bottom,
  title,
  lanes,
  children,
}: {
  left: number
  right: number
  top: number
  bottom: number
  title: string
  lanes: readonly RasterLane[]
  children?: ReactNode
}) {
  const x = (f: number) => left + (right - left) * f
  return (
    <>
      <Label x={left} y={top - 6}>
        {title}
      </Label>
      <rect
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        className={styles.frame}
      />
      {lanes.map(lane =>
        lane.layers.map(layer => (
          <BandLane
            key={`${lane.name} ${layer.className}`}
            x0={x(lane.span[0])}
            x1={x(lane.span[1])}
            top={top}
            bottom={bottom}
            bands={layer.bands}
            className={layer.className}
          />
        )),
      )}
      {children}
      {lanes.map(lane => (
        <Label
          key={lane.name}
          x={(x(lane.span[0]) + x(lane.span[1])) / 2}
          y={bottom + 11}
          anchor="middle"
          on={lane.on}
        >
          {lane.name}
        </Label>
      ))}
    </>
  )
}

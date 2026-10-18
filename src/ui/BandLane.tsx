import { LINES } from '../core/signal/constants'

import type { Band } from './cableModel'

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

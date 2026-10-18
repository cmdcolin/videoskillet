import { LINES } from '../core/signal/constants'

import type { Band } from './cableModel'

// mix_b.wgsl takes B's clock error as a straight run from the top of the frame
// to the bottom. The worst the wander can do is swing from one end of its reach
// to the other, which is the tilt drawn here.
export function driftAcrossFrame(reachUs: number, points: number): number[] {
  return Array.from(
    { length: points },
    (_, i) => reachUs * (1 - (2 * i) / (points - 1)),
  )
}

// The rows where that error is past the genlock's capture range and B is left
// on its own clock.
export function lostRows(reachUs: number, captureUs: number): Band[] {
  const bands: Band[] = []
  let from: number | null = null
  for (let row = 0; row <= LINES; row++) {
    const error = reachUs * (1 - (2 * row) / LINES)
    const lost = row < LINES && Math.abs(error) > captureUs
    if (lost && from === null) from = row
    if (!lost && from !== null) {
      bands.push({ row: from, rows: row - from })
      from = null
    }
  }
  return bands
}

// The relay switches the bus to B for this fraction of the frame, counted back
// from the bottom.
export function cutRows(cut: number): Band[] {
  const fraction = Math.min(Math.max(cut, 0), 1)
  return fraction > 0
    ? [{ row: LINES * (1 - fraction), rows: LINES * fraction }]
    : []
}

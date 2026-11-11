// An S-video to composite adapter's chroma capacitor, in series with the luma
// of a lead wired as the mirror image of its plug.

import { SAMPLE_RATE } from './constants'

// The feed sums the capacitor's charge over this many samples back.
export const SERIES_CAP_REACH = 64

// The lowest corner whose step response decays to 2% inside that sum.
export const SERIES_CAP_FLOOR_MHZ =
  (SAMPLE_RATE * 4) / (2 * Math.PI * SERIES_CAP_REACH * 1e6)

// The Y and C drivers load each other at the adapter, each through 75 Ω.
export const SERIES_CAP_LOAD = 2 / 3

// What the charge holds from one sample to the next. Zero is a wire.
export function seriesCapHold(cornerMHz: number) {
  return cornerMHz > 0
    ? Math.exp(
        (-2 * Math.PI * Math.max(cornerMHz, SERIES_CAP_FLOOR_MHZ) * 1e6) /
          SAMPLE_RATE,
      )
    : 0
}

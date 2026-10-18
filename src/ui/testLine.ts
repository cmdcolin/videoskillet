import {
  ACTIVE_START,
  ACTIVE_WIDTH,
  BURST_AMP_IRE,
  BURST_LEN,
  BURST_START,
  IRE_BLACK,
  IRE_BLANK,
  IRE_SYNC,
  IRE_WHITE,
  SAMPLE_RATE,
  SAMPLES_PER_LINE,
  SYNC_LEN,
  usToSamples,
} from '../core/signal/constants'

export const LINE_US = (SAMPLES_PER_LINE / SAMPLE_RATE) * 1e6

/** The white bar on the test line, in µs from the sync edge. */
export const BAR_US = [20, 32] as const

const BAR = BAR_US.map(us => Math.round(usToSamples(us)))

/** Where the active picture starts and ends, as fractions of the line. */
export const PICTURE_BAND = [
  ACTIVE_START / SAMPLES_PER_LINE,
  (ACTIVE_START + ACTIVE_WIDTH) / SAMPLES_PER_LINE,
] as const

// One picture line as ntscLineSlot in prelude.ts lays it out, with burst on
// the 4fsc sample grid and a black picture crossed by one white bar.
function level(s: number) {
  if (s < SYNC_LEN) return IRE_SYNC
  if (s >= BURST_START && s < BURST_START + BURST_LEN) {
    return -BURST_AMP_IRE * Math.cos((Math.PI * s) / 2)
  }
  if (s < ACTIVE_START || s >= ACTIVE_START + ACTIVE_WIDTH) return IRE_BLANK
  return s >= BAR[0]! && s < BAR[1]! ? IRE_WHITE : IRE_BLACK
}

export const TEST_LINE: readonly number[] = Array.from(
  { length: SAMPLES_PER_LINE },
  (_, s) => level(s),
)

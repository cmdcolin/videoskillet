// Holding one stage at stock is a patch, not a bypass: the passes still run and
// the rest of the look has to come through untouched. What that costs is
// getting the key set right — one stage's controls, all of them, and nobody
// else's.

import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import {
  CHANNEL_STAGE,
  MOD_STAGE,
  SOURCE_A_STAGE,
  stageGroups,
} from './controls'
import { holdable, stockIn } from './stageStock'

const firstKeyIn = (stage: string) => stageGroups(stage)[0].sliders[0].key

describe('a stage held at stock', () => {
  const inChannel = firstKeyIn(CHANNEL_STAGE)
  const elsewhere = firstKeyIn(SOURCE_A_STAGE)
  const dialed = {
    ...DEFAULT_CONTROLS,
    [inChannel]: DEFAULT_CONTROLS[inChannel] + 1,
    [elsewhere]: DEFAULT_CONTROLS[elsewhere] + 1,
  }

  it('puts that stage’s controls back', () => {
    expect(stockIn(dialed, CHANNEL_STAGE)[inChannel]).toBe(
      DEFAULT_CONTROLS[inChannel],
    )
  })

  it('leaves the rest of the look where it was', () => {
    expect(stockIn(dialed, CHANNEL_STAGE)[elsewhere]).toBe(dialed[elsewhere])
  })

  it('reaches every group in the stage, not just the first', () => {
    const keys = stageGroups(CHANNEL_STAGE).flatMap(g =>
      g.sliders.map(s => s.key),
    )
    const moved = Object.fromEntries(
      keys.map(k => [k, DEFAULT_CONTROLS[k] + 1]),
    )
    const held = stockIn({ ...DEFAULT_CONTROLS, ...moved }, CHANNEL_STAGE)
    expect(keys.filter(k => held[k] !== DEFAULT_CONTROLS[k])).toEqual([])
  })

  it('hands back a copy, so the board it was asked about is untouched', () => {
    stockIn(dialed, CHANNEL_STAGE)
    expect(dialed[inChannel]).not.toBe(DEFAULT_CONTROLS[inChannel])
  })
})

describe('which headings offer the hold', () => {
  it('every stage of the rig', () => {
    expect(holdable(CHANNEL_STAGE)).toBe(true)
    expect(holdable(SOURCE_A_STAGE)).toBe(true)
  })

  // The bay's rows are modulation slots rather than controls, so there is
  // nothing here to put back and a button would do nothing.
  it('not the boxes wired to nothing', () => {
    expect(holdable(MOD_STAGE)).toBe(false)
  })
})

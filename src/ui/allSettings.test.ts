import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import {
  ALL_SETTINGS_STAGES,
  offStockKeys,
  opensInPanel,
  restick,
  settingsIndex,
} from './allSettings'
import {
  ALL_SLIDERS,
  GROUPS,
  MIX_STAGE,
  SOURCE_A_STAGE,
  SYNTH_GROUP,
} from './controls'
import { groupOf, stageOf } from './placement'

import type { Group } from './controls'

const groupNamed = (name: string): Group => {
  const g = GROUPS.find(x => x.name === name)
  if (g === undefined) throw new Error(`no group ${name}`)
  return g
}

describe('settingsIndex', () => {
  it('lists every group once and every control once', () => {
    const index = settingsIndex(null)
    const groups = index.flatMap(s => s.groups.map(g => g.group.name))
    expect(groups.toSorted()).toEqual(GROUPS.map(g => g.name).toSorted())
    const keys = index.flatMap(s =>
      s.groups.flatMap(g => [...g.rows, ...g.fine].map(r => r.key)),
    )
    expect(keys.toSorted()).toEqual(ALL_SLIDERS.map(s => s.key).toSorted())
  })

  it('files each group under the stage the panel opens it in', () => {
    for (const stage of settingsIndex(null))
      for (const g of stage.groups) expect(stageOf(g.group)).toBe(stage.name)
  })

  it('keeps the stages in signal order, each once', () => {
    expect(new Set(ALL_SETTINGS_STAGES).size).toBe(ALL_SETTINGS_STAGES.length)
    expect(settingsIndex(null).map(s => s.name)).toEqual(ALL_SETTINGS_STAGES)
  })

  it('splits the fine trims from the rows the panel shows unfolded', () => {
    for (const stage of settingsIndex(null))
      for (const g of stage.groups) {
        expect(g.rows.every(s => s.fine !== true)).toBe(true)
        expect(g.fine.every(s => s.fine === true)).toBe(true)
      }
  })

  it('narrows to the given controls and drops what is left empty', () => {
    const fine = ALL_SLIDERS.find(s => s.fine === true)!
    const plain = ALL_SLIDERS.find(
      s =>
        s.fine !== true &&
        stageOf(groupOf(s.key)!) !== stageOf(groupOf(fine.key)!),
    )!
    const index = settingsIndex(new Set([fine.key, plain.key]))
    expect(index).toHaveLength(2)
    const rows = index.flatMap(s => s.groups.flatMap(g => g.rows))
    const trims = index.flatMap(s => s.groups.flatMap(g => g.fine))
    expect(rows.map(s => s.key)).toEqual([plain.key])
    expect(trims.map(s => s.key)).toEqual([fine.key])
  })

  it('lists nothing when nothing is off stock', () => {
    expect(settingsIndex(new Set())).toEqual([])
  })
})

describe('offStockKeys', () => {
  it('is empty at stock', () => {
    expect(offStockKeys(DEFAULT_CONTROLS)).toBe('')
  })

  it('names each control off stock, in signal order', () => {
    const [a, b] = [ALL_SLIDERS[3]!, ALL_SLIDERS[40]!]
    const board = {
      ...DEFAULT_CONTROLS,
      [b.key]: b.max,
      [a.key]: a.max === DEFAULT_CONTROLS[a.key] ? a.min : a.max,
    }
    expect(offStockKeys(board)).toBe(`${a.key} ${b.key}`)
  })
})

describe('restick', () => {
  const held = ['a', 'b', 'c']

  it('keeps a row dragged back to stock', () => {
    expect(restick(held, ['a', 'c'])).toBe(held)
  })

  it('takes the new list when a control arrives', () => {
    const now = ['a', 'd']
    expect(restick(held, now)).toBe(now)
  })

  it('empties when the whole board is back at stock', () => {
    const now: string[] = []
    expect(restick(held, now)).toBe(now)
  })
})

describe('opensInPanel', () => {
  const open = new Set([SOURCE_A_STAGE])
  const idle = { noise: false, synth: false }

  it('opens a group in a stage that opens', () => {
    const g = groupNamed('Signal (source A)')
    expect(opensInPanel(g, open, idle)).toBe(true)
  })

  it('does not open a stage with nothing patched in', () => {
    const g = GROUPS.find(x => stageOf(x) === MIX_STAGE)!
    expect(opensInPanel(g, open, idle)).toBe(false)
  })

  it('opens the chyron with nothing patched into B', () => {
    const g = groupNamed('Character generator (chyron)')
    expect(opensInPanel(g, open, idle)).toBe(true)
  })

  it('opens a generator group only while it runs', () => {
    const g = groupNamed(SYNTH_GROUP)
    expect(opensInPanel(g, open, idle)).toBe(false)
    expect(opensInPanel(g, open, { ...idle, synth: true })).toBe(true)
  })
})

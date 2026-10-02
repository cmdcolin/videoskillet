import { describe, expect, it } from 'vitest'

import { rngFor } from '../core/rng'
import { PRESET_BY_NAME, needsSourceB } from '../ui/presets'
import {
  DEFAULT_DICE,
  dicePool,
  parseDice,
  rollStack,
  rollTweaks,
} from './dice'
import { MIX_SHELF, SHELVES, lookBoard, lookKnobs, rollPool } from './looks'

const LOOPS = SHELVES[0]
const SCAN = SHELVES[3]

describe('dicePool', () => {
  it('rolls within the tab by default', () => {
    expect(dicePool(SCAN, 'tab', false)).toEqual(rollPool(SCAN))
  })

  it('reaches every tab, past the families the tab names', () => {
    const every = dicePool(SCAN, 'every tab', false)
    expect(every.length).toBeGreaterThan(rollPool(SCAN).length)
    for (const name of rollPool(SCAN)) expect(every).toContain(name)
  })

  it('leaves out the looks that need B until B has a picture', () => {
    const without = dicePool(LOOPS, 'every tab', false)
    const withB = dicePool(LOOPS, 'every tab', true)
    for (const name of without) {
      const def = PRESET_BY_NAME.get(name)
      expect(def !== undefined && needsSourceB(def), name).toBe(false)
    }
    for (const name of MIX_SHELF.looks) {
      expect(without).not.toContain(name)
      expect(withB).toContain(name)
    }
  })
})

describe('rollStack', () => {
  const pool = dicePool(SCAN, 'every tab', false)

  it('stacks one more look per step of amount', () => {
    for (const [amount, layers] of [
      ['gentle', 1],
      ['normal', 2],
      ['wild', 3],
    ] as const)
      expect(
        Object.keys(rollStack(null, pool, amount, rngFor(5)).layers),
      ).toHaveLength(layers)
  })

  it('never repeats a look or lands on the one that is up', () => {
    const current = { name: pool[0], strength: 1, rolled: false }
    for (let seed = 1; seed < 40; seed++) {
      const { look, layers } = rollStack(current, pool, 'wild', rngFor(seed))
      const names = [look.name, ...Object.keys(layers)]
      expect(new Set(names).size).toBe(names.length)
      expect(names).not.toContain(current.name)
      expect(look.rolled).toBe(true)
    }
  })

  it('weighs each layer between a quarter and three quarters', () => {
    for (let seed = 1; seed < 40; seed++)
      for (const w of Object.values(
        rollStack(null, pool, 'wild', rngFor(seed)).layers,
      )) {
        expect(w).toBeGreaterThanOrEqual(0.25)
        expect(w).toBeLessThanOrEqual(0.75)
      }
  })
})

describe('rollTweaks', () => {
  const look = { name: 'bentScan', strength: 1, rolled: false }
  const board = lookBoard(look).controls
  const knobs = lookKnobs(look)

  it('nudges knobs the look offers and no others', () => {
    const offered = new Set<string>(knobs.map(k => k.key))
    const tweaks = rollTweaks(board, {}, knobs, 'nudge', 'wild', rngFor(3))
    expect(Object.keys(tweaks).length).toBeGreaterThan(0)
    for (const key of Object.keys(tweaks)) expect(offered.has(key)).toBe(true)
  })

  it('throws as many knobs as the amount asks for', () => {
    for (const [amount, n] of [
      ['gentle', 1],
      ['normal', 2],
      ['wild', 4],
    ] as const)
      expect(
        Object.keys(rollTweaks(board, {}, knobs, 'throw', amount, rngFor(9))),
      ).toHaveLength(n)
  })

  it('keeps the tweaks the roll does not touch', () => {
    expect(knobs.some(k => k.key === 'wipePos')).toBe(false)
    const tweaks = rollTweaks(
      board,
      { wipePos: 0.3 },
      knobs,
      'throw',
      'gentle',
      rngFor(4),
    )
    expect(tweaks.wipePos).toBe(0.3)
    expect(Object.keys(tweaks)).toHaveLength(2)
  })
})

describe('parseDice', () => {
  it('keeps what it recognises', () => {
    const dice = { kind: 'throw', reach: 'every tab', amount: 'wild' }
    expect(parseDice(dice)).toEqual(dice)
  })

  it('falls back field by field on a stale or foreign value', () => {
    expect(parseDice({ kind: 'warp', amount: 'wild' })).toEqual({
      ...DEFAULT_DICE,
      amount: 'wild',
    })
    expect(parseDice(null)).toEqual(DEFAULT_DICE)
    expect(parseDice('x')).toEqual(DEFAULT_DICE)
  })
})

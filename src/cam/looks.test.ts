import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import {
  PRESET_BY_NAME,
  controlsEqual,
  needsSourceB,
  presetControls,
} from '../ui/presets'
import { CAM_LOOKS, lookBoard, lookLabel, rollLook } from './looks'

describe('the camera strip', () => {
  it('names only presets that exist', () => {
    for (const name of CAM_LOOKS)
      expect(PRESET_BY_NAME.has(name), name).toBe(true)
  })

  // The camera page has one source, so a look that mixes in a second one
  // would show the camera untouched.
  it('offers nothing that needs a second source', () => {
    for (const name of CAM_LOOKS) {
      const def = PRESET_BY_NAME.get(name)
      expect(def !== undefined && needsSourceB(def), name).toBe(false)
    }
  })

  it('lists each look once', () => {
    expect(new Set(CAM_LOOKS).size).toBe(CAM_LOOKS.length)
  })
})

describe('lookBoard', () => {
  it('lands a look at full strength as the preset itself', () => {
    for (const name of CAM_LOOKS) {
      const def = PRESET_BY_NAME.get(name)
      if (def === undefined) continue
      const { controls } = lookBoard({ name, strength: 1, rolled: false })
      expect(controlsEqual(controls, presetControls(def.patch)), name).toBe(
        true,
      )
    }
  })

  it('is stock with nothing moving for no look and for zero strength', () => {
    for (const look of [null, { name: 'vhs', strength: 0, rolled: false }]) {
      const board = lookBoard(look)
      expect(controlsEqual(board.controls, DEFAULT_CONTROLS)).toBe(true)
      expect(board.mod).toEqual([])
    }
  })

  it('carries a preset’s motion into the bay', () => {
    const moving = [...PRESET_BY_NAME.values()].find(
      p => p.mod !== undefined && p.mod.length > 0 && !needsSourceB(p),
    )
    expect(moving).toBeDefined()
    if (moving === undefined) return
    const { mod } = lookBoard({ name: moving.name, strength: 1, rolled: false })
    expect(mod.length).toBeGreaterThan(0)
  })
})

describe('rollLook', () => {
  it('never rolls the look already up, nor one that needs a second source', () => {
    let look = rollLook(null)
    for (let i = 0; i < 200; i++) {
      const next = rollLook(look)
      expect(next.name).not.toBe(look.name)
      const def = PRESET_BY_NAME.get(next.name)
      expect(def !== undefined && needsSourceB(def)).toBe(false)
      expect(next.rolled).toBe(true)
      look = next
    }
  })
})

it('calls no look normal', () => {
  expect(lookLabel(null)).toBe('normal')
  expect(lookLabel({ name: 'wornTape', strength: 1, rolled: false })).toBe(
    'worn tape',
  )
})

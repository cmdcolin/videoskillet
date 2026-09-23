import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import {
  PRESET_BY_NAME,
  controlsEqual,
  needsSourceB,
  presetControls,
} from '../ui/presets'
import { CAM_LOOKS, ROLL_POOL, lookBoard, lookLabel, rollLook } from './looks'

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

describe('lookBoard on a feedback loop', () => {
  const loops = CAM_LOOKS.filter(
    name => PRESET_BY_NAME.get(name)?.group === 'Feedback loops',
  )

  it('covers most of the strip', () => {
    expect(loops.length).toBeGreaterThan(CAM_LOOKS.length / 2)
  })

  // A loop blended toward stock drops below unity round trip and fades to a
  // copy of the camera, so the loop has to keep running at zero strength.
  it('keeps the loop running with its own gain at zero strength', () => {
    for (const name of loops) {
      const full = presetControls(PRESET_BY_NAME.get(name)?.patch ?? {})
      const low = lookBoard({ name, strength: 0, rolled: false }).controls
      const loopMix = full.fbMix > 0 ? 'fbMix' : 'cfbMix'
      const loopGain = full.fbMix > 0 ? 'fbGain' : 'cfbGain'
      expect(low[loopMix], name).toBeGreaterThan(0)
      expect(low[loopGain], name).toBe(full[loopGain])
    }
  })

  it('opens the loop further as strength rises', () => {
    for (const name of loops) {
      const full = presetControls(PRESET_BY_NAME.get(name)?.patch ?? {})
      const loopMix = full.fbMix > 0 ? 'fbMix' : 'cfbMix'
      const mixes = [0, 0.5, 1].map(
        strength =>
          lookBoard({ name, strength, rolled: false }).controls[loopMix],
      )
      expect(mixes[0], name).toBeLessThan(mixes[1])
      expect(mixes[1], name).toBeLessThan(mixes[2])
    }
  })
})

describe('rollLook', () => {
  it('rolls a feedback loop, never the one already up', () => {
    let look = rollLook(null)
    for (let i = 0; i < 200; i++) {
      const next = rollLook(look)
      expect(next.name).not.toBe(look.name)
      const def = PRESET_BY_NAME.get(next.name)
      expect(def?.group).toBe('Feedback loops')
      expect(def !== undefined && needsSourceB(def)).toBe(false)
      expect(next.rolled).toBe(true)
      look = next
    }
  })

  it('has more than one loop to roll', () => {
    expect(ROLL_POOL.length).toBeGreaterThan(1)
  })
})

it('calls no look normal', () => {
  expect(lookLabel(null)).toBe('normal')
  expect(lookLabel({ name: 'wornTape', strength: 1, rolled: false })).toBe(
    'worn tape',
  )
})

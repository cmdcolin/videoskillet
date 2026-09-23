import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import {
  PRESET_BY_NAME,
  controlsEqual,
  needsSourceB,
  presetControls,
} from '../ui/presets'
import {
  CAM_LOOKS,
  CAM_MIX_LOOKS,
  ROLL_POOL,
  lookBoard,
  lookLabel,
  needsSecond,
  rollLook,
  subtleLoop,
} from './looks'

describe('the camera strip', () => {
  it('names only presets that exist', () => {
    for (const name of CAM_LOOKS)
      expect(PRESET_BY_NAME.has(name), name).toBe(true)
  })

  // B is empty until a second picture goes on it, so a look that mixes one
  // source would show the camera untouched.
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

describe('subtleLoop', () => {
  it('passes every loop on the strip', () => {
    for (const name of CAM_LOOKS) {
      const def = PRESET_BY_NAME.get(name)
      expect(
        def !== undefined && subtleLoop(presetControls(def.patch)),
        name,
      ).toBe(true)
    }
  })

  it('turns away the big zooms, spins and delays', () => {
    for (const name of [
      'spiral',
      'tunnelOut',
      'colourKeepsWalking',
      'ringLadder',
      'servoWarp',
    ]) {
      const def = PRESET_BY_NAME.get(name)
      expect(
        def !== undefined && subtleLoop(presetControls(def.patch)),
        name,
      ).toBe(false)
    }
  })
})

describe('rollLook', () => {
  it('rolls a subtle feedback loop, never the one already up', () => {
    let look = rollLook(null)
    for (let i = 0; i < 200; i++) {
      const next = rollLook(look)
      expect(next.name).not.toBe(look.name)
      const def = PRESET_BY_NAME.get(next.name)
      expect(def?.group).toBe('Feedback loops')
      expect(def !== undefined && subtleLoop(presetControls(def.patch))).toBe(
        true,
      )
      expect(def !== undefined && needsSourceB(def)).toBe(false)
      expect(next.rolled).toBe(true)
      look = next
    }
  })

  it('has a couple of dozen loops to roll', () => {
    expect(ROLL_POOL.length).toBeGreaterThan(20)
  })
})

it('calls no look normal', () => {
  expect(lookLabel(null)).toBe('normal')
  expect(lookLabel({ name: 'wornTape', strength: 1, rolled: false })).toBe(
    'worn tape',
  )
})

describe('the strip with a second picture on B', () => {
  // A look that mixes nothing in would read as the camera untouched, and one
  // already on the strip would show twice.
  it('offers only looks that mix B in', () => {
    for (const name of CAM_MIX_LOOKS) {
      expect(PRESET_BY_NAME.has(name), name).toBe(true)
      expect(needsSecond(name), name).toBe(true)
      expect((CAM_LOOKS as readonly string[]).includes(name), name).toBe(false)
    }
  })

  it('knows a look that mixes from one that does not', () => {
    expect(needsSecond('cleanDissolve')).toBe(true)
    expect(needsSecond('zoomBloom')).toBe(false)
    expect(needsSecond('no such look')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import {
  PRESET_BY_NAME,
  blendPresets,
  controlsEqual,
  needsSourceB,
  presetControls,
} from '../ui/presets'
import {
  MIX_MODES,
  MIX_SHELF,
  ROLL_POOL,
  SHELVES,
  lookBoard,
  lookKnobs,
  lookLabel,
  mixControls,
  mixesItself,
  rollLook,
  rollPool,
  stackLabel,
  subtleLoop,
} from './looks'

import type { Layers, Mix } from './looks'

const ON_TABS = [...SHELVES, MIX_SHELF].flatMap(s => s.looks)
const LOOPS = SHELVES.find(s => s.name === 'loops')?.looks ?? []

describe('the camera strip', () => {
  it('names only presets that exist', () => {
    for (const name of ON_TABS)
      expect(PRESET_BY_NAME.has(name), name).toBe(true)
  })

  // B is empty until a second picture goes on it, so a look that mixes one
  // source would show the camera untouched, and the mix tab only opens with B.
  it('keeps the looks that need a second source on the mix tab', () => {
    for (const shelf of SHELVES)
      for (const name of shelf.looks)
        expect(mixesItself(name), name).toBe(false)
    for (const name of MIX_SHELF.looks)
      expect(mixesItself(name), name).toBe(true)
  })

  it('lists each look once', () => {
    expect(new Set(ON_TABS).size).toBe(ON_TABS.length)
  })

  it('lists each look under a family its tab rolls from', () => {
    for (const shelf of [...SHELVES, MIX_SHELF])
      for (const name of shelf.looks)
        expect(shelf.groups, name).toContain(PRESET_BY_NAME.get(name)?.group)
  })

  it('rolls within the tab', () => {
    for (const shelf of [...SHELVES, MIX_SHELF]) {
      const pool = rollPool(shelf)
      expect(pool.length, shelf.name).toBeGreaterThan(shelf.looks.length / 2)
      const next = rollLook(null, pool)
      expect(pool).toContain(next.name)
    }
  })
})

describe('lookBoard', () => {
  it('lands a look at full strength as the preset itself', () => {
    for (const name of ON_TABS) {
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

describe('lookBoard with looks stacked on it', () => {
  const look = { name: 'pictureSearch', strength: 1, rolled: false }

  it('mixes a stacked look in by its weight, as the preset mixer does', () => {
    const { controls } = lookBoard(look, { looseConnector: 0.5 })
    const mixed = blendPresets(
      DEFAULT_CONTROLS,
      new Map([
        ['looseConnector', 0.5],
        ['pictureSearch', 1],
      ]),
    )
    expect(controlsEqual(controls, mixed)).toBe(true)
  })

  it('ignores a layer at nothing and a layer that is the look', () => {
    const alone = lookBoard(look).controls
    const cases: Layers[] = [{ looseConnector: 0 }, { pictureSearch: 0.3 }]
    for (const layers of cases)
      expect(controlsEqual(lookBoard(look, layers).controls, alone)).toBe(true)
  })

  // Two presets on one loop cannot both set its geometry.
  it('lets the heavier of two loops set the loop', () => {
    const heavy = presetControls(
      PRESET_BY_NAME.get('clockAndCrystal')?.patch ?? {},
    )
    const { controls } = lookBoard(
      { name: 'theLightIsALapBehind', strength: 0.2, rolled: false },
      { clockAndCrystal: 0.9 },
    )
    expect(controls.cfbDelayUs).toBe(heavy.cfbDelayUs)
  })

  it('counts the stack in its name', () => {
    expect(stackLabel(look, {})).toBe('picture search')
    expect(stackLabel(look, { looseConnector: 0.4, wornTape: 0.2 })).toBe(
      'picture search + 2',
    )
  })
})

describe('lookBoard on a feedback loop', () => {
  const loops = LOOPS

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
  it('passes every loop on the loops tab', () => {
    for (const name of LOOPS) {
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

it('does not name a rolled look', () => {
  const look = { name: 'wornTape', strength: 1, rolled: true }
  expect(lookLabel(look)).toBe('random')
  expect(stackLabel(look, { looseConnector: 0.4 })).toBe('random + 1')
})

describe('the mixer', () => {
  const at = (mix: Mix) => ({ ...DEFAULT_CONTROLS, ...mixControls(mix) })

  it('shows only A with the fader down', () => {
    expect(at({ mode: 'dissolve', fader: 0 }).bGain).toBe(0)
    expect(at({ mode: 'sum', fader: 0 }).bGain).toBe(0)
    expect(at({ mode: 'wipe', fader: 0 }).wipePos).toBe(0)
    expect(at({ mode: 'key', fader: 0 }).pipKeyLevel).toBe(1)
  })

  // A mode that left the last one's switch up would show both at once.
  it('clears what the other modes set', () => {
    for (const mode of MIX_MODES) {
      const c = at({ mode, fader: 1 })
      if (mode !== 'wipe') expect(c.wipeMode, mode).toBe(0)
      if (mode !== 'inset' && mode !== 'key') expect(c.pipMix, mode).toBe(0)
    }
  })

  it('keeps the inset inside the picture', () => {
    for (const fader of [0, 0.5, 1]) {
      const c = at({ mode: 'inset', fader })
      expect(c.pipX + c.pipW / 2).toBeLessThanOrEqual(1)
      expect(c.pipY - c.pipH / 2).toBeGreaterThanOrEqual(0)
    }
  })

  // Past the edge of a slice the wipe would move with nothing on show.
  it('wipes across a slice edge to edge', () => {
    const slice = 0.5625
    const pos = (fader: number) =>
      mixControls({ mode: 'wipe', fader }, slice).wipePos
    expect(pos(0)).toBeCloseTo(0.5 - slice / 2)
    expect(pos(1)).toBeCloseTo(0.5 + slice / 2)
  })
})

describe('the tune sheet', () => {
  it("leads with the look's own controls", () => {
    const keys = lookKnobs({
      name: 'theLightIsALapBehind',
      strength: 1,
      rolled: false,
    }).map(k => k.key)
    expect(keys[0]).toBe('cfbMix')
    expect(keys).toContain('ghostGain')
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("offers the set's own with no look up", () => {
    expect(lookKnobs(null).map(k => k.key)).toEqual([
      'chromaGain',
      'tintDeg',
      'noiseIre',
      'ghostGain',
    ])
  })
})

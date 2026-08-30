import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import {
  CARD_PRESETS,
  activeCardPreset,
  applyCardPreset,
  cardPresetsFor,
} from './cardPresets'
import { GROUPS, sliderFor } from './controls'

import type { Controls } from '../core/controls'

const groupNamed = (name: string) => {
  const g = GROUPS.find(x => x.name === name)
  if (g === undefined) throw new Error(`no group ${name}`)
  return g
}

describe('the card presets', () => {
  it('each name a card the panel actually has', () => {
    const live = new Set(GROUPS.map(g => g.name))
    expect(
      CARD_PRESETS.filter(p => !live.has(p.group)).map(p => p.name),
    ).toEqual([])
  })

  // The invariant the whole idea rests on. A chip that reaches outside its own
  // card is a preset wearing a chip's clothes: it would move controls the rows
  // under it do not show, and `applyCardPreset` would not put those back on the
  // next press, so the chips would stack instead of compose.
  it('only move controls that are on their own card', () => {
    for (const p of CARD_PRESETS) {
      const own = new Set<string>(groupNamed(p.group).sliders.map(s => s.key))
      expect({
        chip: p.name,
        strays: Object.keys(p.patch).filter(k => !own.has(k)),
      }).toEqual({ chip: p.name, strays: [] })
    }
  })

  it('write values their own sliders can hold', () => {
    for (const p of CARD_PRESETS) {
      for (const [key, v] of Object.entries(p.patch)) {
        const def = sliderFor(key as keyof Controls)
        expect({ chip: p.name, key, ok: v >= def.min && v <= def.max }).toEqual(
          {
            chip: p.name,
            key,
            ok: true,
          },
        )
      }
    }
  })

  it('say something — a chip identical to stock is a chip that does nothing', () => {
    for (const p of CARD_PRESETS) {
      const moved = Object.entries(p.patch).filter(
        ([k, v]) => v !== DEFAULT_CONTROLS[k as keyof Controls],
      )
      expect({ chip: p.name, moved: moved.length > 0 }).toEqual({
        chip: p.name,
        moved: true,
      })
    }
  })

  it('are distinct within a card', () => {
    for (const g of GROUPS) {
      const chips = cardPresetsFor(g.name)
      const seen = chips.map(c => JSON.stringify(c.patch))
      expect(new Set(seen).size).toBe(seen.length)
      expect(new Set(chips.map(c => c.name)).size).toBe(chips.length)
    }
  })
})

describe('pressing one', () => {
  const tape = groupNamed('Timebase')
  const chips = cardPresetsFor('Timebase')

  it('leaves every control outside the card exactly where it was', () => {
    const before: Controls = {
      ...DEFAULT_CONTROLS,
      noiseIre: 12,
      crtGamma: 2.2,
    }
    const after = applyCardPreset(chips[0], tape, before)
    for (const k of Object.keys(before) as (keyof Controls)[]) {
      if (tape.sliders.some(s => s.key === k)) continue
      expect(after[k]).toBe(before[k])
    }
  })

  // Composing rather than stacking: the card goes back to stock first, so the
  // second chip is the second chip and not a deck carrying both faults.
  it('does not leave the last chip behind', () => {
    const wow = applyCardPreset(chips[0], tape, { ...DEFAULT_CONTROLS })
    const sticky = applyCardPreset(chips[2], tape, wow)
    const fresh = applyCardPreset(chips[2], tape, { ...DEFAULT_CONTROLS })
    for (const s of tape.sliders) expect(sticky[s.key]).toBe(fresh[s.key])
  })

  it('lights the chip the card is standing on, and only that one', () => {
    const at = applyCardPreset(chips[1], tape, { ...DEFAULT_CONTROLS })
    expect(activeCardPreset(tape, at)?.name).toBe(chips[1].name)
    // …and stops claiming it the moment a slider on the card moves.
    expect(
      activeCardPreset(tape, { ...at, tbJitterNs: at.tbJitterNs + 100 }),
    ).toBeUndefined()
    // A control on another card is not this card's business.
    expect(activeCardPreset(tape, { ...at, crtGamma: 1.8 })?.name).toBe(
      chips[1].name,
    )
    expect(activeCardPreset(tape, { ...DEFAULT_CONTROLS })).toBeUndefined()
  })
})

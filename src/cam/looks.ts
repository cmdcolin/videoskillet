import { DEFAULT_CONTROLS } from '../core/controls'
import { routingsToSlots, toEngineSlots } from '../ui/modSlots'
import {
  blendMod,
  blendPresets,
  presetLabelFor,
  randomSinglePreset,
} from '../ui/presets'

import type { Controls, ModSlot } from '../core/controls'

// The looks the camera's strip offers, in strip order. The instrument has
// about 150 presets, and a phone needs a list short enough to scroll with a
// thumb. The list takes one or two from each family, chosen for what they do to
// a live picture of a person. None needs a second source, since the camera page
// has only one.
export const CAM_LOOKS = [
  'vhs',
  'wornTape',
  'trackingBand',
  'fringeReception',
  'scrambledChannel',
  'verticalHoldGone',
  'rainbowStorm',
  'contourLines',
  'falseColour',
  'neonTube',
  'greenTerminal',
  'ringInTheHighlights',
  'tunnelOut',
  'spiral',
] as const

// What is on the picture: a preset at a strength, or `null` for the camera as
// it comes. `rolled` marks a look the dice picked, which the strip shows on the
// dice chip because it may be one of the 150 the strip does not list.
export interface Look {
  name: string
  strength: number
  rolled: boolean
}

export const lookLabel = (look: Look | null): string =>
  look === null ? 'normal' : presetLabelFor(look.name)

// The board and the modulation bay a look lands as. Strength is the preset
// mixer's weight, so half strength is every control half way from stock to the
// preset, with the mode switches cutting over the way a mix cuts them.
export function lookBoard(look: Look | null): {
  controls: Controls
  mod: ModSlot[]
} {
  if (look === null) return { controls: DEFAULT_CONTROLS, mod: [] }
  const weights = new Map([[look.name, look.strength]])
  const mod = blendMod(weights)
  return {
    controls: blendPresets(DEFAULT_CONTROLS, weights),
    mod: mod === null ? [] : toEngineSlots(routingsToSlots(mod)),
  }
}

// One authored look at full strength, never the one already up.
export function rollLook(current: Look | null): Look {
  const [name] = randomSinglePreset(false, Math.random, current?.name ?? null)
    .keys()
    .toArray()
  return { name, strength: 1, rolled: true }
}

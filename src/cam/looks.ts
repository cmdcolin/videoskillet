import { DEFAULT_CONTROLS } from '../core/controls'
import { randomIndex } from '../core/rng'
import {
  LOOP_STAGES,
  SLIDER_BY_KEY,
  loopGroups,
  snapToStep,
} from '../ui/controls'
import { routingsToSlots, toEngineSlots } from '../ui/modSlots'
import {
  PRESETS,
  PRESET_BY_NAME,
  blendMod,
  blendPresets,
  needsSourceB,
  presetControls,
  presetLabelFor,
} from '../ui/presets'

import type { Controls, ModSlot } from '../core/controls'

// The looks the camera's strip offers, in strip order. The instrument has
// about 150 presets, and a phone needs a list short enough to scroll with a
// thumb. The strip is mostly feedback loops, picked by rendering all 58 over a
// subject: first the loops that keep a face readable, then the ones that turn
// the picture into geometry, then three faults with no loop in them. None needs
// a second source, since the camera page has only one.
//
// The loops that change most from one frame to the next (threeServos,
// meltdown, syncInTheLoop, shearedAndStacked) stay off the strip, since a
// phone is held close to the face. The dice can still roll them.
export const CAM_LOOKS = [
  'ringInTheHighlights',
  'carvedByTheLivePicture',
  'litAtTheEdges',
  'chasingItsOwnColour',
  'theLightIsALapBehind',
  'itOnlyEatsTheRed',
  'clockAndCrystal',
  'warpInTheShadows',
  'runaway',
  'spiral',
  'colourKeepsWalking',
  'tunnelOut',
  'encoderWiredBackwards',
  'beamBendsItsOwnScan',
  'vhs',
  'verticalHoldGone',
  'rainbowStorm',
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

// Each loop's mix, and the rest of that loop's own controls.
const LOOPS = LOOP_STAGES.map(stage => ({
  mix: stage.mix,
  rest: loopGroups(stage.loop)
    .flatMap(g => g.sliders.map(sl => sl.key))
    .filter(key => key !== stage.mix),
}))

// The share of a preset's loop mix left at zero strength. A loop draws its
// structure only while the round trip, mix times gain, sits near unity, so a
// loop blended toward stock like every other control fades to a soft copy of
// the camera within the first fifth of the slider. At this floor the round
// trip of the loops on the strip is 0.5 to 0.7, which leaves echo trails
// behind anything that moves.
const MIX_FLOOR = 0.6

// The board and the modulation bay a look lands as. Strength is the preset
// mixer's weight, so half strength is every control half way from stock to the
// preset, with the mode switches cutting over the way a mix cuts them.
//
// A loop the preset runs is the exception. Its gain, limiter and geometry stay
// at the preset's values, and strength moves only its mix, from MIX_FLOOR of
// the preset's up to all of it: the slider runs from echo trails to the look
// building on itself.
export function lookBoard(look: Look | null): {
  controls: Controls
  mod: ModSlot[]
} {
  if (look === null) return { controls: DEFAULT_CONTROLS, mod: [] }
  const weights = new Map([[look.name, look.strength]])
  const controls = blendPresets(DEFAULT_CONTROLS, weights)
  const def = PRESET_BY_NAME.get(look.name)
  if (def !== undefined) {
    const full = presetControls(def.patch)
    for (const loop of LOOPS) {
      if (full[loop.mix] > 0) {
        for (const key of loop.rest) controls[key] = full[key]
        const slider = SLIDER_BY_KEY.get(loop.mix)
        const mix =
          full[loop.mix] * (MIX_FLOOR + (1 - MIX_FLOOR) * look.strength)
        controls[loop.mix] =
          slider === undefined ? mix : snapToStep(slider, mix)
      }
    }
  }
  const mod = blendMod(weights)
  return {
    controls,
    mod: mod === null ? [] : toEngineSlots(routingsToSlots(mod)),
  }
}

// What the dice rolls: every feedback loop the camera can run on its own.
export const ROLL_POOL: readonly string[] = PRESETS.filter(
  p => p.group === 'Feedback loops' && !needsSourceB(p),
).map(p => p.name)

// One authored loop at full strength, never the one already up.
export function rollLook(current: Look | null): Look {
  const pool = ROLL_POOL.filter(name => name !== current?.name)
  return { name: pool[randomIndex(pool.length)], strength: 1, rolled: true }
}

import { DEFAULT_CONTROLS } from '../core/controls'
import { randomIndex } from '../core/rng'
import {
  LOOP_STAGES,
  SLIDER_BY_KEY,
  loopGroups,
  sliderFor,
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

import type { ControlKey, Controls, ModSlot } from '../core/controls'
import type { SliderDef } from '../ui/controls'

// How far a loop may move the picture each lap and still count as subtle: a
// camera within 4.5% of unity zoom, turning at most a degree and shifting at
// most 2% of the frame, or a mixer loop at most 1.2 us and four lines late
// whose delay the video does not pull far. Feedback looks best on a camera
// with that little movement per lap. Big zooms, spins and delays read as
// cheesy.
//
// A subtle loop cannot be made out of a dramatic one by scaling its geometry
// down. The preset's gain is tuned to how far its geometry spreads each lap,
// and at a quarter of the zoom and turn the same gain stacks the picture onto
// itself and walls out to white.
export const SUBTLE = {
  zoom: 0.045,
  rotateDeg: 1,
  shift: 0.02,
  delayUs: 1.2,
  lines: 4,
  servoUs: 5,
}

export function subtleLoop(c: Controls): boolean {
  const camera =
    c.fbMix === 0 ||
    (Math.abs(c.fbZoom - 1) <= SUBTLE.zoom &&
      Math.abs(c.fbRotateDeg) <= SUBTLE.rotateDeg &&
      Math.abs(c.fbShiftX) <= SUBTLE.shift &&
      Math.abs(c.fbShiftY) <= SUBTLE.shift)
  const mixer =
    c.cfbMix === 0 ||
    (c.cfbDelayUs <= SUBTLE.delayUs &&
      Math.abs(c.cfbLines) <= SUBTLE.lines &&
      Math.abs(c.cfbServoUs) <= SUBTLE.servoUs)
  return camera && mixer
}

// The looks the camera's strip offers, in strip order. The instrument has
// about 150 presets, and a phone needs a list short enough to scroll with a
// thumb. The strip is mostly subtle feedback loops, picked by rendering every
// one over a moving subject: the shortest delays first, then the camera loops
// nearest unity zoom, then the keyed loops that colour a face without losing
// it, then three faults with no loop in them. None needs a second source,
// since B is empty until a second picture goes on it.
export const CAM_LOOKS = [
  'shadowLadder',
  'theLightIsALapBehind',
  'clockAndCrystal',
  'theWrongClock',
  'aimedAHairOff',
  'turnedAHair',
  'theIrisHoldsTheEdge',
  'huntingServos',
  'zoomBloom',
  'noColourToTrade',
  'litAtTheEdges',
  'ringInTheHighlights',
  'carvedByTheLivePicture',
  'chasingItsOwnColour',
  'itOnlyEatsTheRed',
  'theFaceStaysOutOfIt',
  'runaway',
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

// What the dice rolls: every subtle feedback loop the camera can run on its
// own.
export const ROLL_POOL: readonly string[] = PRESETS.filter(
  p =>
    p.group === 'Feedback loops' &&
    !needsSourceB(p) &&
    subtleLoop(presetControls(p.patch)),
).map(p => p.name)

// One authored loop at full strength, never the one already up.
export function rollLook(current: Look | null): Look {
  const pool = ROLL_POOL.filter(name => name !== current?.name)
  return { name: pool[randomIndex(pool.length)], strength: 1, rolled: true }
}

// How the mixer puts B with A. Each is a switcher's own tool: a genlocked
// dissolve, a wipe, a squeezed inset, a luma key of B over A, and the dirty
// sum of two sources with no sync between them.
export const MIX_MODES = ['dissolve', 'wipe', 'inset', 'key', 'sum'] as const
export type MixMode = (typeof MIX_MODES)[number]

export interface Mix {
  mode: MixMode
  // 0 is all A, and 1 all of what the mode lets B be.
  fader: number
}

const INSET_MARGIN = 0.04

// The mixer's controls for a mode at a fader position. Every mode sets the
// switches the others use, so a change of mode leaves nothing of the last one
// up.
// `slice` is the share of the glass on show. The wipe travels across that
// share alone, and an inset in a slice is a box opening in the middle: a
// squeezed B would bring the black either side of its own slice with it.
const MIXES: Record<MixMode, (f: number, slice: number) => Partial<Controls>> =
  {
    dissolve: f => ({ bGain: f }),
    wipe: (f, slice) => ({
      bGain: 1,
      wipeMode: 1,
      wipePos: 0.5 - slice / 2 + f * slice,
      wipeSoft: 0.04,
    }),
    inset: (f, slice) => {
      if (slice < 1)
        return { bGain: 1, wipeMode: 3, wipePos: f, wipeSoft: 0.02 }
      const w = 0.2 + 0.72 * f
      return {
        pipMix: 1,
        pipW: w,
        pipH: w,
        pipX: 1 - INSET_MARGIN - w / 2,
        pipY: INSET_MARGIN + w / 2,
      }
    },
    key: f => ({
      pipMix: 1,
      pipX: 0.5,
      pipY: 0.5,
      pipW: 1,
      pipH: 1,
      pipBorder: 0,
      pipKey: 1,
      pipKeyLevel: 1 - f,
      pipKeySoft: 0.1,
    }),
    sum: f => ({ bGenlock: 0, bGain: f }),
  }

export const mixControls = (mix: Mix, slice = 1): Partial<Controls> => ({
  bGenlock: 1,
  bGain: 0,
  wipeMode: 0,
  pipMix: 0,
  pipKey: 0,
  ...MIXES[mix.mode](mix.fader, slice),
})

// What every look offers after its own controls: colour, tint, snow and a
// ghost.
const SET_KNOBS: readonly ControlKey[] = [
  'chromaGain',
  'tintDeg',
  'noiseIre',
  'ghostGain',
]

const SLIDER_BY_NAME = new Map<string, SliderDef>(SLIDER_BY_KEY)

// The controls the tune sheet shows for a look: the ones its preset sets, in
// the preset's order, then the set's own.
export function lookKnobs(look: Look | null): SliderDef[] {
  const def = look === null ? undefined : PRESET_BY_NAME.get(look.name)
  const own = Object.keys(def?.patch ?? {}).flatMap(
    k => SLIDER_BY_NAME.get(k) ?? [],
  )
  const keys = new Set(own.map(s => s.key))
  return [...own, ...SET_KNOBS.filter(k => !keys.has(k)).map(sliderFor)]
}

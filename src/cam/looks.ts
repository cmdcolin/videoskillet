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

// A tab of the camera's strip: the looks one part of the signal path makes.
export interface Shelf {
  name: string
  looks: readonly string[]
  // The preset families the dice rolls from on this tab.
  groups: readonly string[]
}

// The strip's tabs, in tab order. The instrument has about 150 presets, and a
// phone needs a list short enough to scroll with a thumb. Every one was
// rendered over a moving subject on an upright phone, and each tab keeps the
// ones whose fault reads at phone size and leaves the subject in the picture,
// strongest first. The loops are the subtle ones (see SUBTLE) whose colour
// does the work; the rest are the tape, the signal on its way in, the scan,
// and the circuit-bent boxes. None needs a second source, since B is empty
// until a second picture goes on it.
export const SHELVES: readonly Shelf[] = [
  {
    name: 'loops',
    groups: ['Feedback loops'],
    looks: [
      'theLightIsALapBehind',
      'clockAndCrystal',
      'theFaceStaysOutOfIt',
      'keyedOnWhatItMade',
      'whereTheProductsLand',
      'subcarrierSiren',
      'syncInTheLoop',
      'runaway',
      'zoomBloom',
      'itOnlyEatsTheRed',
      'carvedByTheLivePicture',
      'chasingItsOwnColour',
      'shadowLadder',
    ],
  },
  {
    name: 'tape',
    groups: ['Tape wear'],
    looks: [
      'pictureSearch',
      'trackingBand',
      'wornTape',
      'hueRidesTheLight',
      'protectedTape',
      'aimedAtTheVcr',
      'servoHunt',
    ],
  },
  {
    name: 'signal',
    groups: [
      'RF / Broadcast',
      'Decoder',
      'Bad cables',
      'Cross-wired',
      'Full board',
    ],
    looks: [
      'looseConnector',
      'signalAndGroundSwapped',
      'ignitionStorm',
      'fringeReception',
      'deadChannel',
      'sVideoMiswire',
      'collapsedAxes',
      'tintInASlowHand',
      'transmissionFault',
      'negative',
    ],
  },
  {
    name: 'scan',
    groups: ['Sync / Deflection', 'Phosphor / CRT'],
    looks: [
      'verticalHoldGone',
      'supplyChaos',
      'fullCollapse',
      'bentScan',
      'servicePosition',
      'noseAgainstTheGlass',
      'greenTerminal',
      'magnetised',
    ],
  },
  {
    name: 'bent',
    groups: ['Circuit bent', 'Past the redline'],
    looks: [
      'paperclipChroma',
      'silkscreen',
      'falseColour',
      'clampInThePicture',
      'outOfHeadroom',
      'falseSync',
      'twoMultipliers',
      'contourLines',
      'rainbowStorm',
      'everyColourButOne',
    ],
  },
]

// The tab a second picture on B opens: two sources meeting in a mixer that
// has lost its sync, its supply or its plugs. A look here sets the mixer
// itself, so the mixer's own modes stand aside while it is up.
export const MIX_SHELF: Shelf = {
  name: 'mix',
  groups: ['A/B mixing'],
  looks: [
    'dirtyMix',
    'pauseFight',
    'wiggledPlugs',
    'outOfVolts',
    'negativeDrifter',
    'houseDeckHeld',
    'wipeFight',
    'splitPhase',
    'differenceKey',
    'ringMix',
  ],
}

// Whether a look sets the mixer, and so shows anything only with B up.
export const mixesItself = (name: string): boolean => {
  const def = PRESET_BY_NAME.get(name)
  return def !== undefined && needsSourceB(def)
}

// What is on the picture: a preset at a strength, or `null` for the camera as
// it comes. `rolled` marks a look the random roll picked, which may be one of
// the 150 the strip does not list, so no chip on the strip is up for it.
export interface Look {
  name: string
  strength: number
  rolled: boolean
}

// A rolled look keeps its name to itself: random is a scramble, and the strip,
// the tune sheet and the saved file's name all call it so.
export const lookLabel = (look: Look | null): string =>
  look === null ? 'normal' : look.rolled ? 'random' : presetLabelFor(look.name)

// The name a still or a take is saved under: the look, and how many more are
// stacked on it.
export function stackLabel(look: Look | null, layers: Layers): string {
  const more = Object.keys(layers).filter(n => n !== look?.name).length
  return more === 0 ? lookLabel(look) : `${lookLabel(look)} + ${more}`
}

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

// Presets dragged in partway on top of the look, each at its own weight.
export type Layers = Readonly<Record<string, number>>

// The board and the modulation bay a look lands as, with any layers stacked on
// it. Strength and a layer's weight are both the preset mixer's weights, so a
// preset at half is every control it sets half way from stock to its value,
// with the mode switches cutting over the way a mix cuts them, and two presets
// that set one control share it by weight.
//
// A loop a preset runs is the exception. Its gain, limiter and geometry stay
// at the preset's values, and the weight moves only its mix, from MIX_FLOOR of
// the preset's up to all of it: the slider runs from echo trails to the look
// building on itself. Where two presets run the same loop, the heavier one
// sets it.
export function lookBoard(
  look: Look | null,
  layers: Layers = {},
): {
  controls: Controls
  mod: ModSlot[]
} {
  const weights = new Map(
    Object.entries(layers).filter(([name, w]) => w > 0 && name !== look?.name),
  )
  if (look !== null) weights.set(look.name, look.strength)
  if (weights.size === 0) return { controls: DEFAULT_CONTROLS, mod: [] }
  const controls = blendPresets(DEFAULT_CONTROLS, weights)
  const lightest = [...weights].toSorted((a, b) => a[1] - b[1])
  for (const [name, weight] of lightest) {
    const def = PRESET_BY_NAME.get(name)
    if (def === undefined) continue
    const full = presetControls(def.patch)
    for (const loop of LOOPS) {
      if (full[loop.mix] > 0) {
        for (const key of loop.rest) controls[key] = full[key]
        const slider = SLIDER_BY_KEY.get(loop.mix)
        const mix = full[loop.mix] * (MIX_FLOOR + (1 - MIX_FLOOR) * weight)
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

// What the dice rolls on the loops tab: every subtle feedback loop the camera
// can run on its own.
export const ROLL_POOL: readonly string[] = PRESETS.filter(
  p =>
    p.group === 'Feedback loops' &&
    !needsSourceB(p) &&
    subtleLoop(presetControls(p.patch)),
).map(p => p.name)

// What the dice rolls on a tab: every preset in the tab's families, so the
// dice reaches the looks the tab does not list. Only the mix tab rolls looks
// that need B.
export function rollPool(shelf: Shelf): readonly string[] {
  if (shelf.name === 'loops') return ROLL_POOL
  const mix = shelf === MIX_SHELF
  return PRESETS.filter(
    p => shelf.groups.includes(p.group) && needsSourceB(p) === mix,
  ).map(p => p.name)
}

// One authored look from `pool` at full strength, never the one already up.
export function rollLook(
  current: Look | null,
  pool: readonly string[] = ROLL_POOL,
): Look {
  const rest = pool.filter(name => name !== current?.name)
  return { name: rest[randomIndex(rest.length)], strength: 1, rolled: true }
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
export function lookKnobs(look: Look | null, layers: Layers = {}): SliderDef[] {
  const names = [...(look === null ? [] : [look.name]), ...Object.keys(layers)]
  const keys = [
    ...names.flatMap(n => Object.keys(PRESET_BY_NAME.get(n)?.patch ?? {})),
    ...SET_KNOBS,
  ]
  return [...new Set(keys)].flatMap(k => SLIDER_BY_NAME.get(k) ?? [])
}

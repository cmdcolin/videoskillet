import { aimKey } from './keyed'
import { lookBoard, mixControls, mixesItself } from './looks'
import { SLICE } from './tape'

import type { Controls } from '../core/controls'
import type { Layers, Look, Mix } from './looks'
import type { Layout } from './tape'

// Everything the board is built from: the look, the presets dragged in partway
// on top of it, the knobs moved off both, the mixer while B has a picture, and
// where a tap has aimed the look's keyer.
export interface Scene {
  look: Look | null
  layers: Layers
  tweaks: Partial<Controls>
  mix: Mix | null
  hue: number | null
}

export const CLEAN = { look: null, layers: {}, tweaks: {}, hue: null } as const

export const FIRST_MIX: Mix = { mode: 'dissolve', fader: 0.5 }

export const sliceOf = (layout: Layout) => (layout === 'slice' ? SLICE : 1)

// A look that sets the mixer itself keeps it; the mixer's own modes run under
// every other look.
export const mixerOwned = (s: Scene) =>
  [...(s.look === null ? [] : [s.look.name]), ...Object.keys(s.layers)].some(
    mixesItself,
  )

export const boardOf = (s: Scene, slice: number) => {
  const board = lookBoard(s.look, s.layers)
  const controls = {
    ...board.controls,
    ...s.tweaks,
    ...(s.mix === null || mixerOwned(s) ? {} : mixControls(s.mix, slice)),
  }
  return { ...board, controls: aimKey(controls, s.hue) }
}

export const without = (layers: Layers, name: string): Layers =>
  Object.fromEntries(Object.entries(layers).filter(([n]) => n !== name))

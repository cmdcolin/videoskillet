import type { Scene } from './scene'

// Undo takes back the look and the knobs. The mixer and the chroma keyer are
// left where they are, because each one also changes what is on B.
export type Step = Pick<Scene, 'base' | 'look' | 'layers' | 'tweaks' | 'hue'>

// Changes closer together than this are one step, so a drag undoes whole.
export const STEP_GAP_MS = 700
export const MAX_STEPS = 50

export const stepOf = (s: Scene): Step => ({
  base: s.base,
  look: s.look,
  layers: s.layers,
  tweaks: s.tweaks,
  hue: s.hue,
})

export const changesStep = (before: Scene, after: Scene) =>
  before.base !== after.base ||
  before.look !== after.look ||
  before.layers !== after.layers ||
  before.tweaks !== after.tweaks ||
  before.hue !== after.hue

export const banked = (
  past: readonly Step[],
  before: Scene,
  sinceLast: number,
) =>
  sinceLast > STEP_GAP_MS ? [...past, stepOf(before)].slice(-MAX_STEPS) : past

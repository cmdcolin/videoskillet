import type { Keyer } from './keyed'
import type { Scene } from './scene'

// Undo takes back the look, the knobs and where a tap aimed. The mixer, and
// whether the chroma keyer is on, are left where they are, because each one
// also changes what is on B.
export type Step = Pick<
  Scene,
  'base' | 'look' | 'layers' | 'tweaks' | 'hue' | 'keyer'
>

// Changes closer together than this are one step, so a drag undoes whole.
export const STEP_GAP_MS = 700
export const MAX_STEPS = 50

export const stepOf = (s: Scene): Step => ({
  base: s.base,
  look: s.look,
  layers: s.layers,
  tweaks: s.tweaks,
  hue: s.hue,
  keyer: s.keyer,
})

const reaimed = (before: Keyer | null, after: Keyer | null) =>
  before !== null && after !== null && before !== after

export const changesStep = (before: Scene, after: Scene) =>
  before.base !== after.base ||
  before.look !== after.look ||
  before.layers !== after.layers ||
  before.tweaks !== after.tweaks ||
  before.hue !== after.hue ||
  reaimed(before.keyer, after.keyer)

// The step put back over `now`, keeping the keyer on or off as it is now.
export const restored = (now: Scene, step: Step): Partial<Scene> => ({
  ...step,
  keyer: now.keyer !== null && step.keyer !== null ? step.keyer : now.keyer,
})

export const banked = (
  past: readonly Step[],
  before: Scene,
  sinceLast: number,
) =>
  sinceLast > STEP_GAP_MS ? [...past, stepOf(before)].slice(-MAX_STEPS) : past

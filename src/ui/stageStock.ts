import { DEFAULT_CONTROLS } from '../core/controls'
import { stageGroups } from './controls'

import type { Controls } from '../core/controls'

// The board with one stage put back to stock, for the hold-to-compare on a
// stage's heading (see StageHead). The whole-board compare previews
// DEFAULT_CONTROLS; this is the same question asked of one part of the path —
// what would the picture be if I had not touched anything in Channel — so the
// rest of the look has to survive it.
//
// A stage rather than a group, because "which part of the rig is making this"
// is the question a damaged board raises, and the answer is a stage. It is not
// a bypass: the passes still run, the picture still goes through. What changes
// is that this stage's controls read as untouched.
export const stockIn = (controls: Controls, stage: string): Controls => {
  const next = { ...controls }
  for (const group of stageGroups(stage)) {
    for (const slider of group.sliders) {
      next[slider.key] = DEFAULT_CONTROLS[slider.key]
    }
  }
  return next
}

// Whether a stage has any control to put back — which is what decides whether
// its heading offers the hold at all. The two boxes wired to nothing are the
// case: the modulation bay's rows are slots rather than controls, and the
// deck's are borrowed from the stages that own them, so neither has a group
// list here and a hold on either would be a button that did nothing.
export const holdable = (stage: string): boolean =>
  stageGroups(stage).length > 0

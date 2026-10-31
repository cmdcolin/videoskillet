import { atRest } from '../core/controls'
import {
  ALL_SLIDERS,
  CAMERA_LOOP_STAGE,
  CHANNEL_STAGE,
  MIX_STAGE,
  MIXER_LOOP_STAGE,
  SOUND_STAGE,
  SOURCE_A_STAGE,
  SOURCE_B_STAGE,
  stageGroups,
  VIEW_STAGE,
} from './controls'
import { groupOpens } from './placement'

import type { Controls } from '../core/controls'
import type { GeneratorsLive, Group, SliderDef } from './controls'

// What the "All settings" sheet lists, worked out from the control tables.

// The stages in the order the signal meets them, which is the map read column
// by column: B joins at the mixer, the mixer loop re-enters straight after the
// A/B sum, the camera loop ahead of the encoder, the sound inside the receiver,
// and the view hangs off the glass. The panel lists the trunk, then the loops,
// then the branches, and in a flat list that order puts Source B six stages
// after the mixer it feeds.
export const ALL_SETTINGS_STAGES: readonly string[] = [
  SOURCE_A_STAGE,
  SOURCE_B_STAGE,
  MIX_STAGE,
  MIXER_LOOP_STAGE,
  CAMERA_LOOP_STAGE,
  CHANNEL_STAGE,
  'Receiver',
  SOUND_STAGE,
  'Screen',
  VIEW_STAGE,
]

export interface GroupRows {
  group: Group
  // The rows the panel shows, and the trims it folds behind "fine tweaks",
  // which the sheet also shows unfolded.
  rows: readonly SliderDef[]
  fine: readonly SliderDef[]
}

export interface StageRows {
  name: string
  groups: GroupRows[]
}

// Every stage and group, narrowed to `only` when it is given. A group with no
// row left drops out, and so does a stage with no group left.
export function settingsIndex(only: ReadonlySet<string> | null): StageRows[] {
  const keep = (s: SliderDef) => only === null || only.has(s.key)
  return ALL_SETTINGS_STAGES.map(name => ({
    name,
    groups: stageGroups(name)
      .map(group => ({
        group,
        rows: group.sliders.filter(s => s.fine !== true && keep(s)),
        fine: group.sliders.filter(s => s.fine === true && keep(s)),
      }))
      .filter(g => g.rows.length + g.fine.length > 0),
  })).filter(stage => stage.groups.length > 0)
}

// Whether a group's heading can open it in the panel. The group has to open (a
// stage with nothing patched in opens onto its picker, its `withoutB` groups or
// nothing), and a generator's group is listed only while that generator runs.
export const opensInPanel = (
  group: Group,
  openStages: ReadonlySet<string>,
  generators: GeneratorsLive,
): boolean =>
  groupOpens(group, openStages) &&
  (group.generator === undefined || generators[group.generator])

// Every control off stock, as one string so a reading of it is a primitive
// (see useControlReading).
export const offStockKeys = (c: Controls): string =>
  ALL_SLIDERS.filter(s => !atRest(c[s.key], s.key))
    .map(s => s.key)
    .join(' ')

// The list "off stock only" shows, given what it showed last and what is off
// stock now. A row dragged back to stock stays, because unmounting it would end
// the drag under the pointer. The list takes the new set when a key arrives
// that it lacks, or when the whole board is back at stock.
export function restick<T>(
  held: readonly T[],
  now: readonly T[],
): readonly T[] {
  const arrived = now.some(k => !held.includes(k))
  const cleaned = now.length === 0 && held.length > 0
  return arrived || cleaned ? now : held
}

import { useState } from 'react'

import {
  CAMERA_LOOP_STAGE,
  CHANNEL_STAGE,
  MIXER_LOOP_STAGE,
  stageGroups,
} from './controls'
import {
  readRecord,
  readStored,
  usePersistedString,
  writeJSON,
} from './storage'

// Which stage is unfolded — one at a time, so the chain map stays on screen
// instead of scrolling past as a flat list of sixteen headers. Persisted; null
// is the map alone, and closing the open stage is how you get back to it.
const OPEN_PHASE_STORE = 'video_feedback_open_phase'

// And which group is unfolded inside each stage, one entry per stage.
//
// It was one name for the whole panel, which made a stage's fold a fact about
// the sidebar rather than about the stage: opening Receiver and coming back to
// Channel landed on Channel's first group, and Channel has nine. Where you were
// is a property of the place you were in, so it is stored per stage and the trip
// out and back costs nothing.
const OPEN_GROUPS_STORE = 'video_feedback_open_groups'

// The single name older builds wrote, superseded by the record above. Read once
// at mount and never written again — see `openGroupsFrom`, which is the only
// thing that can say which stage it belonged to.
const OPEN_GROUP_STORE = 'video_feedback_open_group'

export type OpenGroups = Partial<Record<string, string>>

// Which stage is open, read out of what was stored.
//
// Nothing stored is a first session, and it rests on the map alone. A first run
// did open on the head of the chain, on the argument that source A's picker
// lives there and a diagram of a rig with no way to put a picture into it is a
// dead end — but the map's SOURCE A box is pressable with nothing patched in
// (see `stageTop` in app.tsx, which is what decides that), so the picker is one
// click from the resting state and does not need a panel unfolded over it to be
// reachable. A sidebar that opens itself is the more expensive default: every
// new session, and every browser without the key — a fresh profile, a private
// window, another port in dev — starts with a stage in the way.
//
// This is why the empty string, which used to mean "closed on purpose" as
// distinct from "never chosen", is now just another way of spelling closed: both
// answers are the same, and the pair exists only to keep reading what older
// sessions wrote.
//
// A stage that no longer exists is the case that still needs translating. Left
// alone it comes back as a name nothing renders and no box on the map opens — a
// session that returns to a panel showing nothing, with no way to tell that from
// having closed it.
//
// 'Feedback' is stored state from before the split: it was one stage over three
// loops, and it is now three. The camera loop is where it lands because it held
// the group 'Feedback' opened at first. The other three are the same three
// stages under the names they were filed as before they were called after their
// machines rather than after the fact that each is a loop (see LOOP_STAGES).
const GONE: Readonly<Record<string, string>> = {
  Feedback: CAMERA_LOOP_STAGE,
  'Camera loop': CAMERA_LOOP_STAGE,
  'Mixer loop': MIXER_LOOP_STAGE,
  // The trunk stage that held the tape, the tuner and the cable, under the name
  // of one of the three. See PHASE_ORDER.
  Tape: CHANNEL_STAGE,
}

export const openStageFrom = (stored: string | null): string | null =>
  stored === null || stored === '' ? null : (GONE[stored] ?? stored)

// Which group a stage is unfolded at, out of what was stored.
//
// Validated against the stage's own groups rather than trusted, for the reason
// the stage name above is: groups get renamed, and one moved to another stage
// takes its stored entry with it. A name nothing under this stage renders would
// fold every one of its sections shut, which from the outside is a stage that
// opened onto nothing. Unrecognised is therefore the same answer as never
// having opened one.
export const groupOpenIn = (
  groups: OpenGroups,
  stage: string,
): string | null => {
  const name = groups[stage]
  return name !== undefined && stageGroups(stage).some(g => g.name === name)
    ? name
    : null
}

// The one name an older build stored, filed under the stage it must have
// belonged to: the one that was open when it was written. It says which group
// without saying where, so that is the only stage it can be restored into — and
// only while nothing has been stored per stage yet, since after that this build
// has a better answer for every stage including that one.
export const openGroupsFrom = (
  stored: OpenGroups,
  legacy: string | null,
  stage: string | null,
): OpenGroups =>
  legacy === null ||
  legacy === '' ||
  stage === null ||
  Object.keys(stored).length > 0
    ? stored
    : { [stage]: legacy }

export function usePanelNav() {
  const [stored, setOpenPhase] = usePersistedString(OPEN_PHASE_STORE)
  const openPhase = openStageFrom(stored)
  const [groups, setGroups] = useState<OpenGroups>(() =>
    openGroupsFrom(
      readRecord<OpenGroups>(OPEN_GROUPS_STORE, {}),
      readStored(OPEN_GROUP_STORE),
      openStageFrom(readStored(OPEN_PHASE_STORE)),
    ),
  )

  const setGroupIn = (stage: string, name: string | null) => {
    const next: OpenGroups = { ...groups }
    if (name === null) delete next[stage]
    else next[stage] = name
    setGroups(next)
    writeJSON(OPEN_GROUPS_STORE, next)
  }
  const openAt = (phase: string, group: string) => {
    setOpenPhase(phase)
    setGroupIn(phase, group)
  }
  return {
    // Asked per stage rather than handed over as one name, because under a live
    // filter several stages are on screen at once and each carries its own fold.
    groupIn: (stage: string) => groupOpenIn(groups, stage),
    openPhase,
    openAt,
    toggleGroup: (stage: string, name: string) =>
      setGroupIn(stage, groupOpenIn(groups, stage) === name ? null : name),
    // Back to the map alone — what the × on the open stage's heading does, and
    // what Escape falls through to once it has nothing else to back out of.
    closePhase: () => setOpenPhase(null),
    // On the bench every stage is already on screen, so the map is an index
    // rather than a fold: a click marks where you are (and the bench scrolls
    // there) instead of unfolding one stage and closing another.
    jumpPhase: (name: string) => setOpenPhase(name),
    // Opening a stage opens a group too, so reaching a knob stays one click deep
    // rather than two: the one you left open in it, or its first if this is the
    // first time it has been opened. Through stageGroups rather than PHASES: the
    // B branch is opened by the same click and is not one of them.
    togglePhase: (name: string) => {
      const first = stageGroups(name)[0]
      if (openPhase === name) setOpenPhase(null)
      else if (first === undefined || groupOpenIn(groups, name) !== null)
        setOpenPhase(name)
      else openAt(name, first.name)
    },
  }
}

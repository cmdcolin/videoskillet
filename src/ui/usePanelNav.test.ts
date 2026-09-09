// The open stage survives a reload through one string, and that string has to
// answer for three kinds of stored value.
//
// A first session rests on the map alone: nothing unfolds itself, because a
// sidebar that opens a stage on every browser that has never stored the key — a
// fresh profile, a private window, another port in dev — puts a panel in front
// of the map for no reason the session asked for. The map's SOURCE A box is
// pressable with nothing patched in, so the picker is still one click away.
//
// The empty string is what an older build wrote for "closed on purpose", back
// when that had to be told apart from "never chosen" so that closing the stage
// did not re-open it on the next load. Both now mean closed, and the empty
// string is kept readable rather than kept meaningful.
//
// The third is a stage name that no longer renders, which is remapped rather
// than left to open a panel showing nothing.

import { describe, expect, it } from 'vitest'

import {
  CAMERA_LOOP_STAGE,
  CHANNEL_STAGE,
  SOURCE_A_STAGE,
  stageGroups,
} from './controls'
import { groupOpenIn, openGroupsFrom, openStageFrom } from './usePanelNav'

describe('the open stage, across a reload', () => {
  it('rests a first session on the map alone', () => {
    expect(openStageFrom(null)).toBeNull()
  })

  it('reads an older build’s "closed" the same way', () => {
    expect(openStageFrom('')).toBeNull()
  })

  it('reopens whatever stage was left open', () => {
    for (const name of [SOURCE_A_STAGE, 'Channel', 'Source B', 'Sound']) {
      expect(openStageFrom(name)).toBe(name)
    }
  })

  it('lands a stage that no longer exists somewhere that renders', () => {
    expect(openStageFrom('Feedback')).toBe(CAMERA_LOOP_STAGE)
  })
})

// And which group is open inside each stage, which used to be one name for the
// whole panel — so a trip to another stage and back landed on the stage's first
// group rather than on the one you left. Two things the record has to answer
// for: a name that no longer belongs to the stage it is filed under, and the
// single name older builds wrote, which says which group without saying where.

describe('the open group, per stage', () => {
  const first = stageGroups(CHANNEL_STAGE)[0].name
  const second = stageGroups(CHANNEL_STAGE)[1].name

  it('reopens the group that stage was left at', () => {
    expect(groupOpenIn({ [CHANNEL_STAGE]: second }, CHANNEL_STAGE)).toBe(second)
  })

  it('holds each stage’s fold apart from the others', () => {
    const groups = {
      [CHANNEL_STAGE]: second,
      [SOURCE_A_STAGE]: 'Signal (source A)',
    }
    expect(groupOpenIn(groups, CHANNEL_STAGE)).toBe(second)
    expect(groupOpenIn(groups, SOURCE_A_STAGE)).toBe('Signal (source A)')
  })

  it('rests a stage nobody has opened on nothing', () => {
    expect(groupOpenIn({}, CHANNEL_STAGE)).toBeNull()
  })

  // A group renamed, or moved to another stage, would otherwise fold every
  // section in the stage shut — a stage that opened onto nothing.
  it('forgets a group this stage no longer has', () => {
    expect(
      groupOpenIn({ [CHANNEL_STAGE]: 'Feedback' }, CHANNEL_STAGE),
    ).toBeNull()
    expect(groupOpenIn({ [CHANNEL_STAGE]: first }, SOURCE_A_STAGE)).toBeNull()
  })

  it('files an older build’s one name under the stage it was open at', () => {
    expect(openGroupsFrom({}, second, CHANNEL_STAGE)).toEqual({
      [CHANNEL_STAGE]: second,
    })
  })

  it('leaves it alone once this build has stored anything', () => {
    const stored = { [SOURCE_A_STAGE]: 'Signal (source A)' }
    expect(openGroupsFrom(stored, second, CHANNEL_STAGE)).toEqual(stored)
  })

  it('has nowhere to put it with no stage open', () => {
    expect(openGroupsFrom({}, second, null)).toEqual({})
  })
})

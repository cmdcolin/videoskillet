import { describe, expect, it } from 'vitest'

import {
  DECK_STAGE,
  FEED_A_GROUP,
  FEED_B_GROUP,
  GROUPS,
  LOOP_STAGE_NAMES,
  MOD_STAGE,
  PHASE_ORDER,
  SOUND_STAGE,
  SOURCE_B_STAGE,
  stageGroups,
  VIEW_STAGE,
} from './controls'
import { BOXES } from './diagramLayout'

// The card and the miniature are two drawings of one chain, and the card's box
// table is written out by hand where the miniature's comes off `place`. That is
// the arrangement MapBox was pulled out of: press behaviour drifted between the
// two, SOURCE B ended up live on one drawing and dead on the other, and nobody
// noticed because nothing compared them.
//
// Geometry is not the risk and is not checked here — a rect in the wrong place
// is visible the first time anyone opens the card. What is checked is the part
// that fails silently: a stage the panel has and the card forgot, a stage the
// card names and the panel does not have, and a box that opens onto nothing.
describe('the diagram card draws the chain the panel has', () => {
  // Everything openable, from the same tables the miniature is built from.
  const stages = [
    ...PHASE_ORDER,
    SOURCE_B_STAGE,
    SOUND_STAGE,
    VIEW_STAGE,
    MOD_STAGE,
    DECK_STAGE,
  ]

  it('names every stage of the chain, and no others', () => {
    expect([...new Set(BOXES.map(b => b.stage))].toSorted()).toEqual(
      stages.toSorted(),
    )
  })

  // A stage may take two boxes — a source and its feed — and no more. Both of
  // the pairs narrow to a group, which is what keeps the second from being a
  // second door onto the same thing.
  it('gives a stage one box, or a source and its feed', () => {
    for (const stage of stages) {
      const drawn = BOXES.filter(b => b.stage === stage)
      expect(drawn.length, stage).toBeLessThanOrEqual(2)
      if (drawn.length === 2)
        expect(
          drawn.filter(b => b.group !== undefined),
          stage,
        ).toHaveLength(1)
    }
  })

  it('narrows a feed box to a group that exists', () => {
    const groups = new Set(GROUPS.map(g => g.name))
    for (const box of BOXES)
      if (box.group !== undefined)
        expect(groups, box.label).toContain(box.group)
    // The two the drawing is shaped around, named so a rename of either lands
    // here rather than in a box that quietly opens its whole stage.
    expect(BOXES.map(b => b.group)).toContain(FEED_A_GROUP)
    expect(BOXES.map(b => b.group)).toContain(FEED_B_GROUP)
  })

  // Pressing a box puts that stage's controls on screen, so a box whose stage
  // has no groups is a door onto an empty room. The bay and the deck are the
  // exception by construction: neither is made of groups, and each hands the
  // panel its own body (stageBody.ts).
  it('opens every box onto something', () => {
    for (const box of BOXES) {
      if (box.stage === MOD_STAGE || box.stage === DECK_STAGE) continue
      expect(stageGroups(box.stage).length, box.label).toBeGreaterThan(0)
    }
  })

  it('leaves the loops off the box table — a run is their only door', () => {
    for (const loop of LOOP_STAGE_NAMES)
      expect(BOXES.map(b => b.stage)).not.toContain(loop)
  })

  // The free row is the drawing's one wordless statement: these two are patched
  // into the controls rather than into the signal, and the empty row is what
  // says so. A third box arriving on it without that being deliberate is the
  // failure this catches.
  it('floats the bay and the deck, and nothing else', () => {
    expect(
      BOXES.filter(b => b.free === true)
        .map(b => b.stage)
        .toSorted(),
    ).toEqual([DECK_STAGE, MOD_STAGE].toSorted())
    for (const box of BOXES)
      expect(box.free === true, box.label).toBe(box.row === 'free')
  })

  // Every box carries the sentence the legend under the drawing reads out. An
  // empty one is a row in that list with a name and nothing beside it.
  it('gives every box something to say', () => {
    for (const box of BOXES) expect(box.what, box.label).not.toBe('')
  })
})

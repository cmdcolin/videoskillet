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
import {
  B_JOIN_X,
  bJoin,
  BOX_H,
  BOX_W,
  BOXES,
  BRANCH_Y,
  colX,
  EXIT_RUN,
  exitHead,
  FREE_Y,
  H,
  head,
  LAST_COL,
  MID_Y,
  RETURNS,
  returnPts,
  SOUND_COL,
  SOUND_RISER,
  TOP,
  VIEW_RISER,
  W,
} from './diagramLayout'

import type { Box } from './diagramLayout'

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

// The card's geometry, which nothing checked. The miniature has had guards like
// these since it was written — every subset inside the drawing, no branch on top
// of another, every run's label clear of the wires over it — and the card, drawn
// by hand at a second scale, had none of them.
//
// Worth having now that both drawings route through wire.ts: a run is a list of
// points, so a test can read where a wire actually goes rather than parsing a
// string somebody typed.
describe('the diagram card stays inside its own drawing', () => {
  const rows = { a: MID_Y, trunk: MID_Y, b: BRANCH_Y, free: FREE_Y }
  const span = (box: Box) => ({
    left: colX(box.col) - BOX_W / 2,
    right: colX(box.col) + BOX_W / 2,
    top: rows[box.row] - BOX_H / 2,
    bottom: rows[box.row] + BOX_H / 2,
  })

  it('keeps every box inside the viewBox', () => {
    for (const box of BOXES) {
      const s = span(box)
      expect(s.left, box.label).toBeGreaterThanOrEqual(0)
      expect(s.right, box.label).toBeLessThanOrEqual(W)
      expect(s.top, box.label).toBeGreaterThanOrEqual(0)
      expect(s.bottom, box.label).toBeLessThanOrEqual(H)
    }
  })

  // Two boxes in one column on one row is what a `col` typo makes, and it draws
  // them exactly on top of each other — the one overlap that reads as a single
  // box rather than as a mistake.
  it('never puts two boxes in the same place', () => {
    const seen = new Set<string>()
    for (const box of BOXES) {
      const at = `${box.row}:${box.col}`
      expect([...seen], box.label).not.toContain(at)
      seen.add(at)
    }
  })

  it('leaves a gap between neighbours on a row', () => {
    for (const row of ['a', 'trunk', 'b', 'free'] as const) {
      const cols = BOXES.filter(b => b.row === row)
        .map(b => b.col)
        .toSorted((x, y) => x - y)
      for (let i = 1; i < cols.length; i++)
        if (cols[i] === cols[i - 1] + 1)
          expect(
            colX(cols[i]) - BOX_W / 2 - (colX(cols[i - 1]) + BOX_W / 2),
            row,
          ).toBeGreaterThan(0)
    }
  })

  // Every head's tip is on the edge of the thing it points at. This is what
  // could not be checked while a wire and its head were separate strings.
  const tipOf = (d: string): [number, number] => {
    const m = /L(-?[\d.]+) (-?[\d.]+)L/.exec(d)
    if (m === null) throw new Error(`no tip in ${d}`)
    return [Number(m[1]), Number(m[2])]
  }

  it('lands each head on the edge of what it points at', () => {
    expect(tipOf(head(bJoin))).toEqual([B_JOIN_X, MID_Y])
    expect(tipOf(head(SOUND_RISER))).toEqual([colX(SOUND_COL), TOP + BOX_H])
    // The view is the one fed *from* the chain, so its head is at the other end
    // of the same shape — the top of its own box, not the screen's.
    expect(tipOf(head(VIEW_RISER))).toEqual([
      colX(LAST_COL),
      BRANCH_Y - BOX_H / 2,
    ])
    // Off the right-hand edge, the one head with no box under it.
    expect(tipOf(exitHead(EXIT_RUN))).toEqual([W, MID_Y])
  })

  // Two risers between the same two rows, travelled in opposite directions —
  // which is the whole difference between something patched into the chain and
  // something the chain is delivered to, and the one thing on this row that
  // would be silently wrong if it were drawn backwards.
  it('runs the two risers between the same rows, opposite ways', () => {
    const ys = (pts: readonly (readonly [number, number])[]) =>
      pts.map(pt => pt[1])
    expect(ys(VIEW_RISER)).toEqual(ys(SOUND_RISER).toReversed())
    expect(ys(SOUND_RISER)).toEqual([BRANCH_Y - BOX_H / 2, TOP + BOX_H])
  })

  // Each return leaves the trunk, rides its own band and comes back down onto
  // it. A band that drifted under the trunk would draw a loop through the boxes.
  it('rides every return above the trunk and lands it back on it', () => {
    for (const r of RETURNS) {
      const pts = returnPts(r.from, r.to, r.y)
      expect(r.y, r.name).toBeLessThan(TOP)
      expect(r.y, r.name).toBeGreaterThan(0)
      expect(pts[0][1], r.name).toBe(TOP)
      expect(pts.at(-1)?.[1], r.name).toBe(TOP)
      expect(tipOf(head(pts)), r.name).toEqual([r.to, TOP])
    }
  })

  // The bands stacked over the trunk, each far enough from the next to carry
  // its own sentence. At the 18 they started on, two of them read as one
  // paragraph with a wire through it.
  it('keeps the bands apart', () => {
    const ys = RETURNS.map(r => r.y).toSorted((a, b) => a - b)
    for (let i = 1; i < ys.length; i++)
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(22)
  })

  // Spacing the bands is only half of it. Two names at the same x on adjacent
  // bands read as one two-line caption however far apart the wires are, which
  // is what the mixer loop and the delay loop did while both were drawn: both
  // landed on the mixer, so both took nameX(2), and neither wire owned either
  // line.
  it('gives each run its own column of text', () => {
    const xs = RETURNS.map(r => r.lx).toSorted((a, b) => a - b)
    for (let i = 1; i < xs.length; i++)
      expect(xs[i] - xs[i - 1], 'two run labels in one column').toBeGreaterThan(
        20,
      )
  })

  // And a name belongs to the wire it names: it starts (or ends) within reach
  // of its own run rather than somewhere past the end of it. What this was
  // written for: the delay loop's sat 30 units beyond the right end of a
  // 52-unit run.
  it('keeps each run’s name against its own run', () => {
    for (const r of RETURNS) {
      const [lo, hi] = [Math.min(r.from, r.to), Math.max(r.from, r.to)]
      const reach = r.anchor === 'end' ? lo - r.lx : r.lx - hi
      expect(reach, r.name).toBeLessThanOrEqual(12)
    }
  })
})

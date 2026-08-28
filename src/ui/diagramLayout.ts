import {
  CHANNEL_STAGE,
  DECK_BLURB,
  DECK_STAGE,
  FEED_A_GROUP,
  FEED_B_GROUP,
  LOOP_STAGES,
  MIX_STAGE,
  MOD_BLURB,
  MOD_STAGE,
  OFF_HINT,
  PHASES,
  SOUND_BLURB,
  SOUND_STAGE,
  SOURCE_A_STAGE,
  SOURCE_B_BLURB,
  SOURCE_B_STAGE,
  VIEW_BLURB,
  VIEW_STAGE,
} from './controls'
import { arrowhead, route } from './wire'

import type { Point } from './wire'

// Where every part of the diagram card sits, and what each box is — the card's
// half of the split ChainMap and chainLayout already make on the miniature:
// this file is the arithmetic and the tables, SignalPathDialog.tsx is the
// drawing. Splitting them is also what lets the box table be tested
// (diagramLayout.test.ts) without the test importing a component, and what
// keeps a constant out of a module fast refresh wants to hold components only.
//
// The path drawn at a size that can carry it. The sidebar's miniature has room
// for the trunk, its branches and the three runs over the top, and nothing
// else, so what it cannot say is exactly what the second input made worth
// saying: that each source has a feed of its own before the mixer, and what
// each loop actually does rather than only which is which.
//
// Left to right, like the miniature — same drawing, unfolded — so opening this
// teaches the map rather than replacing it. Every box opens the panel where its
// controls are, which is what keeps it a diagram of *this app* rather than an
// illustration of NTSC.
export const W = 660
// The trunk sits low enough for three loop runs to stack above it at the 22
// units apart their labels need. A box each would have been the obvious way to
// give the loops their own targets and it costs a column apiece; the loops earn
// their room vertically, where there was nothing but wire, rather than
// horizontally, where there is none — and dropping the box they used to share
// gave a column back.
export const H = 180
export const GUTTER = 14
const GAP = 14
export const MID_Y = 92
export const BRANCH_Y = 128
// The free row, under the branches: the boxes nothing is wired to. Parked among
// the wired boxes, a box with no wire has to be read as deliberate against a row
// full of wires, and there is only ever one gap wide enough to be that
// convincing. On a row of their own the emptiness is the row.
//
// The miniature carries the same row, at its own scale (chainLayout's FREE_Y).
// It went without one for a while — the two boxes were html chips under the svg,
// because at 304 units wide a row is the scarcest thing that drawing has, and 20
// of them bought its boxes a hittable height — and what brought the row back is
// that a chip is set in the panel's type inside a picture set in the map's. This
// drawing never had that problem: 180 units tall, with the room to say it the
// way it is said here. What must not differ between the two is whether pressing
// a box opens the stage, and that lives in MapBox for both.
export const FREE_Y = 164
export const BOX_H = 22
// What a caption costs per character here, for the cut `fitCaption` makes. The
// miniature measured 3.6 at 7px (chainLayout's SUB_CHAR) and this card sets the
// same text at 8.5 against an 11px label, so the estimate scales with the type.
// A box on this drawing is 92 units against the miniature's 50, so a name that
// was cut to two words there arrives whole here — which is the card doing what
// the card is for.
export const SUB_CHAR = 4.4
// Both sides together, as the miniature's PAD is.
export const SUB_PAD = 10
export const HEAD = 3
export const TURN = 5

// Six columns: A's two boxes, then the trunk's four. B's two sit under the
// first two, which is where a source and its feed belong on either row; the
// sound sits under the receiver, the one stage it is patched into; and the view
// sits under the screen, which is what feeds it. The lower row is therefore not
// "input B's row" but everything wired to one stage rather than passing along
// the trunk — and the arrowheads say which way each of them goes.
//
// It was seven while a FEEDBACK box stood between Mix and Tape. Nothing was
// removed from the drawing when it went — the three loops it stood for are
// still here, drawn where they actually re-enter — and every remaining box got
// 15% wider for it.
const COLS = 6
const STEP = (W - GUTTER - 10) / COLS
export const BOX_W = STEP - GAP
export const colX = (i: number) => GUTTER + STEP * (i + 0.5)
export const TOP = MID_Y - BOX_H / 2

// Which band a box sits on. The branches and the free row are the two that are
// not the trunk, and they are the only thing `row` decides.
export const rowY = (row: Box['row']) =>
  row === 'b' ? BRANCH_Y : row === 'free' ? FREE_Y : MID_Y

// What each box is and what opening it should show. `stage` is the panel stage
// it belongs to; `group` narrows to one module inside it, which is how the two
// feeds get boxes of their own without being stages.
export interface Box {
  label: string
  stage: string
  group?: string
  col: number
  row: 'a' | 'b' | 'trunk' | 'free'
  what: string
  // Nothing is drawn to this box, because it is not in the path: the modulation
  // bay acts on the controls rather than on the signal, and the deck is those
  // same controls gathered by the gesture that moves them. Both sit on the free
  // row, and the space around them is the whole of what says so — same decision
  // as the miniature's (chainLayout.ts, FreeBox).
  free?: true
}

const phaseBlurb = (name: string) =>
  PHASES.find(p => p.name === name)?.blurb ?? ''

// Hand-laid, because six columns and four rows is a drawing rather than a
// solve. What it must not do is name a stage the panel does not have, or miss
// one it does — diagramLayout.test.ts checks it against the same tables the
// miniature is built from, which is the drift MapBox was pulled out to stop
// happening to the press behaviour.
export const BOXES: Box[] = [
  {
    label: 'Source A',
    stage: SOURCE_A_STAGE,
    col: 0,
    row: 'a',
    what: phaseBlurb('Source A'),
  },
  {
    label: 'Feed A',
    stage: SOURCE_A_STAGE,
    group: FEED_A_GROUP,
    col: 1,
    row: 'a',
    what: 'input A’s own deck, cable and head-end, ahead of the mixer — damage here lands on this signal alone. Two groups: what the deck did to the tape, and what the wire out of it did after',
  },
  {
    label: 'Source B',
    stage: SOURCE_B_STAGE,
    col: 0,
    row: 'b',
    what: SOURCE_B_BLURB,
  },
  {
    label: 'Feed B',
    stage: SOURCE_B_STAGE,
    group: FEED_B_GROUP,
    col: 1,
    row: 'b',
    what: 'the same deck and cable faults again on input B’s own feed, in the same order — so the two signals arrive at the mixer damaged differently and the difference is what the rig reacts to',
  },
  {
    label: 'Mix',
    stage: MIX_STAGE,
    col: 2,
    row: 'trunk',
    what: phaseBlurb(MIX_STAGE),
  },
  {
    label: CHANNEL_STAGE,
    stage: CHANNEL_STAGE,
    col: 3,
    row: 'trunk',
    what: phaseBlurb(CHANNEL_STAGE),
  },
  {
    label: 'Receiver',
    stage: 'Receiver',
    col: 4,
    row: 'trunk',
    what: phaseBlurb('Receiver'),
  },
  {
    label: 'Screen',
    stage: 'Screen',
    col: 5,
    row: 'trunk',
    what: phaseBlurb('Screen'),
  },
  // The one box that is not a signal on its way to the glass: sound, patched
  // into the set. It sits under the receiver rather than at the head of a row
  // because that is where every one of its routings lands, and the diagram is
  // the place with room to say so.
  {
    label: 'Sound',
    stage: SOUND_STAGE,
    col: 4,
    row: 'b',
    what: SOUND_BLURB,
  },
  // The end of it, and the only box that is not the rig: where the picture is
  // watched from. Under Screen, because that is what feeds it.
  {
    label: 'View',
    stage: VIEW_STAGE,
    col: 5,
    row: 'b',
    what: VIEW_BLURB,
  },
  // And the two boxes wired to nothing at all, on the middle two columns of a
  // row of their own: what either is patched into is every control in every
  // other box, which is a line to two hundred sliders and therefore no line at
  // all. The pair is centred rather than anchored, because there is nothing here
  // for a column to mean.
  {
    label: 'Deck',
    stage: DECK_STAGE,
    col: 2,
    row: 'free',
    what: DECK_BLURB,
    free: true,
  },
  {
    label: 'Modulation',
    stage: MOD_STAGE,
    col: 3,
    row: 'free',
    what: MOD_BLURB,
    free: true,
  },
]

// The last trunk column, which the run out of the drawing leaves from and the
// camera loop taps — and the receiver's, which the sound climbs into. Named
// because losing the FEEDBACK column shifted every trunk index by one, and a
// literal 5 meant two different boxes on either side of that change.
export const LAST_COL = 5
export const SOUND_COL = 4

// Where each run leaves, where it lands, and which band it rides. Split from
// LOOP_STAGES because this half is geometry and that half is what the loop *is*
// — the panel and the miniature need the second and have no use for the first.
interface LoopRun {
  from: number
  to: number
  y: number
  turn: number
  // Where the name sits, and which end of itself it sits by — so a label can
  // hang off the left of a run as well as the right.
  lx: number
  anchor: 'start' | 'end'
  optical: boolean
}
// Just past the right edge of a landing column: where a run that reaches back
// across the drawing puts its name, beside its own arrowhead.
const nameX = (col: number) => colX(col) + BOX_W / 2 + 10

// How far past the mixer's own edges the tape loop's two ends sit. It leaves
// the bus and returns to it at the same node, so it straddles that box rather
// than landing on it twice — a machine patched across one point, which is what
// a tape loop is.
const STRADDLE = 26
const LOOP_RUN: Record<(typeof LOOP_STAGES)[number]['loop'], LoopRun> = {
  // The one run that reaches back past the decoder: it shoots the glass, so it
  // taps after the Screen, and what it returns is a picture rather than a
  // waveform — which is why it re-enters at the head of the chain, ahead of the
  // encoder, and not on the bus with the other two.
  camera: {
    from: colX(LAST_COL),
    to: colX(0),
    // The top run's name sits 5 above it and rises 7 more; below 16 the
    // ascenders are cut off by the top of the viewBox.
    y: 16,
    turn: 6,
    lx: nameX(0),
    anchor: 'start',
    optical: true,
  },
  // Off the bus and back onto it one pass later, so it taps at the Receiver —
  // what goes round is the composite the decoder saw.
  mixer: {
    from: colX(4),
    to: colX(2),
    y: 38,
    turn: 5,
    lx: nameX(2),
    anchor: 'start',
    optical: false,
  },
  // Both ends on the mixer's own box top, wide enough to clear the mixer loop's
  // single arrowhead at its centre — so three verticals on one box top still
  // read as a pair and a single.
  //
  // Its name goes off the *left* end of that straddle, and the side is the
  // whole point. It used to start at nameX(2) like the mixer's: 30 units past
  // the right end of the run it names, and at the identical x, 22 units under
  // another loop's name. Two captions in one column over two different wires
  // read as one two-line block, and neither wire owned either line.
  //
  // The miniature had this right — its three names each ride or abut their own
  // run — and this drawing said it did ("they no longer share one column of
  // text") while both of these landed on col 2, because both loops land on the
  // mixer. Sharing a box is exactly why they must not share a column.
  tape: {
    from: colX(2) + STRADDLE,
    to: colX(2) - STRADDLE,
    y: 60,
    turn: 5,
    lx: colX(2) - STRADDLE - 6,
    anchor: 'end',
    optical: false,
  },
}

// The three loops, each one its own button and its own stage. They were one box
// before — 'Feedback', standing on the trunk between Mix and Tape — and that
// box was the drawing's one lie: the three do not re-enter at the same place,
// so no single node could be where they land. The pass graph is what settled
// it (gpu/pipeline.ts): the camera comes back at `compose`, ahead of the
// encoder, which is inside Source A; the mixer at `fbComposite` and the loop
// bin at `tapePlay`/`tapeRec`, both straight after the A/B sum, which is Mix.
//
// So the wires are the whole of it now, which is what they had already become:
// dashed for light and solid for a wire, each with its own name, each lighting
// up while its loop runs. Making them the door as well costs the drawing no
// width — a box for each would have cost three columns — and it is what let the
// trunk drop from five boxes to four.
//
// Each label sits in the band above its own run, so the runs are what separate
// them — 22 units apart, because at the 18 they started on, two sentences read
// as one paragraph with a wire through it. `lx` is measured from the box the
// run lands on, so a name sits beside its own arrowhead.
//
// `from` and `to` are absolute, not column indices, because the delay loop is not
// a run around the chain at all: it leaves and re-enters the same box top, a
// second machine patched across one node, while the other two reach back from
// the stage they actually tap.
export const RETURNS = LOOP_STAGES.map(l => ({ ...l, ...LOOP_RUN[l.loop] }))

// What an inert box says instead of its blurb, off the one table both drawings
// read (controls.ts). It used to be written out here as well, and the two copies
// had already drifted — this one still sent you to an `Input` section that no
// longer exists. A feed box carries its own source's stage, so Feed B answers
// with B's hint without a case of its own.
export const deadHint = (box: Box) => OFF_HINT[box.stage] ?? ''

// The three states a box wears, named. Read in the order a session meets them:
// most boxes are plain, one goes amber the first time you move anything, and
// the two on the bottom row are dotted from the start. The dashed inert state
// is left off — a box only wears it while the branch above it is already saying
// what is missing, and a fourth row would make the key as long as the thing it
// is a key to.
export const KEYS: readonly {
  state?: 'nodeTouched' | 'nodeFree'
  say: string
}[] = [
  { say: 'a stage of the chain — click it for its controls' },
  {
    state: 'nodeTouched',
    say: 'holding an edit, and • counts how many controls',
  },
  { state: 'nodeFree', say: 'patched into the controls, not the signal' },
]

// Up off the trunk, along its own band, and back down onto it.
export const returnPts = (from: number, to: number, y: number): Point[] => [
  [from, TOP],
  [from, y],
  [to, y],
  [to, TOP],
]

export const returnPath = (from: number, to: number, y: number, turn: number) =>
  route(returnPts(from, to, y), turn)

// A wire on this drawing, and the head on the end of one. Every path the card
// draws goes through these, so the corner radius and the head belong to the
// drawing rather than to each call site.
export const wire = (pts: Point[]) => route(pts, TURN)

// Two head lengths, and the difference between them is deliberate rather than
// left over. LAND is what a wire arriving at a box wears; EXIT is the signal
// leaving the drawing at the right-hand edge — the one head with no box under
// it, which wants the extra reach to read as an ending. Both were written out
// per call site, which is how each drawing ended up with two ratios and a name
// for neither.
const LAND = HEAD * 1.6
const EXIT = 8

export const head = (pts: Point[]) => arrowhead(pts, LAND, HEAD)
export const exitHead = (pts: Point[]) => arrowhead(pts, EXIT, HEAD)

// The four runs that are the same points every render, named once so the
// drawing and the head on it cannot be given different ones.
//
// Each ends where its head's tip goes: the wire runs the last few units under
// the arrow rather than stopping short of it, which is what the miniature's
// branches already did and what lets one list serve both.

// B's feed up into the trunk. Where it joins is not a choice — feedA / feedB →
// mixB — so it meets the run between Feed A and the mixer.
export const B_JOIN_X = (colX(1) + colX(2)) / 2
export const bJoin: Point[] = [
  [colX(1) + BOX_W / 2, BRANCH_Y],
  [B_JOIN_X, BRANCH_Y],
  [B_JOIN_X, MID_Y],
]

// Up into the receiver, which is the one stage the sound is patched into.
export const SOUND_RISER: Point[] = [
  [colX(SOUND_COL), BRANCH_Y - BOX_H / 2],
  [colX(SOUND_COL), TOP + BOX_H],
]

// The same riser under Screen, read the other way — the chain is delivered to
// the view rather than fed from it. Reversing SOUND_RISER's shape is the whole
// difference, and writing it as a reversal is what says so.
export const VIEW_RISER: Point[] = [
  [colX(LAST_COL), TOP + BOX_H],
  [colX(LAST_COL), BRANCH_Y - BOX_H / 2],
]

// Off the right-hand edge: the picture leaving the drawing.
export const EXIT_RUN: Point[] = [
  [colX(LAST_COL) + BOX_W / 2, MID_Y],
  [W, MID_Y],
]

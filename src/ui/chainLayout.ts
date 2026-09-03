import {
  CAMERA_LOOP_STAGE,
  LOOP_STAGES,
  MIX_STAGE,
  MIXER_LOOP_STAGE,
  SOURCE_A_STAGE,
} from './controls'
import { fitCaption } from './patched'
import { arrowhead, route } from './wire'

import type { LoopPlace } from './controls'
import type { Point } from './wire'

// The chain map's arithmetic, with none of its markup (see ChainMap.tsx for the
// drawing). Its own module because every bug it has shipped has been in this
// arithmetic rather than in the elements: an empty chain divided the width by
// zero and wrote `NaN` into every attribute, which the browser drops; a
// one-stage chain divided it by one and drew a 280px bar where a miniature
// belongs. Neither is visible to a test that renders the component and counts
// elements — both are one assertion away from a function that returns numbers
// (chainMap.test.ts).
//
// **The app only ever asks for the whole trunk.** It used to hand over whatever
// a live filter had left standing, which is where the two bugs above came from;
// a query dims the boxes it did not reach now and removes none of them
// (panelChain), and `PHASES.map` is the only thing that builds the list. So
// every subset branch below — `fit` under 1, the gap clamps, the `at() < 0`
// fallbacks, the cursor that pushes one branch off another — computes the same
// answer on every render today.
//
// It is kept general anyway, and that is a decision rather than an oversight:
// the arithmetic is a few lines, the subset tests are what pin the live row's
// proportions as well (a box is never stretched past its label on *any* row,
// including this one), and the shape that made those bugs possible is a design
// choice one commit could take back. What is not kept is a comment claiming the
// filter still does it — see each of them below for which case is live.
//
// The self-return branches are a step further out than that. `RETURNS` has held
// two long returns and no self loop since the delay loop was cut, so `r.self`
// is false everywhere: the straddle, the two-sided label choice and the `W`
// wall are unreached rather than merely constant, and the subset tests that pin
// the rest of this file walk straight past them. They stay because a machine
// patched across one node is a shape this map should be able to draw, and they
// are marked below so nobody reads them as a description of what is on screen.
//
// The svg stretches to its container, so every size here is really a ratio — but
// the units are px at the sidebar's width, so the labels come out at the size
// they say.
export const W = 304
// The band above the trunk holds the loops, and it grew from 18 units to 36 so
// each of them can carry its own name. Two unlabelled runs 8 apart said there
// were two loops and nothing about which; a hover said the rest, which is an
// answer you have to already suspect the question of. The whole map costs 18
// more units of sidebar — about 18 screen px at the panel's width — and it is
// the same 18 that let the third loop in, so the miniature stops disagreeing
// with the full diagram about how many there are.
//
// Under the branches is the free row, which left the drawing for a while and is
// back — see FREE_Y. It went out to buy the trunk and branch rows a hittable
// box height (16 units to 22), and what paid for it the second time is that the
// row of html chips it became cost the panel about as much height as the row
// costs the svg, while being the one thing in the map's own picture set to the
// panel's type rather than the map's. One drawing, one scale.
export const H = 130
// Gap between boxes — the run each wire has to cross — and how far one opens
// when a filter leaves the row with room to spare.
export const GAP = 10
export const GAP_MAX = 26
// The stubs the signal arrives and leaves on, so the chain reads as something
// fed and something delivered rather than a row of stages that begins nowhere.
export const LEAD = 8
export const OUT = 10
export const MID_Y = 47
// The branch row, under the trunk: input B at its head and the sound under the
// receiver, both joining from below.
export const BRANCH_Y = 81
// The free row, under the branches: the boxes nothing is wired to. Same 34
// units below its neighbour that the branch row sits below the trunk, so the
// three rows are one rhythm and the gap under the last wire is not read as the
// drawing having ended. Nothing is drawn to these boxes and nothing needs to
// be: on a row of their own with no wire on it, the emptiness is the row — the
// argument the full card has always made (SignalPathDialog's own FREE_Y).
export const FREE_Y = 115
// Taller than the 13 the map shipped with, and than the 16 that replaced it: at
// 16 units a box is 17.5 screen pixels at the sidebar's width, and a target is
// meant to be 24. This is 22, which is 24px at 332 — and it is why MID_Y and
// BRANCH_Y moved with it. See ChainMap.module.css for the other half.
//
// MID_Y moved by exactly the growth, so `MID_Y - BOX_H / 2` is still 36 and the
// runs above the chain are untouched: they still ride at 7 and 18 and still
// drop 7 units onto the trunk. The band over the chain was never the part
// short of room, and re-tuning it would have been change for its own sake.
export const BOX_H = 22
// Half-width of a wire's arrowhead.
export const HEAD = 2.5
// Corner radius on a routed wire.
export const TURN = 4

// What a label costs, per uppercase character. Still measured at 8px while the
// labels are set at 9 (.mapLabel), and deliberately: raising it widens every
// box, which walks the head of the chain to the right and moves the gaps a run
// label is fitted into — so a purely typographic change would move type the
// layout had already placed. The estimate has room to absorb this. The widest real label runs 5.07 units a
// character at 8px, so 5.70 at 9px, and 'RECEIVER' is 45.6 of the 51.2 its box
// asks for — less breathing room than PAD promises and still not a squeeze.
//
// Measured in Firefox against .mapLabel's own rules (system-ui, .02em):
// the widest real label averages 5.07 units a character and a lone 'A' costs
// 5.28, so 5.4 buys slack on a platform whose system font is wider than this
// one's. It only has to be *proportionally* right in any case — `fit` below
// scales the whole row to the width available, so a generous estimate spends
// padding rather than overflowing the map.
const CHAR = 5.4
// Breathing room inside a box, both sides together.
const PAD = 8
// A short label still needs to read as a box rather than a dot on the wire.
const MIN_BOX = 20

// The same estimate for a run's label, which is a different number because it
// is different type: 7.5px and lowercase against the boxes' 8px uppercase (see
// .mapLoopLabel and .mapLabel).
//
// A flat average per character will not do here, where CHAR gets away with one.
// A box is *sized* from its estimate, so being 20% over on one name only buys
// that box padding; a run's label is sized by nothing and measured against a
// gap it has to fit in, so the same 20% is the difference between a label that
// clears the drop of the run above it and one written across that wire. Measured
// in Firefox, the labels run 3.78 to 4.51 units a character, and the whole of
// that spread is one letter: 'm' is about twice the width of the average glyph
// and 'camera' is a sixth m.
//
// So count those two twice and the spread closes to 3.47-4.08, which 4.15
// clears by the margin CHAR keeps over its own measurement. Still deliberately
// over rather than under: an over-estimate spends clearance a label did not
// need, an under-estimate writes it across a wire.
const RUN_CHAR = 4.15
const WIDE = /[mw]/g
// Exported for the test that holds a label clear of the wires over it: it has
// to measure what the layout measured, or it is checking a second estimate.
export const runLabelWidth = (s: string) =>
  (s.length + (s.toLowerCase().match(WIDE)?.length ?? 0)) * RUN_CHAR

// The chip a run's name rides, which is the whole of the run's own box: a loop
// has no place on the trunk to stand one, so this is what makes it look like
// the door it is rather than a word laid over a hairline. Padding either side
// of the name, as PAD is to a box's, and a height that is what the band can
// spare — the runs ride 11 apart, so two chips on neighbouring bands meet edge
// to edge at 11 and would overlap at anything more.
export const RUN_PAD = 7
export const RUN_H = 11
export const runChipWidth = (s: string) => runLabelWidth(s) + RUN_PAD

// Boxes are sized to what they say rather than to an equal share of the width.
// That is what let a sixth box onto the row back when the trunk had six: at
// equal columns RECEIVER got 38 units for 37 units of text while TAPE sat in
// the same 38 with 19. MIX asks for half of what RECEIVER does, and giving the
// difference back is what buys the shorter names their padding.
export const boxWidth = (name: string) =>
  Math.max(MIN_BOX, name.length * CHAR + PAD)

// A caption's cost per character: 7px mixed case against the label's 9px caps
// (.mapSub), with the same doubling of m and w that a run's label needs — a
// caption is a filename as often as it is a word, so the spread between 'iiii'
// and 'wwww' is real rather than theoretical.
//
// Measured off the rendered map in Firefox: 'Color bars' comes out at 3.20 units
// a character and 'Minnie th…', which is most of the wide glyphs there are, at
// 3.60. This is that worst case *before* the doubling, so the estimate keeps
// about a tenth in hand on real text. Held tighter than CHAR is, and for the
// opposite reason: a box is sized from CHAR, so a generous estimate there buys
// padding, while a caption is cut to fit a box that is already placed — every
// unit of slack here is a character of someone's filename that goes missing.
const SUB_CHAR = 3.6

// A caption cut to this map's boxes. The cutting is `fitCaption` (patched.ts),
// which the card shares; what is the miniature's own is the two numbers — its
// box padding and the size its captions are set at.
export const fitSub = (text: string, boxW: number) =>
  fitCaption(text, boxW - PAD, SUB_CHAR)

// The two feedback returns, which are different loops around different parts of
// the chain — not one arrow drawn twice, and not two arrows landing on one box
// either. That is what the drawing used to say, because a 'Feedback' stage sat
// on the trunk and both re-entered *it*; the pass graph says otherwise
// (gpu/pipeline.ts), and the difference is the whole reason the two are worth
// telling apart:
//
//   camera — optical, and the only one that reaches back past the decoder: it
//     shoots the tube's face, so it taps after the Screen, and `compose` mixes
//     it in ahead of the encoder — which is inside Source A, before this signal
//     is a composite waveform at all.
//   mixer — electrical: `fbComposite` crossfades the bus against itself
//     straight after the A/B sum, so it re-enters at Mix, and it taps at the
//     Receiver because what goes round is the composite the decoder saw.
//
// Each is routed rather than swooped — up, back along its run, then straight
// down into the stage it feeds, so the wire is vertical where the arrowhead
// sits, which is the only way the two agree.
//
// `self` is a field rather than a special case because a return can also tap
// the box it re-enters — a machine patched *across* one node, which the delay
// loop was until it was cut. Nothing sets it now, so the filter and label rules
// it selects are the unreached ones the header marks.
//
// The camera return is drawn dashed and the mixer's solid, the way a
// schematic separates a light path from a wire. That was once the *whole*
// difference between them here, which is why the map used to be the one place
// both were visible and still could not say which was which: a hover carried
// the names, and a hover is an answer you have to already suspect the question
// of. Each now carries its own name on its own run — the stage's own name off
// LOOP_STAGES, cut down to `short` on a run too narrow to hold it — and lights
// up while its own loop is actually running, so "which loop is on" is answered
// here rather than by opening a stage and reading two mixes.
//
// And each is the way into its own stage: a run is the box for a machine that
// has no place on the trunk to draw one.
interface ReturnSpec {
  // The stage it taps — where the wire leaves the chain. Named `tap` and not
  // `from` because the layout below hands back a `from`, and that one is the
  // x it leaves at: a spec is stage names and an output is coordinates.
  tap: string
  // The stage it re-enters — where the arrowhead lands.
  into: string
  loop: LoopPlace
  // The panel stage the run opens.
  stage: string
  optical: boolean
  // Which band it rides, and the corner radius at that height.
  y: number
  turn: number
  // A return whose two ends are the same box, drawn straddling it — see
  // SELF_STRADDLE. The other two land on the centre of what they tap and what
  // they re-enter, so they need no offsets at all.
  self: boolean
}

// How far outside its box a self loop's two ends sit — unreached while RETURNS
// holds none, and kept for the reason the header gives. MIX is the narrowest
// box on the row, and stacking a self loop's pair on its top edge beside the
// mixer loop's single arrowhead put three verticals inside 16 units of a
// 24-unit box: a knot rather than three wires. Straddling the box says the same
// thing better — a machine patched *across* one node — and it leaves the mixer
// loop alone on the box top. Comfortably inside GAP, so the
// ends stay on the runs either side and never reach the next box.
const SELF_STRADDLE = 5

const RETURNS: readonly ReturnSpec[] = [
  {
    tap: 'Screen',
    into: SOURCE_A_STAGE,
    loop: 'camera',
    stage: CAMERA_LOOP_STAGE,
    optical: true,
    y: 7,
    turn: 4,
    self: false,
  },
  {
    tap: 'Receiver',
    into: MIX_STAGE,
    loop: 'mixer',
    stage: MIXER_LOOP_STAGE,
    optical: false,
    y: 18,
    turn: 4,
    self: false,
  },
]

// What each run carries, off the one loop table, so the map cannot name a loop
// something the panel does not call it. `short` rather than the stage's whole
// name: the miniature is 304 units wide with the runs stacked over the chain,
// and each is named for its own machine — so the machine is the word that tells
// them apart and the rest is what the band they ride already says. The card has room for the whole name and uses it.
//
// Drawn in lowercase, which is a CSS rule (.mapLoopLabel) rather than a second
// spelling here — the boxes have upper-cased their names the same way since the
// map was one row of five.
//
// Falls back to the placement key: a loop added to RETURNS and not to
// LOOP_STAGES draws its own name rather than a blank.
const shortOf = (loop: LoopPlace): string =>
  LOOP_STAGES.find(l => l.loop === loop)?.short ?? loop

// Up off the trunk, along its own band, and back down. `turn` is the corner
// radius, carried per run rather than shared: a tighter band wants a smaller
// one than the 4 both of the long returns take.
export const returnPts = (
  from: number,
  to: number,
  top: number,
  y: number,
): Point[] => [
  [from, top],
  [from, y],
  [to, y],
  [to, top],
]

export const returnPath = (
  from: number,
  to: number,
  top: number,
  y: number,
  turn: number,
) => route(returnPts(from, to, top, y), turn)

// A box on the map: where it sits and how wide its own name made it.
interface ChainBox {
  name: string
  x: number
  w: number
}

// A branch the caller wants drawn: something wired to one trunk stage rather
// than passing along the trunk. Three of them — input B, which joins at the
// mixer, the sound, which joins at the receiver, and the view, which is fed by
// the screen. `free?: never` is what makes the union below discriminate on a
// field only one arm has: without it a spec carrying `free: true` and a stray
// `join` would still be a WiredBranch, which is the mistake the split is for.
export interface WiredBranch {
  name: string
  // The trunk stage its wire runs to.
  join: string
  // Where its own box sits on the branch row. 'head' is under the head of the
  // trunk, sharing its left edge: the two inputs read as a column, which is the
  // whole point of drawing B there rather than beside the stage it feeds.
  // 'join' is directly under that stage, which is the only honest place for
  // something wired to one stage and nothing else — it meets the trunk where it
  // meets it, and the wire is a riser rather than a run along the row.
  under: 'head' | 'join'
  // Which way the signal goes, which is the whole difference between the two
  // inputs and the view. Both are drawn on the same row with the same wire; the
  // arrowhead is what says one is patched *into* the chain and the other is fed
  // *by* it. Without it the View box reads as a third source, which is the one
  // thing it is not. Defaults to 'in'.
  dir?: 'in' | 'out'
  free?: never
}

// A box on the map that nothing is drawn to: no lead in, no run up into the
// trunk, no arrowhead. It is a stage of the *panel* that is not part of the
// chain at all — the modulation bay, which acts on the controls rather than on
// the signal, and the deck, which is those same controls reached by the gesture
// that moves them rather than by where they sit.
//
// It carries a name and nothing else, and that is the point of splitting the
// type: the two fields a branch cannot do without are `join` and `under`, and
// both are questions with no answer here. The bay used to carry a `join` that
// meant "park under this one", which is a placement dressed up as a connection —
// the kind of field the next reader has to be told twice is a lie.
//
// Parking one in the gaps of the branch row is what does not work: there, a box
// with no wire has to be read against every wire around it, and the gap has to
// be wide enough to be convincingly deliberate. On a row of its own the
// emptiness is the row, which is why `freeRow` below places them there and why
// the full card does the same.
export interface FreeBox {
  name: string
  free: true
}

// What the panel can hang under the trunk: something wired to a stage, or
// something wired to nothing. Both reach the map — the wired ones through
// `chainLayout`, which has wires to route, and the free ones through `freeRow`,
// which has none.
export type BranchSpec = WiredBranch | FreeBox

// The free row: boxes wide enough for their labels, left to right from the
// trunk's own left edge, with the row's gap between them. No fit pass and no
// stretching — this row is two short boxes in a 304-unit width, so the crowding
// the trunk has to be scaled out of cannot arise here. If it ever does (a third
// box, a longer name), it overflows visibly rather than silently, which is the
// failure worth having.
export const freeRow = (names: string[]): ChainBox[] => {
  let x = LEAD
  return names.map(name => {
    const w = boxWidth(name)
    const box = { name, x: x + w / 2, w }
    x += w + GAP
    return box
  })
}

// A branch's box and the run out of it. Same routing vocabulary as the returns —
// orthogonal with a rounded corner — so the wires that come from below read as
// the same kind of thing as the two that come from above.
interface ChainBranch extends ChainBox {
  // Where the wire turns up into the trunk: the centre of the box it joins.
  join: number
  // Where the wire *into* this box starts. An input arrives from off the left
  // edge like the trunk does; something wired to one stage arrives on a stub of
  // its own, so its lead-in cannot be read as a second signal running the length
  // of the row. An 'out' branch has no lead of its own — nothing arrives at it
  // from anywhere but the trunk — so its stub sits on its own box edge and draws
  // nothing.
  stub: number
  dir: 'in' | 'out'
  // Which row it sits on. One row again now that the free boxes have left the
  // drawing, but the drawing still reads it from here rather than reaching for
  // BRANCH_Y itself — "which row is this on" is answered where the x it goes
  // with is worked out.
  y: number
}

// The head on a branch's wire, off the wire's own points — so it cannot end up
// pointing along a routing the wire did not take. It used to re-derive which of
// branchPts' three cases applied, from the same three conditions, in a second
// place.
//
// Direction is the whole statement on this row: an 'in' branch is fed into the
// chain and points at the trunk box it joins, an 'out' branch is fed from it
// and points back at its own box. Which is the wire read backwards, and nothing
// more than that.
export const branchHead = (b: ChainBranch): string => {
  const pts = branchPts(b)
  return arrowhead(b.dir === 'in' ? pts : pts.toReversed(), HEAD * 1.5, HEAD)
}

// A branch's run: out of its box, along its own row, then up into the box above
// the join. Degenerates to a straight riser when the join is directly above,
// which is what a 'join'-anchored branch normally wants — the sound and the view
// both take it. Routes left as well as right because a crowded row can push a
// box past the stage it feeds; on the full trunk nothing is that crowded, and B
// is the only branch that takes the routed arm at all.
export function branchPts(b: ChainBranch): Point[] {
  const top = MID_Y + BOX_H / 2
  const right = b.x + b.w / 2
  const left = b.x - b.w / 2
  // Out of the side the join is on, along the branch row, then up. The riser is
  // the common case and the only one the full trunk ever draws — see above.
  if (b.join > right + TURN)
    return [
      [right, BRANCH_Y],
      [b.join, BRANCH_Y],
      [b.join, top],
    ]
  if (b.join < left - TURN)
    return [
      [left, BRANCH_Y],
      [b.join, BRANCH_Y],
      [b.join, top],
    ]
  return [
    [b.join, BRANCH_Y - BOX_H / 2],
    [b.join, top],
  ]
}

export const branchPath = (b: ChainBranch) => route(branchPts(b), TURN)

// Every coordinate the map draws, worked out from the stage names alone.
export function chainLayout(names: string[], specs: WiredBranch[] = []) {
  const asked = names.map(boxWidth)
  const total = asked.reduce((n, w) => n + w, 0)
  const runs = Math.max(names.length - 1, 0)
  // The row is laid out at the width its labels ask for, then made to fit: with
  // room to spare the gaps open (up to GAP_MAX) and the boxes keep their size,
  // and when there is not enough the gaps hold at GAP and every box is scaled
  // by the same factor. One of the two is always in play, so the drawing can
  // never run off the right edge however the estimate above lands.
  //
  // The five real stages ask for 196.6 of the 286 between the leads, so the
  // trunk the app draws is the roomy case: 89.4 spare over 4 runs is a 22.35 gap,
  // inside both clamps, and `fit` stays at 1. Neither clamp nor the squeeze has
  // fired since the trunk stopped being filtered.
  const spare = W - LEAD - OUT - total
  // The `runs === 0` arm is what keeps the division safe, so the guard the
  // divisor used to carry as well was answering a question already answered.
  const gap = runs === 0 ? 0 : Math.max(GAP, Math.min(GAP_MAX, spare / runs))
  // Never above 1: a box is only ever squeezed to fit the row, never stretched
  // to fill it. Growing one was the old bug — dividing the full width by a
  // filtered-down stage count drew a 280px bar where a miniature belongs.
  const fit =
    spare < GAP * runs ? Math.min(1, (W - LEAD - OUT - gap * runs) / total) : 1
  let cursor = LEAD
  const boxes: ChainBox[] = names.map((name, i) => {
    const w = asked[i] * fit
    const box = { name, x: cursor + w / 2, w }
    cursor += w + gap
    return box
  })
  const centers = boxes.map(b => b.x)
  const at = (name: string) => names.indexOf(name)
  const last = boxes.length - 1
  // Box to box down the row, plus the lead in off the left edge and the lead
  // out off the right.
  const wires = [
    ...(boxes.length === 0
      ? []
      : [{ key: 'in', x0: 0, x1: boxes[0].x - boxes[0].w / 2 }]),
    ...boxes.slice(0, -1).map((b, i) => ({
      key: b.name,
      x0: b.x + b.w / 2,
      x1: boxes[i + 1].x - boxes[i + 1].w / 2,
    })),
    ...(boxes.length === 0
      ? []
      : [{ key: 'out', x0: boxes[last].x + boxes[last].w / 2, x1: W }]),
  ]
  // A return only reads as a return if it comes back from somewhere downstream
  // of where it re-enters — except a self loop, which taps the box it returns
  // to, so its two ends are one box rather than an ordered pair. Both cases need
  // their stages on the row. On the trunk the app asks for, both returns always
  // have them; the guard is for the shorter rows only the tests build.
  //
  // A self loop's two ends are taken off the box's own edges rather than from a
  // fixed offset: a squeezed row narrows every box, and a pair pinned at ±8
  // while the box between them shrank to 14 would end up straddling nothing.
  const drawn = RETURNS.flatMap(r => {
    const tap = at(r.tap)
    const back = at(r.into)
    if (tap < 0 || back < 0 || (r.self ? tap !== back : tap <= back)) return []
    const straddle = boxes[back].w / 2 + SELF_STRADDLE
    const to = r.self ? centers[back] - straddle : centers[back]
    const from = r.self ? centers[tap] + straddle : centers[tap]
    // Where the run's own name rides it. A run that reaches back across the map
    // has its whole horizontal length to offer, and the name goes at the near
    // end of it — just clear of the box it lands on, so a name sits beside its
    // own arrowhead rather than somewhere along a span shared with two others.
    //
    // A self loop's goes beside the box it straddles. Centred on its own run is
    // the obvious place and the wrong one: that span is the box itself, so the
    // word comes down on top of the stage name and the two arrowheads either
    // side of it.
    //
    // Where it *could* go, in order of preference. A long return has one place
    // and no choice; a self loop has a side to pick — left first, where the gap
    // before the box is the wider of the two on a full row, and right when a
    // squeezed row has left no room there — and `room` below takes the first
    // that holds the name.
    const edge = boxes[back].x + boxes[back].w / 2
    const places = r.self
      ? [
          { x: Math.min(from, to) - 4, anchor: 'end' as const },
          { x: Math.max(from, to) + 4, anchor: 'start' as const },
        ]
      : [{ x: edge + 5, anchor: 'start' as const }]
    return [{ ...r, from, to, places }]
  })
  // How much clear width a label has where it wants to sit, and so which of the
  // places it is offered it takes.
  //
  // A run's verticals rise from the trunk to its own band, so they cross every
  // band below it and none above: what a label can collide with is the drops of
  // the runs *over* it, plus — for a return that reaches back across the map —
  // the corner where its own run turns down. Nothing else on the drawing is up
  // here; the boxes start 7 units under the lowest band.
  //
  // Only a self loop is ever offered a choice, and it is the one that would
  // need it: its label hangs off the end of a short run rather than riding a
  // 200-unit one, so it has no span of its own to write along and the side it
  // takes is the whole of where it lands. Both returns drawn today are long
  // ones with a single place each, so the comparison decides nothing and the
  // fallback below is what picks.
  //
  // What the clearance does and does not buy, wherever it is measured. `want`
  // is the estimate (RUN_CHAR), not the rendered text, so a platform whose
  // system font runs wider than the estimate does not trip this and move a
  // label — it overflows into the drop. The margin is against the *layout*
  // being wrong, not the metrics; widening RUN_CHAR is what guards those.
  const room = (r: (typeof drawn)[number], spot: (typeof r.places)[number]) => {
    const drops = drawn.filter(o => o.y < r.y).flatMap(o => [o.from, o.to])
    if (spot.anchor === 'end')
      return spot.x - Math.max(...drops.filter(x => x < spot.x), 0)
    // A long return's own corner is the other wall, and the nearer one: its
    // name may reach along the run it is the name of and no further.
    const wall = r.self ? W : Math.max(r.from, r.to) - r.turn
    return Math.min(...drops.filter(x => x > spot.x), wall) - spot.x
  }
  const returns = drawn.map(r => {
    const name = shortOf(r.loop)
    // The chip and not the name inside it: what has to clear the drops of the
    // runs above is the box the word is standing in.
    const want = runChipWidth(name)
    // The first place that holds the label, or the roomiest when none does.
    // Never just the preferred one: on a row that has squeezed the mixer
    // against the left edge, the left place is off the map rather than tight.
    const nameAt =
      r.places.find(spot => want <= room(r, spot)) ??
      r.places.reduce((best, spot) =>
        room(r, spot) > room(r, best) ? spot : best,
      )
    // The chip is the whole of where the name goes: it takes the spot the name
    // was offered, padded, and the word is then centred *in the chip* rather
    // than set against the spot itself. That last part is not a detail. The
    // width here is the estimate (RUN_CHAR), which is deliberately over — so a
    // name anchored to one edge sits as far off centre as the estimate is
    // generous, which on 'mixer' was two units in a thirty-two unit chip and
    // read as a word that had slipped. Centred, the same slack falls evenly on
    // both sides and cannot be seen at all.
    const chip = {
      x:
        nameAt.anchor === 'start'
          ? nameAt.x - RUN_PAD / 2
          : nameAt.x - want + RUN_PAD / 2,
      w: want,
    }
    return { ...r, chip, name }
  })
  // The branch row, laid out left to right with a cursor: each box takes the
  // place its anchor asks for, and is pushed right if that would land it on the
  // box before it. Without the cursor a two-stage trunk draws both branches on
  // top of each other — the same class of bug as the one-stage 280px bar, and
  // just as invisible to a test that counts elements. On the full trunk the
  // three anchors are 33.6 / 205.7 / 273.8 and the push never fires.
  //
  // A branch whose join stage is not on the row falls back to the last box:
  // whatever is left, the sound still arrives inside the set, and a wire to a
  // box that isn't there is a wire to nowhere. Also unreachable from the app —
  // every join stage is always on the row.
  let edge = -Infinity
  const branches: ChainBranch[] =
    boxes.length === 0
      ? []
      : specs.map(spec => {
          const w = boxWidth(spec.name) * fit
          const joinAt = at(spec.join)
          const target = joinAt >= 0 ? centers[joinAt] : centers[last]
          const want =
            spec.under === 'head' ? boxes[0].x - boxes[0].w / 2 + w / 2 : target
          const x = Math.max(want, edge + GAP + w / 2)
          edge = x + w / 2
          const dir = spec.dir ?? 'in'
          return {
            name: spec.name,
            x,
            w,
            join: joinAt >= 0 ? target : x,
            dir,
            stub:
              dir === 'out'
                ? x - w / 2
                : spec.under === 'head'
                  ? 0
                  : x - w / 2 - LEAD,
            y: BRANCH_Y,
          }
        })
  return { width: W, boxes, centers, wires, returns, branches, gap, fit }
}

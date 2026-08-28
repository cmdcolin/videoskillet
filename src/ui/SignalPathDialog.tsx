import { atRest } from '../core/controls'
import {
  DECK_STAGE,
  MIX_STAGE,
  MOD_STAGE,
  PICKER_STAGES,
  SOUND_STAGE,
  SOURCE_B_STAGE,
  stageGroups,
} from './controls'
import { cx } from './cx'
import {
  BOX_H,
  BOX_W,
  BOXES,
  BRANCH_Y,
  colX,
  deadHint,
  H,
  HEAD,
  KEYS,
  LAST_COL,
  MID_Y,
  RETURNS,
  returnPath,
  rowY,
  SOUND_COL,
  SUB_CHAR,
  SUB_PAD,
  TOP,
  TURN,
  W,
} from './diagramLayout'
import { Dialog } from './Dialog'
import { MapBox, MapRun } from './MapBox'
import { fitCaption } from './patched'
import styles from './SignalPathDialog.module.css'
import ui from './ui.module.css'

import type { Controls } from '../core/controls'
import type { LoopsLive } from './controls'
import type { DeckLoad } from './deckModel'
import type { Box } from './diagramLayout'
import type { BayLoad } from './modSlots'
export function SignalPathDialog(props: {
  controls: Controls
  live: LoopsLive
  // Nothing patched into input B: its feed and the mixer are drawn and inert,
  // the same answer the miniature gives.
  bOn: boolean
  // How much the modulation bay is holding, and what that number counts. Handed
  // in rather than worked out here like every other box's, because a routing is
  // not a control: there is no group of sliders behind this box for `touchedIn`
  // to walk, and "off stock" is not what its count means.
  mod: BayLoad
  // And for the deck, for the same reason again: what its box counts is which
  // gestures are engaged, not controls off stock — every control it draws is
  // already counted on the box of the stage that owns it.
  deck: DeckLoad
  // The same question for the other branch: no audio input picked, so the box
  // is drawn and inert rather than absent.
  soundOn: boolean
  // What is standing in each box that has a picker, captioned under its name
  // (patched.ts). The same record the miniature draws from, so the two drawings
  // cannot name the same source two ways.
  patched: Readonly<Record<string, string | undefined>>
  onOpen: (stage: string, group: string) => void
  onClose: () => void
}) {
  const { controls, onOpen, onClose } = props
  // How much of each box is off stock. A box that narrows to one group counts
  // that group; a stage counts all of its own.
  const touchedIn = (box: Box): number => {
    if (box.stage === MOD_STAGE) return props.mod.n
    if (box.stage === DECK_STAGE) return props.deck.n
    const groups = stageGroups(box.stage).filter(
      g => box.group === undefined || g.name === box.group,
    )
    return groups
      .flatMap(g => g.sliders)
      .filter(s => !atRest(controls[s.key], s.key)).length
  }
  // The same count for a loop, which is a stage without being a box of its own —
  // its run is where a box would be, because there is no point on the trunk to
  // draw one at.
  const touchedInLoop = (stage: string) =>
    stageGroups(stage)
      .flatMap(g => g.sliders)
      .filter(s => !atRest(controls[s.key], s.key)).length
  const openStage = (stage: string, group?: string) => {
    onOpen(stage, group ?? stageGroups(stage)[0]?.name ?? '')
    onClose()
  }
  const open = (box: Box) => openStage(box.stage, box.group)
  // B's feed joins the run between Feed A and the mixer, which is where mixB
  // sits in the pass order.
  const join = (colX(1) + colX(2)) / 2
  // A branch with no input patched into it, and — for B — the mixer it arrives
  // at, have nothing to act on. The rest of the chain is carrying A regardless.
  const dead = (box: Box) =>
    (!props.bOn && (box.stage === MIX_STAGE || box.stage === SOURCE_B_STAGE)) ||
    (!props.soundOn && box.stage === SOUND_STAGE)
  // Drawn inert and opens onto something are two questions, and on the branches
  // they part company: a source branch with nothing patched in still opens,
  // because the picker that ends that state heads its stage in the panel and is
  // the whole reason to press it. Off `PICKER_STAGES`, which is the same list
  // app.tsx keys its pickers by — a box that opened here and not on the
  // miniature was the same drawing answering twice, which is what it did until
  // this stopped being written out per drawing.
  const opens = (box: Box) => !dead(box) || PICKER_STAGES.has(box.stage)
  // The box that *is* a picker stage carries the caption; the feed beside it
  // narrows to a group inside that same stage and is not where anything is
  // patched in. Nothing on an inert box, which is already saying the opposite
  // in dashes.
  const holds = (box: Box): string | undefined =>
    box.group === undefined && !dead(box) ? props.patched[box.stage] : undefined

  return (
    <Dialog title="the signal path" size="diagram" onClose={onClose}>
      <p className={ui.helpText}>
        Two inputs, each with a feed of its own, meeting at the mixer — then one
        chain to the glass, with the sound patched into the receiver along the
        way and your own view at the end of it. Nothing here is a filter: every
        box is a piece of hardware misbehaving, and the artifacts come out of
        how they interfere. Click one to open its controls — and the three loops
        over the top are pressable too, each one its own way back into the
        chain. The two boxes on the bottom row have no wire on them: the
        modulation bay and the deck are patched into the controls rather than
        into the signal — one setting them moving on its own, the other
        gathering the ones a hand moves during a take — which is why they float.
      </p>
      <svg
        className={styles.diagram}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label="signal path"
      >
        {/* the runs, drawn before the boxes so a box sits on its wire */}
        <path
          className={styles.wire}
          d={`M10 ${MID_Y}H${colX(0) - BOX_W / 2}`}
        />
        {Array.from({ length: LAST_COL }, (_, i) => (
          <path
            key={i}
            className={styles.wire}
            d={`M${colX(i) + BOX_W / 2} ${MID_Y}H${colX(i + 1) - BOX_W / 2}`}
          />
        ))}
        <path
          className={styles.wire}
          d={`M${colX(LAST_COL) + BOX_W / 2} ${MID_Y}H${W - 8}`}
        />
        <path
          className={styles.arrow}
          d={`M${W - 8} ${MID_Y - HEAD}L${W} ${MID_Y}L${W - 8} ${MID_Y + HEAD}Z`}
        />
        {/* B's run: in, through its own two boxes, and up into the trunk — the
            same two columns A gets on the row above, because it is the same
            rig. */}
        <g className={cx(!props.bOn && styles.dim)}>
          <path
            className={styles.wire}
            d={`M10 ${BRANCH_Y}H${colX(0) - BOX_W / 2}`}
          />
          <path
            className={styles.wire}
            d={`M${colX(0) + BOX_W / 2} ${BRANCH_Y}H${colX(1) - BOX_W / 2}`}
          />
          <path
            className={styles.wire}
            d={`M${colX(1) + BOX_W / 2} ${BRANCH_Y}H${join - TURN}Q${join} ${BRANCH_Y} ${join} ${BRANCH_Y - TURN}V${MID_Y + HEAD}`}
          />
          <path
            className={styles.arrow}
            d={`M${join - HEAD} ${MID_Y + HEAD * 1.6}L${join} ${MID_Y}L${join + HEAD} ${MID_Y + HEAD * 1.6}Z`}
          />
        </g>
        {/* The sound's run: a lead of its own and a short riser into the
            receiver. Deliberately not fed from the left edge like the two
            signals are — it is patched into one stage, not sent down the
            chain, and a wire the length of the row would say the opposite. */}
        <g className={cx(!props.soundOn && styles.dim)}>
          <path
            className={styles.wire}
            d={`M${colX(SOUND_COL) - BOX_W / 2 - 12} ${BRANCH_Y}H${colX(SOUND_COL) - BOX_W / 2}`}
          />
          <path
            className={styles.wire}
            d={`M${colX(SOUND_COL)} ${BRANCH_Y - BOX_H / 2}V${TOP + BOX_H}`}
          />
          <path
            className={styles.arrow}
            d={`M${colX(SOUND_COL) - HEAD} ${TOP + BOX_H + HEAD * 1.6}L${colX(SOUND_COL)} ${TOP + BOX_H}L${colX(SOUND_COL) + HEAD} ${TOP + BOX_H + HEAD * 1.6}Z`}
          />
        </g>
        {/* The view's run: the same riser under Screen, with the arrowhead at
            the other end. That one difference is the statement — everything
            else on this row is patched into the chain, and this is the only
            thing the chain is delivered to. */}
        <path
          className={styles.wire}
          d={`M${colX(LAST_COL)} ${TOP + BOX_H}V${BRANCH_Y - BOX_H / 2}`}
        />
        <path
          className={styles.arrow}
          d={`M${colX(LAST_COL) - HEAD} ${BRANCH_Y - BOX_H / 2 - HEAD * 1.6}L${colX(LAST_COL)} ${BRANCH_Y - BOX_H / 2}L${colX(LAST_COL) + HEAD} ${BRANCH_Y - BOX_H / 2 - HEAD * 1.6}Z`}
        />
        {RETURNS.map(r => {
          const d = returnPath(r.from, r.to, r.y, r.turn)
          const n = touchedInLoop(r.name)
          const live = props.live[r.loop]
          return (
            // Same press, same sentence and same keys as the miniature's runs —
            // see MapRun, which is where both drawings' copy of that rule lives
            // for the reason MapBox exists at all. What the card carries on its
            // face is the stage name: it is the heading you land on, and the
            // sentence about the loop is two inches below in the legend, where
            // it can be read rather than fitted.
            <MapRun
              key={r.loop}
              name={r.name}
              blurb={r.blurb}
              live={live}
              touched={n}
              // No fold on this card: a press marks and opens, never closes.
              pressHint=" — click for its controls"
              className={cx(
                styles.return,
                styles.loopBtn,
                r.optical && styles.optical,
                live && styles.live,
                n > 0 && styles.loopTouched,
              )}
              onOpen={() => openStage(r.name)}
            >
              {/* The wire is 1.25 units of stroke and the thing you are meant to
                  press, so it carries a transparent one wide enough to hit. At
                  14 it stays inside the 22 units between one run and the next,
                  so a click can never land on the wrong loop. */}
              <path className={styles.loopHit} d={d} />
              <path className={styles.wire} d={d} />
              <path
                className={styles.arrow}
                d={`M${r.to - HEAD} ${TOP - HEAD * 1.6}L${r.to} ${TOP}L${r.to + HEAD} ${TOP - HEAD * 1.6}Z`}
              />
              <text className={styles.loopLabel} x={r.lx} y={r.y - 5}>
                {r.name}
                {live ? ' — running' : ''}
                {n > 0 ? ` • ${n}` : ''}
              </text>
            </MapRun>
          )
        })}
        {/* The two inputs used to be named by an 'A' and a 'B' parked on the
            wires here, because the first box on each row was named after
            something else. Each row now opens with the input's own box, so the
            tags were the label repeated smaller. */}
        {BOXES.map(box => {
          const y = rowY(box.row)
          const n = touchedIn(box)
          const off = dead(box)
          const held = holds(box)
          const sub =
            held === undefined
              ? undefined
              : fitCaption(held, BOX_W - SUB_PAD, SUB_CHAR)
          return (
            <MapBox
              key={box.label}
              name={box.label}
              blurb={box.what}
              offHint={deadHint(box)}
              patched={held}
              off={off}
              opens={opens(box)}
              touched={n}
              touchedSay={
                box.stage === MOD_STAGE
                  ? props.mod.say
                  : box.stage === DECK_STAGE
                    ? props.deck.say
                    : undefined
              }
              // No `foldHint`: this card marks and opens, it never closes a
              // stage, so the hover text stops at the off-stock count.
              className={cx(
                styles.node,
                box.free === true && styles.nodeFree,
                off && styles.nodeOff,
                !off && n > 0 && styles.nodeTouched,
              )}
              onOpen={() => open(box)}
            >
              <rect
                className={styles.box}
                x={colX(box.col) - BOX_W / 2}
                y={y - BOX_H / 2}
                width={BOX_W}
                height={BOX_H}
                rx="3"
              />
              <text
                className={styles.label}
                x={colX(box.col)}
                // Set off centre only where there is a caption to make room
                // for; every other box on the drawing is one line in the middle
                // of a chip and stays there.
                y={sub === undefined ? y : y - 4.5}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {box.label}
              </text>
              {sub === undefined ? null : (
                <text
                  className={styles.sub}
                  x={colX(box.col)}
                  y={y + 6.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {sub}
                </text>
              )}
            </MapBox>
          )
        })}
      </svg>
      {/* What the drawing's colours mean, which is the half of it the prose
          above cannot carry: the topology is visible and the states are not.
          Each chip is the real box under the real class, so a change to
          .nodeTouched or .nodeOff moves the key with the drawing rather than
          leaving a swatch quietly describing last month's palette.

          Here and not in the sidebar. The miniature has 304 units and no row to
          spare, and this is the card the ⤢ opens to learn the miniature by —
          which makes it the one place a key is read rather than skipped. */}
      <ul className={styles.key}>
        {KEYS.map(k => (
          <li key={k.say}>
            <svg
              className={styles.keyChip}
              viewBox="0 0 28 14"
              aria-hidden="true"
            >
              <g className={cx(styles.node, k.state && styles[k.state])}>
                <rect
                  className={styles.box}
                  x="1"
                  y="1"
                  width="26"
                  height="12"
                  rx="3"
                />
              </g>
            </svg>
            <span>{k.say}</span>
          </li>
        ))}
      </ul>
      {/* The blurbs in full. The sidebar clamps a stage's line to one row —
          at 360px every one of them wraps to two — so this is the one place
          they are readable rather than hoverable. */}
      <ul className={styles.legend}>
        {BOXES.map(box => {
          const n = touchedIn(box)
          const off = dead(box)
          return (
            <li key={box.label}>
              <button
                className={styles.legendBtn}
                disabled={!opens(box)}
                onClick={() => open(box)}
              >
                <span className={styles.legendName}>{box.label}</span>
                <span className={styles.legendWhat}>
                  {/* Whole here, where the row is html and wraps, rather than
                      cut to a box as the drawing has to cut it — the one place
                      a long filename can be read in full. Inside the sentence
                      rather than in a column of its own: a column between the
                      name and the blurb would start two of the twelve sentences
                      further right than the other ten, and the point of the
                      name holding its width is that the sentences line up. */}
                  {holds(box) === undefined ? null : (
                    <span className={styles.legendHolds}>{holds(box)} — </span>
                  )}
                  {off ? deadHint(box) : box.what}
                </span>
                {n > 0 && !off ? (
                  <span className={styles.legendCount}>• {n}</span>
                ) : null}
              </button>
            </li>
          )
        })}
        {/* The three loops on the same list as the boxes, because they are the
            same kind of thing to press and the svg gives them no rows to read.
            It is also the only way to reach one from the keyboard in reading
            order: a run is a path, and a path with role=button is a tab stop on
            a picture rather than a line you can find. */}
        {RETURNS.map(r => {
          const n = touchedInLoop(r.name)
          return (
            <li key={r.loop}>
              <button
                className={styles.legendBtn}
                onClick={() => openStage(r.name)}
              >
                <span className={styles.legendName}>{r.name}</span>
                <span className={styles.legendWhat}>
                  {r.what}
                  {props.live[r.loop] ? ' — running now' : ''}
                </span>
                {n > 0 ? (
                  <span className={styles.legendCount}>• {n}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}

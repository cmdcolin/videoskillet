import { cx } from './cx'
import { SYNC_DIVISIONS } from './midi'
import styles from './ModBay.module.css'
import { ModRowEditor } from './ModRowEditor'
import {
  isBayKey,
  targetLabel,
  DEFAULT_DUTY,
  DEFAULT_STAB,
  DUTY_MAX,
  DUTY_MIN,
  STAB_HZ_MAX,
  STAB_MS_MAX,
  STAB_MS_MIN,
  gateFlips,
  sourceLabel,
} from './modSlots'
import { useModSlotsApi } from './ModSlotsContext'
import { groupOf, stageOf } from './placement'
import { Slider } from './Slider'
import { TempoRow } from './TempoRow'
import ui from './ui.module.css'
import { arrowhead, route } from './wire'

import type { ModTarget } from '../core/controls'
import type { Tempo } from './useTempo'
import type { Point } from './wire'

// The stab gate: the one thing in this section that is not a slot. It drives the
// whole board rather than one control, so there is nothing to point at a target —
// which is also why it needs no depth. Two numbers, the beat, and what is at the
// far end of it.
//
// Directly under the tempo row because that is what it wants most: "twice a
// second" is a musical statement, so the ♩ on the rate is the point rather than a
// refinement, and the row that provides the beat is right above it.
//
// Every row here says one of two things depending on whether a look is held at
// the far end, because the gate is genuinely two features and they want
// different words and a different length. Written as one component rather than
// two, so the state a hold puts the gate into cannot drift from the state a drop
// takes it out of — and because the rate row is the same row either way.
function StabRows() {
  const { stab, stabHz, setStab, cycleStabSync, holdLook, dropLook, bpm } =
    useModSlotsApi()
  const flips = gateFlips(stab)
  return (
    <>
      <Slider
        label={flips ? 'flips' : 'stabs'}
        unit="/s"
        min={0}
        max={STAB_HZ_MAX}
        step={0.1}
        // The resolved rate, so a clock lock reads as the rate it is running at —
        // the same thing a slot's rate row shows. The dialed Hz stays underneath.
        value={stabHz}
        defaultValue={DEFAULT_STAB.hz}
        help={
          flips
            ? 'Cuts the whole board between the look you are dialing and the one you held, this many times a second. 0 is off. It does not fade: each side arrives as a hard cut, which is the only version of this the signal path can afford — a fade would redesign the filter bank every frame, where a flip does it twice a cycle. Everything with memory runs straight through the flip, so the phosphor trail and the feedback each side leaves are still there when the other one lands. Lock it to the beat with ♩.'
            : 'Cuts the whole look out and pokes it back in, this many times a second — a clean picture with the fault stabbed into it, rather than the fault running continuously. 0 is off. What it does not do is fade: each stab is a hard cut to stock and back, so the picture between them is the clean signal, still carrying the phosphor trail and the feedback the last stab put there. The look itself is untouched — every slider stays where you left it, and so does where you are looking from. Lock it to the beat with ♩.'
        }
        sync={{
          label:
            stab.syncDiv === undefined
              ? null
              : SYNC_DIVISIONS[stab.syncDiv].label,
          live: bpm !== null,
          onCycle: cycleStabSync,
        }}
        onChange={hz => setStab({ ...stab, hz })}
      />
      {/* Hidden while the gate is off rather than sitting there inert: with no
          stabs there is nothing for a length to be the length of, and this
          section already asks a lot of a first read. */}
      {stab.hz === 0 ? null : flips ? (
        /* A share of the cycle rather than a length in ms, because the two ends
           of a flip are peers and what a set wants to hold still across a tempo
           change is the ratio — PulsePlan.duty carries the whole argument. */
        <Slider
          label="live look's share"
          unit="%"
          min={DUTY_MIN * 100}
          max={DUTY_MAX * 100}
          step={1}
          value={(stab.duty ?? DEFAULT_DUTY) * 100}
          defaultValue={DEFAULT_DUTY * 100}
          help="How much of each cycle sits on the look you are dialing, with the held one taking the rest. A share rather than a length, so dialing the rate or changing the tempo leaves the split where you put it: at 50 the two get equal time, and pushing it either way makes one look the state and the other the interruption — which at the far end is the same gesture as a stab, with your own look in place of clean."
          onChange={pct => setStab({ ...stab, duty: pct / 100 })}
        />
      ) : (
        <Slider
          label="stab length"
          unit="ms"
          min={STAB_MS_MIN}
          max={STAB_MS_MAX}
          step={4}
          value={stab.ms}
          defaultValue={DEFAULT_STAB.ms}
          help="How long each stab of the look lasts. Milliseconds rather than a share of the gap, so changing the rate leaves the hit the same weight: 60ms is about four frames, short enough that the clean signal is what you are watching. Below one frame it is one frame — the stab still lands rather than being skipped."
          onChange={ms => setStab({ ...stab, ms })}
        />
      )}
      <FarEnd
        flips={flips}
        // Whether it is actually cutting, which the sentence below has to know:
        // a look can be held with the rate still at 0, and "flipping against a
        // held look" over a still picture is the bay claiming something the
        // screen plainly is not doing. The dialed rate rather than the resolved
        // one, so the freeze reads as a freeze and not as a gate that was never
        // set up — the strip above is where ❚❚ is explained and undone.
        running={stab.hz > 0}
        onHold={holdLook}
        onDrop={dropLook}
      />
    </>
  )
}

// What sits at the far end of the gate, and the one gesture that changes it.
//
// A button rather than a picker, and that is the design decision worth stating:
// the look you want to flip against is almost always the one you were just
// looking at, so the gesture is "hold this" — dial a look, hold it, dial the
// other one against it. A dropdown could only ever offer what somebody else
// authored, and every preset is reachable this way anyway, by clicking the chip
// and then holding it.
//
// It reads as a statement about the gate rather than as a control, because that
// is what it is: one line saying which of two things this gate is doing, with
// the way to change it on the end of it.
function FarEnd(props: {
  flips: boolean
  running: boolean
  onHold: () => void
  onDrop: () => void
}) {
  return (
    <>
      <div className={ui.hint}>
        {!props.flips
          ? 'The far end is stock, so each stab pokes a clean picture through. Hold a look there and the gate cuts between the two instead.'
          : props.running
            ? 'Cutting against a held look. The sliders are still the live one — the held look is a copy, and nothing you do here moves it.'
            : 'A look is held at the far end, and the rate above is at 0 — set it and the board starts cutting between the two.'}
      </div>
      <div className={styles.farEnd}>
        <button
          className={ui.btn}
          title={
            props.flips
              ? 'replace the held look with the one on screen now'
              : 'hold the look on screen now at the far end of the gate — then dial a different one and the gate cuts between them'
          }
          onClick={props.onHold}
        >
          {props.flips ? '⧉ re-hold this look' : '⧉ hold this look'}
        </button>
        {!props.flips ? null : (
          <button
            className={cx(ui.btn, styles.dropHeld)}
            title="drop the held look and go back to stabbing stock — the rate and the beat lock stay"
            onClick={props.onDrop}
          >
            × drop
          </button>
        )}
      </div>
    </>
  )
}

// The straight run a slot's wire draws: one leg, head included, off the same
// two points every other wire in the panel is built from (`./wire`, ported
// from bender) — not a fourth hand-written arrowhead.
const WIRE_PTS: readonly Point[] = [
  [0, 5],
  [16, 5],
]
const WIRE_D = route(WIRE_PTS, 0)
const WIRE_HEAD_D = arrowhead(WIRE_PTS, 5, 3)

// The short line between a slot's two chips, drawn rather than left to a verb:
// a wire reads as a connection before either label does, which "driving" never
// did on its own. Solid and tinted while the slot is actually running, dashed
// and dim while held — the same split `iconModOff` draws on a control row's
// own `held` badge, so a reader who already knows that badge reads this too.
function Wire(props: { live: boolean }) {
  return (
    <svg
      className={cx(styles.wire, !props.live && styles.wireOff)}
      width="16"
      height="10"
      viewBox="0 0 16 10"
      aria-hidden="true"
    >
      <path className={styles.wireLine} d={WIRE_D} />
      <path className={styles.wireHead} d={WIRE_HEAD_D} />
    </svg>
  )
}

// The head of a patched slot: its number, what is driving it and what it is
// driving, drawn as a cable rather than said in a sentence — bender's patch
// bay (bender/src/ui/PatchBay.tsx), adapted: a source chip, a wire, a
// destination chip read as "this connects to that" before either label does,
// where "driving bend amount — Deflection" asked a reader to parse a sentence
// for the same fact.
//
// The picker underneath this row is still not here — that stays a dropdown of
// every slider in the app, 273 options flattened into one alphabetical list,
// and this bay replaced exactly that: a control row's own ⋮ claims a free
// slot, so the target is picked at the control it drives, where you are
// already looking at it. The source chip below is a readout of the SelectRow
// one row down, the same redundancy bender's own SVG carries over its
// sliders — a cable you can read without opening anything, over a value you
// can only change by opening it.
//
// The destination chip is still a way back, not just a label: it opens the
// module the control lives in, the same jump "This look"'s captions make and
// for the same reason — a routing you cannot find the row for is a wobble
// with no way to tune what it is wobbling.
function SlotHead(props: {
  // 1-based, as the bay numbers its slots.
  n: number
  target: ModTarget
  source: string
  live: boolean
  // The stages that will actually open right now. A branch with nothing patched
  // into it opens onto nothing, and a look carried in from a preset or a link
  // can hold a routing into one — so this is a live question, not a property of
  // the table. Same guard as LookSection's captions.
  openStages: ReadonlySet<string>
  onOpenGroup: (stage: string, group: string) => void
  // Unfold the editor under the row this slot drives, so the jump lands on
  // the routing and not just on the module it is somewhere inside.
  onEditRow: () => void
  onRemove: () => void
}) {
  // A wire onto another wire names a knob in this same bay, so there is no
  // module to open and no ambiguity to resolve: "slot 3 depth" is already the
  // whole address, and the row it names is a few lines up or down this list.
  const group = isBayKey(props.target) ? undefined : groupOf(props.target)
  const stage = group === undefined ? null : stageOf(group)
  const name = targetLabel(props.target)
  // "control — module", the same pair the dropdown's options carried: the
  // control name alone is ambiguous across 273 of them, and the module is also
  // the thing the button opens.
  const label = group === undefined ? name : `${name} — ${group.name}`
  return (
    <div className={styles.slotHead}>
      <span className={styles.tag} title={`mod slot ${props.n}`}>
        {props.n}
      </span>
      <span
        className={cx(
          styles.chip,
          styles.srcChip,
          !props.live && styles.chipOff,
        )}
        title={props.live ? props.source : `${props.source}, held`}
      >
        {props.source}
      </span>
      <Wire live={props.live} />
      {group !== undefined && stage !== null && props.openStages.has(stage) ? (
        <button
          className={cx(
            styles.chip,
            styles.destChip,
            !props.live && styles.chipOff,
          )}
          title={`open ${group.name} in the ${stage} stage, with this routing's editor unfolded under ${name}`}
          onClick={() => {
            props.onOpenGroup(stage, group.name)
            props.onEditRow()
          }}
        >
          {label}
        </button>
      ) : (
        <span
          className={cx(
            styles.chip,
            styles.destChip,
            !props.live && styles.chipOff,
          )}
          title={label}
        >
          {label}
        </span>
      )}
      <button
        className={styles.remove}
        title={`stop modulating ${name} and hand slot ${props.n} back`}
        aria-label={`unpatch slot ${props.n}`}
        onClick={props.onRemove}
      >
        ×
      </button>
    </div>
  )
}

// The whole bay, one entry per patched slot. State, persistence and the push to
// the render loop all moved to useModSlots when motion stopped being this
// section's private business — presets carry it, links carry it, and any control
// row can claim a slot from its own ⋮. What is left here is the view that shows
// the bay as a bay, which is still the only place the eight read as a set: a
// routing's own row can say what drives that control and cannot say what else
// is moving, or how much of the bay is left.
//
// Empty slots draw nothing. They used to be eight rows reading "off", which was
// the section's whole resting height spent on the absence of eight things — and
// each of those rows was a picker, which is why the bay looked like the place
// motion was set up from. It isn't: it is the place motion is read and taken
// back. What is left of "there are eight" is the free count under the list.
//
// No `Section` around any of it any more, and that is the point of the file
// being a bay rather than a section: this is the body of the Modulation stage,
// which is a box floating off the chain map (controls.ts, MOD_STAGE). The stage
// head carries the name, the blurb and the patched count that the fold used to
// — and while the stage is shut, none of this is built at all, which a folded
// section could not say.
export function ModBay(props: {
  tempo: Tempo
  openStages: ReadonlySet<string>
  onOpenGroup: (stage: string, group: string) => void
  // Patch one routing from nothing, for a bay with nothing in it yet.
  onStart: () => void
}) {
  const { slots, setSlotForKey, setEditing, fire } = useModSlotsApi()
  // Slot number and slot in one, because the number is the slot's identity —
  // the engine's phase is keyed by position, so filtering the empties out must
  // not renumber the ones that are left.
  const patchedSlots = slots.flatMap((slot, i) =>
    slot.target === '' ? [] : [{ slot, target: slot.target, n: i + 1, i }],
  )
  const free = slots.length - patchedSlots.length
  // Whether anything in the bay is playable, which is what decides if the
  // fire-everything button is worth a row.
  const anyTrig = slots.some(s => s.target !== '' && s.source === 'trig')
  return (
    <>
      {/* What the stage's own heading does not already say. It used to open on
          "LFOs, drift and the audio envelope wiggling any control", which is
          now the blurb one line above it, and to explain the claim, which the free
          count at the foot of the bay explains again — three sentences of the
          same instruction on a bay holding nothing. What is left is the one
          thing in here that is not a routing. */}
      <div className={ui.hint}>
        The gate below is the one thing in the bay that drives the whole board
        rather than one control: it cuts between the look you are dialing and a
        second one on the beat. That second one is stock until you hold a look
        at the far end of it, so out of the box each cut pokes a clean picture
        through.
      </div>
      {/* The beat every ♩ in the panel reads, at the top of the section whose
          rates are the ones most often locked to it. Here rather than in MIDI:
          that section only exists once a controller is wired up, and a tempo you
          tapped in yourself is exactly what a session with no MIDI at all
          needs. */}
      <TempoRow tempo={props.tempo} />
      {/* One key for the whole bay, above the slots rather than inside any of
          them: several envelopes at different decay rates fired together is one
          gesture, and hitting them one row at a time is not that gesture. */}
      {anyTrig ? (
        <button
          className={ui.btn}
          title="strike every one-shot envelope in the bay at once — or press t"
          onClick={() => fire()}
        >
          ⚡ fire all
        </button>
      ) : null}
      <StabRows />
      {/* Every patched slot: its head, and under it the same editor the
          control row unfolds — one set of rows to learn, wherever a routing
          is found. */}
      {patchedSlots.map(({ slot: s, target, n, i }) => (
        // Slots are positional identities (slot 1..8), so the index IS the key.
        // oxlint-disable-next-line react/no-array-index-key
        <div key={i}>
          <SlotHead
            n={n}
            target={target}
            source={sourceLabel(s.source)}
            live={s.on}
            openStages={props.openStages}
            onOpenGroup={props.onOpenGroup}
            onEditRow={() => setEditing(target, true)}
            // The same call the row's own "remove" makes, rather than a second
            // way to blank a slot: it hands the slot back with its run switch
            // restored, which matters because the switch belongs to a routing —
            // left thrown on an empty slot it would park whatever got patched
            // there next, with nothing on the row that claimed it to say why it
            // isn't moving.
            onRemove={() => setSlotForKey(target, null)}
          />
          <ModRowEditor controlKey={target} />
        </div>
      ))}
      {/* What is left of the eight empty rows: the count, and the one gesture
          that fills one. Both states are worth a line — with the bay full, a
          claim has nowhere to go, and the row that gets pressed says so from
          inside its own editor but only after you have pressed it. */}
      <div className={ui.hint}>
        {free === 0
          ? `all ${slots.length} slots are patched — hand one back with its × to free it.`
          : `${free} of ${slots.length} slots free — press + mod on any control row to patch one.`}
      </div>
      {/* An empty bay's one press: rather than a paragraph telling a reader
          where the buttons are, a button. It patches one slow routing onto a
          control the look is using, and that routing arrives here as a slot
          with its editor open under its row, which teaches the shape of the
          thing better than any sentence about it. */}
      {patchedSlots.length > 0 ? null : (
        <button
          className={ui.btn}
          title="patch one slow wobble onto a control this look is using — the same as “random motion, gentle” in the palette"
          onClick={() => props.onStart()}
        >
          ∿ start something moving
        </button>
      )}
    </>
  )
}

import { createContext, use, useEffect, useId, useState } from 'react'

import { snapToStep } from './controls'
import { cx } from './cx'
import {
  choicesFitTrack,
  formatFine,
  formatValue,
  readingChars,
} from './format'
import { HelpProse } from './HelpProse'
import { MenuItem, Popover } from './Popover'
import popoverStyles from './Popover.module.css'
import styles from './Slider.module.css'
import { SliderHelpDialog } from './SliderHelpDialog'
import { ToggleButtonGroup } from './ToggleButtonGroup'
import { fromTravel, toTravel, TRAVEL_STEP } from './travel'
import { atCents, CENT_MAX, CENT_MIN, centsOf, notchOf } from './vernier'

import type { SliderDef } from './controls'
import type { ModPatch } from './modSlots'
import type { CurveName } from './travel'
import type { CSSProperties, ReactNode } from 'react'

// How wide the readout column is, in characters, for every row in one rack.
//
// A row sizes its own reading off `readingChars` — its widest *possible*
// reading rather than its current one — so nothing about the row moves while
// its value does. That is not a nicety: the readout is a grid column, its two
// neighbours are fr-based, and the third column is `auto`. So a reading that
// grew mid-drag (the ↺ appearing the moment the value left stock, then a digit
// arriving) re-solved the row and slid the track out from under the pointer —
// pressing at the middle of a 0–150 control and moving 4px right used to land
// on 110, because the track had shifted 16px left while the pointer stood
// still.
//
// This fixes the other half: every row in a rack reserves the same width, so a
// group's tracks start and end at one x and a stack of faders can be read down
// the column. Without it the widths are per-row (a "3.00IRE" against a "0.80")
// and one open stage came out with its tracks at four different x.
//
// A context rather than a prop because the rows are not always the provider's
// own children — LookSection wraps each in a <div> of its own — and threading a
// number through every such wrapper is how the two halves drift apart. Zero
// means "no rack": the row falls back to its own width, which is still stable.
const RackContext = createContext(0)

// One column of control rows that should line up with each other. Renders no
// DOM of its own: what it establishes is a measurement, not a box.
export function Rack(props: {
  sliders: readonly SliderDef[]
  children: ReactNode
}) {
  // A *stacked* mode switch sits out: it reads up on the label's line with no
  // track beneath it to line up with, and letting one in would reserve the width
  // of its longest option ("dropout compensator" has three) on every slider in
  // the group. One short enough to render inline is an ordinary three-column
  // row, so it joins the column like anything else — and has to, or its readout
  // sizes itself and its track starts at an x of its own.
  const ch = props.sliders.reduce((n, s) => {
    if (s.choices === undefined)
      return Math.max(n, readingChars(s.min, s.max, s.step, s.unit))
    return choicesFitTrack(s.choices)
      ? Math.max(n, ...s.choices.map(c => c.length))
      : n
  }, 0)
  return <RackContext value={ch}>{props.children}</RackContext>
}

// The readout's little accessory buttons (help, and the badge on a routed row).
function IconButton(props: {
  title: string
  className: string
  expanded?: boolean
  onClick: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={props.title}
      className={props.className}
      aria-expanded={props.expanded}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  )
}

// The set-up a row can carry, behind one ⋮.
//
// These used to sit in the open at the end of every row — ∿ ☆ ↺, plus ⚟ and ♩
// once MIDI was on. Five affordances the median session presses zero times,
// rendered 121 times over, and they were not free: the readout column reserved
// 5.2rem to hold them, which is a quarter of the panel's width taken from the
// column that actually needed it, so labels with a parenthetical wrapped to two
// lines to pay for buttons nobody was reaching for.
//
// Reset is deliberately *not* here. It is the one row action a session actually
// reaches for — you push a knob to hear what it does and then want it back —
// and it needs no width of its own, because the reading is already rendered,
// already in its own column, and already the thing that says the row has moved.
// So the number is the reset (see `readout` below) and the menu keeps only the
// wiring: what a row is set to stays in the open beside the reading as a badge,
// and changing that is what can wait for a click.
function RowMenu(props: {
  label: string
  favorite?: { on: boolean; onToggle: () => void }
  mod?: {
    patch: ModPatch | null
    on: boolean
    onOpenChange: (open: boolean) => void
    onRemove: () => void
  }
  midi?: { label: string | null; armed: boolean; onArm: () => void }
  sync?: { label: string | null; live: boolean; onCycle: () => void }
}) {
  const { favorite, mod, midi, sync } = props
  // The rows are built on first open and not before. A menu is five MenuItems
  // whether or not anyone looks at it, and on the bench every stage is mounted
  // at once — 72 rows measured, so eagerly building all of them put ~700 extra
  // elements through every render a slider drag causes, for markup nobody was
  // looking at. The trigger is ours, so the flag rides its own click: React
  // flushes a discrete event before paint, so the browser's own popover-open
  // still finds the rows there.
  const [opened, setOpened] = useState(false)
  return (
    <Popover
      trigger={attrs => (
        <button
          type="button"
          className={styles.rowMenu}
          popoverTarget={attrs.popoverTarget}
          style={attrs.style}
          title={`more for “${props.label}”`}
          aria-label={`more for ${props.label}`}
          onClick={() => setOpened(true)}
        >
          ⋮
        </button>
      )}
    >
      {id => (
        <>
          {!opened ? null : (
            <>
              {favorite === undefined ? null : (
                <MenuItem
                  icon={favorite.on ? '★' : '☆'}
                  label={
                    favorite.on ? 'remove from Favorites' : 'pin to Favorites'
                  }
                  hint=""
                  closes={id}
                  onClick={favorite.onToggle}
                />
              )}
              {/* Only between two populated halves: with reset gone from the
                  menu the first half is the pin alone, and a row that offers no
                  pin (there is none) or no wiring would otherwise open on a
                  rule with nothing above or below it. */}
              {favorite === undefined ||
              (mod === undefined &&
                midi === undefined &&
                sync === undefined) ? null : (
                <div className={popoverStyles.menuSep} />
              )}
              {/* The same doors the row's own buttons are, said in words: the
                  `+ mod` button and the routing chip beside the reading are the
                  primary way in, and the menu repeats them for anyone who came
                  here first. Remove is the one verb that lives only here and in
                  the open editor, so the menu is where a routing can be thrown
                  away without unfolding it. */}
              {mod === undefined ? null : mod.patch === null ? (
                <MenuItem
                  icon="∿"
                  label="add modulation"
                  hint=""
                  closes={id}
                  onClick={() => mod.onOpenChange(true)}
                />
              ) : (
                <>
                  <MenuItem
                    icon="∿"
                    label="edit modulation"
                    hint={
                      mod.on ? mod.patch.reading : `${mod.patch.reading}, held`
                    }
                    closes={id}
                    onClick={() => mod.onOpenChange(true)}
                  />
                  <MenuItem
                    icon="×"
                    label="remove modulation"
                    hint=""
                    closes={id}
                    onClick={() => mod.onRemove()}
                  />
                </>
              )}
              {midi === undefined ? null : (
                <MenuItem
                  icon="⚟"
                  label={
                    midi.armed
                      ? 'listening — click to cancel'
                      : midi.label === null
                        ? 'assign a MIDI control'
                        : 'relearn this MIDI control'
                  }
                  hint={midi.label === null ? '' : `CC${midi.label}`}
                  closes={id}
                  onClick={midi.onArm}
                />
              )}
              {sync === undefined ? null : (
                <MenuItem
                  icon="♩"
                  label={
                    sync.label === null
                      ? 'lock it to the beat'
                      : 'change the beat division'
                  }
                  hint={sync.label ?? ''}
                  closes={id}
                  onClick={sync.onCycle}
                />
              )}
            </>
          )}
        </>
      )}
    </Popover>
  )
}

// Where a cent sits on the card's own track, and the fill from the notch out to
// it — the same reading the row's own track gives against stock, one
// magnification further in.
//
// Out here rather than in the component because the React Compiler's codegen
// trips over a `Math` call on a value derived from an object argument (the
// `centsOf(props, …)` below), and a bailout costs the component its memoization
// with nothing but `pnpm compiler` to say so.
const centPct = (c: number) => ((c - CENT_MIN) / (CENT_MAX - CENT_MIN)) * 100

const centFill = (cents: number) => ({
  '--lo': `${centPct(cents < 0 ? cents : 0)}%`,
  '--hi': `${centPct(cents < 0 ? 0 : cents)}%`,
  '--def': `${centPct(0)}%`,
})

// What a range input answers to as a step, which is what tells a hand on the
// keyboard from a focus passing through.
const STEP_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
])

// The minor-adjustment card: the last two digits of the same number.
//
// Opened from the row's `minor` button rather than given a row of its own,
// because it is not a second control. There is one value; this is a magnified
// view of where it sits between two notches of its own step grid, and a
// permanent row would double the height of the group while giving one number
// two readouts and two ↺ to disagree over. What it costs instead is the space
// under the row for as long as it is asked for — a hover-revealed card dealt
// itself to every row travelled past on the way somewhere else, and covered the
// row below while the pointer was nowhere near either.
//
// Its whole width is one step of the control above, so a pixel here is worth
// about a third of a cent where a pixel up there is worth a whole step.
function Vernier(props: {
  id: string
  anchorName: string
  label: string
  min: number
  max: number
  step: number
  unit: string
  value: number
  disabled: boolean
  onChange: (v: number) => void
  onOpenChange: (open: boolean) => void
}) {
  const cents = centsOf(props, props.value)
  const fill: CSSProperties & Record<'--lo' | '--hi' | '--def', string> =
    centFill(cents)
  return (
    <div
      id={props.id}
      popover="auto"
      className={styles.vernier}
      style={{ positionAnchor: props.anchorName }}
      onToggle={e => props.onOpenChange(e.newState === 'open')}
    >
      <span className={styles.vernierHead}>
        <span>minor adjustment</span>
        {/* The reading the row cannot give: two places further in, which is
            exactly what a hundredth of the step is worth. */}
        <span className={styles.vernierExact}>
          {`${formatFine(props.value, props.step)}${props.unit}`}
        </span>
        <button
          type="button"
          className={styles.vernierClose}
          title="close"
          popoverTarget={props.id}
          popoverTargetAction="hide"
        >
          close
        </button>
      </span>
      <span className={styles.vernierBody}>
        <input
          type="range"
          className={styles.vernierRange}
          style={fill}
          min={CENT_MIN}
          max={CENT_MAX}
          step={1}
          value={cents}
          disabled={props.disabled}
          aria-label={`${props.label}, minor adjustment`}
          aria-valuetext={`${cents} hundredths of a step`}
          onDoubleClick={() => props.onChange(notchOf(props, props.value))}
          onChange={e =>
            props.onChange(atCents(props, props.value, Number(e.target.value)))
          }
        />
        <span className={styles.vernierCents}>
          {`${cents > 0 ? '+' : ''}${cents}¢`}
        </span>
      </span>
    </div>
  )
}

export function Slider(props: {
  label: string
  unit: string
  min: number
  max: number
  step: number
  value: number
  defaultValue: number
  onChange: (v: number) => void
  // What the ↺ and the track's double-click do, where putting the control back
  // is a gesture of its own rather than a write that happens to land on the
  // default. A control row hands over a verb that banks a step on the undo
  // walk; a row outside the look — a dialog setting, a deck's speed — has no
  // walk to bank on and leaves this out, and the reset is the plain write.
  onReset?: () => void
  // The hand arriving on the row — pointer down on the track, a step key on
  // it, a press on one of a discrete row's choices — before the value moves.
  // A control row banks a step on the undo walk here; a row outside the look
  // leaves it out, the same way it leaves out `onReset`.
  onBegin?: () => void
  // A discrete control: one label per integer value. Renders a toggle-button
  // group in place of the range input, still reading/writing the same number.
  choices?: string[]
  curve?: CurveName
  // The tuned range, when the travel now runs past it: a notch on the track at
  // each end that was widened, so extended territory is visible on the way in
  // rather than a surprise at the stop.
  redline?: readonly [number, number]
  help?: string
  // Present only while the control's prerequisite is unmet: this knob is
  // physically inert until another control opens its path. Clicking the note
  // sets the prerequisite.
  needs?: { hint: string; title: string; onFix: () => void }
  midi?: {
    label: string | null
    armed: boolean
    // Set while a bound knob hasn't caught this value: where the knob is
    // sitting, in control units.
    pickup?: number
    onArm: () => void
  }
  sync?: { label: string | null; live: boolean; onCycle: () => void }
  favorite?: { on: boolean; onToggle: () => void }
  // Whether something is driving this control, whether it is currently running,
  // and the two ways in. The lever is marked, never the value: the readout keeps
  // showing where the slider rests, because that is what presets, links and
  // saved looks store, and because a number that moves every frame is unreadable.
  mod?: {
    // What is patched here, or null on a row that could take a routing and
    // hasn't got one — the buttons and the menu both read this, so a row cannot
    // be marked as driven while having nothing to say about what by.
    patch: ModPatch | null
    on: boolean
    open: boolean
    // Park/restart — what the ❚❚/▶ button beside the routing chip does.
    onToggleOn: () => void
    // Unfold/fold the editor under the row. Opening a row with nothing patched
    // claims a routing first, so the first press already moves the picture.
    onOpenChange: (open: boolean) => void
    // Hand the slot back and fold the editor.
    onRemove: () => void
  }
  // The editor itself, rendered by the caller under the row.
  modEditor?: ReactNode
  // Offer the minor-adjustment card under the row: this control's step is a
  // floor the mechanism can see past. See vernier.ts.
  vernier?: true
}) {
  const inputId = useId()
  const [showHelp, setShowHelp] = useState(false)
  // Hovering the ? shows the text in place, so the help column can be skimmed
  // slider to slider; clicking still opens the dialog (range info, touch).
  const [hoverHelp, setHoverHelp] = useState(false)
  // The minor-adjustment card is asked for, not offered. It used to appear on
  // its own after a beat of hover, which put a card under the pointer while it
  // was on its way somewhere else and covered the row below it uninvited — for
  // a control most passes over a row never need.
  const [showVernier, setShowVernier] = useState(false)
  const vernierId = useId()
  const vernierAnchor = `--vernier-${vernierId.replaceAll(/\W/g, '')}`
  // Both hang off the same edge of the same row; the ? card wins because it is
  // asked for after the vernier already was and there is only room for one.
  // The vernier is a native popover now, so closing it from here means asking
  // the element itself rather than an unmount.
  useEffect(() => {
    if (showVernier && (hoverHelp || showHelp)) {
      document.getElementById(vernierId)?.hidePopover()
    }
  }, [showVernier, hoverHelp, showHelp, vernierId])
  const midi = props.midi
  const sync = props.sync
  const needs = props.needs
  const help = props.help
  const favorite = props.favorite
  const choices = props.choices
  const redline = props.redline
  // Live clock first: it narrows away the undefined case, so the division check
  // isn't comparing `null` against a value that may not exist.
  const locked = sync?.live === true && sync.label !== null
  // A curved control puts the range input on a 0..1 travel and converts, so the
  // fine end of the scale gets the room. The value it reads and writes is
  // unchanged, still landing on the control's own step grid.
  const curved = props.curve !== undefined
  // A mode switch whose options fit the track column keeps the ordinary
  // one-line row — name, switch, reading — instead of stacking. See
  // choicesFitTrack for what "fit" means and why it is not measured live.
  const inline = choices !== undefined && choicesFitTrack(choices)
  const atTravel = (t: number) => snapToStep(props, fromTravel(props, t))
  // Track fill anchors at the default, not the left edge: bipolar controls
  // read like a pan pot from center, and distance-from-stock shows at a glance.
  const pct = (v: number) =>
    Math.max(0, Math.min(100, toTravel(props, v) * 100))
  const valuePct = pct(props.value)
  const defPct = pct(props.defaultValue)
  const fill: CSSProperties & Record<'--lo' | '--hi' | '--def', string> = {
    '--lo': `${Math.min(valuePct, defPct)}%`,
    '--hi': `${Math.max(valuePct, defPct)}%`,
    '--def': `${defPct}%`,
  }
  // The two ends of the wobble, in the same travel the thumb sits on — so on a
  // curved control the band is as bunched as the scale under it. Only while it
  // is actually running: a held routing swings nothing, and a band drawn under
  // `held` would be the row claiming motion its own badge has just denied.
  const patch =
    props.mod === undefined || !props.mod.on ? null : props.mod.patch
  const reach = patch === null ? 0 : patch.depth * (props.max - props.min)
  const swing =
    patch === null || reach === 0
      ? null
      : {
          lo: pct(patch.bipolar ? props.value - reach : props.value),
          hi: pct(props.value + reach),
        }
  // The row's three parts, built once and then arranged two ways below. The
  // label names the input beside it rather than wrapping it: with the accessory
  // buttons inside a wrapping <label>, every one of their clicks forwarded to
  // the range input and nudged the value, so each button (and each toggle
  // option) had to preventDefault to stay harmless.
  // A button is an atomic inline, so the line may break between the label and
  // its ? — and on a wrapping label it reliably did, leaving the ? alone on a
  // line under "phosphor persistence". The last word rides in a nowrap span
  // with the button, so the break lands one word earlier instead. Two <label>s
  // for one input is deliberate: the accessible name is their concatenation, so
  // the split is invisible to a screen reader, and keeping the ? outside both
  // is what stops its clicks reaching the range input.
  const cut = props.label.lastIndexOf(' ')
  const head = cut < 0 ? '' : props.label.slice(0, cut + 1)
  const tail = cut < 0 ? props.label : props.label.slice(cut + 1)
  const naming = (
    <span className={styles.naming}>
      {choices ? head : <label htmlFor={inputId}>{head}</label>}
      <span className={styles.tail}>
        {choices ? tail : <label htmlFor={inputId}>{tail}</label>}
        {help === undefined ? null : (
          <IconButton
            title="what does this do?"
            className={styles.what}
            onClick={() => setShowHelp(true)}
            onMouseEnter={() => setHoverHelp(true)}
            onMouseLeave={() => setHoverHelp(false)}
          >
            ?
          </IconButton>
        )}
        {/* Beside the ? rather than out at the reading, because the label
            column is fr-sized: a word added here costs the track no width, and
            a group's tracks still start at one x whether or not a row offers
            this. It reads "minor", not "fine" — a group's own ▸ fine tweaks
            disclosure already owns that word, and three of the rows that carry
            this card live inside one. */}
        {props.vernier !== true || choices !== undefined ? null : (
          <button
            type="button"
            title={
              showVernier
                ? 'hide the minor adjustment'
                : `minor adjustment — trim ${props.label} in hundredths of a step`
            }
            className={cx(styles.what, showVernier && styles.whatOn)}
            aria-expanded={showVernier}
            popoverTarget={vernierId}
          >
            minor
          </button>
        )}
      </span>
    </span>
  )
  const reading = (v: number) =>
    choices
      ? (choices[v] ?? String(v))
      : `${formatValue(v, props.step)}${props.unit}`
  // How much room the number gets: the widest this rack's rows can need, with
  // the row's own width as the floor so a stray row outside a Rack still holds
  // its own shape. A *stacked* mode switch opts out — it reads on the label's
  // line, where reserving a column would only push the label around. An inline
  // one is in the column with everything else, and reserves its longest option
  // so that switching from "on" to "off" cannot re-solve its own row.
  const rack = use(RackContext)
  const readingStyle:
    | (CSSProperties & Record<'--reading-ch', number>)
    | undefined =
    choices === undefined
      ? {
          '--reading-ch': Math.max(
            rack,
            readingChars(props.min, props.max, props.step, props.unit),
          ),
        }
      : inline
        ? { '--reading-ch': Math.max(rack, ...choices.map(c => c.length)) }
        : undefined
  // What is wired to this row, marked beside the reading. Only ever what is
  // *set*: an unset affordance has nothing to say and its slot is the width the
  // label wanted. All of them are marks rather than buttons — the menu is the
  // one way to change any of this — except the two that are live states you
  // have to be able to get out of from the row you are looking at: a routed
  // row's `mod` holds the wobble still, and an armed ⚟ cancels the learn.
  const modProp = props.mod
  const badges = (
    <>
      {sync?.label == null ? null : (
        <span
          className={cx(
            styles.badge,
            sync.live ? styles.iconOn : styles.iconSyncSet,
          )}
          title={`locked to the beat (${sync.label})${sync.live ? '' : ' — no tempo yet: set one at the top of Modulation'}`}
        >
          ♩{sync.label}
        </span>
      )}
      {midi === undefined ? null : midi.armed ? (
        <IconButton
          title="listening for a knob — click to cancel"
          className={cx(styles.badge, styles.iconOn)}
          onClick={midi.onArm}
        >
          learn…
        </IconButton>
      ) : midi.label === null ? null : (
        <span
          className={cx(styles.badge, styles.iconMidiSet)}
          title={`MIDI CC${midi.label}`}
        >
          CC{midi.label}
        </span>
      )}
      {/* Modulation, in the open on every row that can take it. It used to be
          a ⋮ menu item, and the row showed nothing until something was patched
          — so the app's signature feature had no visible way in. Now an
          unpatched row carries a small `+ mod` button, and a patched one
          carries two: a ❚❚/▶ that holds the routing still and starts it again,
          and the routing itself, which unfolds the editor under the row.

          Words rather than a glyph, because a ∿ on its own says nothing to
          someone who has not been told, and both of these are buttons a reader
          should be able to tell are buttons before pointing at them. The chip
          says what is driving the row and how fast, in the routing's own
          colour, and trails a caret so it reads as a thing that opens. The
          hold button is separate because the two gestures used to share one
          chip: pressing the routing to change it held it still instead, which
          read as modulation being broken. */}
      {modProp === undefined ? null : modProp.patch === null ? (
        <button
          type="button"
          className={cx(styles.badge, styles.modAdd)}
          title={`add modulation — starts a slow sine wobble on ${props.label}, which you can then change`}
          aria-label={`add modulation to ${props.label}`}
          onClick={() => modProp.onOpenChange(true)}
        >
          + mod
        </button>
      ) : (
        <>
          <button
            type="button"
            aria-pressed={!modProp.on}
            className={cx(
              styles.badge,
              styles.modRun,
              !modProp.on && styles.modRunOff,
            )}
            title={
              modProp.on
                ? `hold ${props.label} still — the routing stays patched`
                : `start ${props.label} moving again, as it was dialed`
            }
            onClick={modProp.onToggleOn}
          >
            {modProp.on ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            aria-expanded={modProp.open}
            className={cx(
              styles.badge,
              styles.modChip,
              modProp.on ? styles.iconModSet : styles.iconModOff,
            )}
            title={`${modProp.patch.detail}${modProp.on ? '' : ', held still'} — click to ${modProp.open ? 'fold the editor away' : 'edit it'}`}
            onClick={() => modProp.onOpenChange(!modProp.open)}
          >
            {modProp.patch.reading}
            <span className={styles.modCaret}>{modProp.open ? '▴' : '▾'}</span>
          </button>
        </>
      )}
      {favorite?.on !== true ? null : (
        <span
          className={cx(styles.badge, styles.iconOn)}
          title="pinned to Favorites"
        >
          ★
        </span>
      )}
    </>
  )
  // The reading, and — the moment the row is off stock — the way back.
  //
  // Reset costs nothing to put in the open here because nothing new is drawn:
  // the number is already rendered, already in a column of its own, and it is
  // already the part of the row that knows it has been moved. Off stock it
  // turns amber (the panel's one colour for that, the same one the section dot
  // and a stage's `• N` wear, so a row now reports its own state instead of
  // being read against the track's tick) and takes the ↺ beside it.
  //
  // Both halves keep their box in both states, and that is the point: a reading
  // in a `ch` box sized off the control's definition, and a ↺ slot that is
  // reserved whether or not the glyph is in it. The number cannot move, so the
  // two fr columns beside it cannot re-solve, so the track cannot slide while
  // you are dragging it. The ↺'s width is the price — one glyph per row,
  // permanently — and it buys a track that stays where you grabbed it. The ink
  // is still conditional: at stock the slot is empty and the row is a plain
  // span, with no button in the accessibility tree to announce.
  const atStock = props.value === props.defaultValue
  const onReset = props.onReset
  const reset = () => {
    if (onReset === undefined) props.onChange(props.defaultValue)
    else onReset()
  }
  const onBegin = props.onBegin
  const begin = () => {
    if (onBegin !== undefined) onBegin()
  }
  const readingBox = (
    <>
      <span className={styles.reading} style={readingStyle}>
        {reading(props.value)}
      </span>
      <span className={cx(styles.revertMark, atStock && styles.markIdle)}>
        ↺
      </span>
    </>
  )
  const readout = (
    <span className={styles.value}>
      {atStock ? (
        <span className={styles.stock}>{readingBox}</span>
      ) : (
        <button
          type="button"
          className={styles.revert}
          title={`off stock — click to put it back to ${reading(props.defaultValue)} (or double-click the track)`}
          aria-label={`reset ${props.label} to ${reading(props.defaultValue)}`}
          onClick={() => reset()}
        >
          {readingBox}
        </button>
      )}
      {badges}
      <RowMenu
        label={props.label}
        favorite={favorite}
        mod={modProp}
        midi={midi}
        sync={sync}
      />
    </span>
  )
  const track = choices ? (
    <ToggleButtonGroup
      label={props.label}
      options={choices}
      value={props.value}
      disabled={locked}
      dense={inline}
      className={styles.trackCell}
      onChange={v => {
        begin()
        props.onChange(v)
      }}
    />
  ) : (
    <span className={cx(styles.rangeWrap, styles.trackCell)}>
      <input
        id={inputId}
        type="range"
        className={cx(styles.range, needs && styles.rangeInert)}
        style={fill}
        min={curved ? 0 : props.min}
        max={curved ? 1 : props.max}
        step={curved ? TRAVEL_STEP : props.step}
        value={curved ? toTravel(props, props.value) : props.value}
        // What the number *means*, which on a curved control the input cannot
        // say for itself: min/max/value there are a 0..1 travel, so the raw
        // announcement is "0.42" for a row reading 3.2 µs. The visible reading
        // is the honest one either way — it carries the unit, and a mode switch
        // rendered as a range announces its option name rather than its index.
        aria-valuetext={reading(props.value)}
        disabled={locked}
        // The plugin idiom, for free: the track is the biggest target on the
        // row and a double-click on it means "put this back" everywhere else a
        // fader lives. It carries no tooltip of its own — one on the track
        // would follow the pointer across every drag — so the reading's own
        // tooltip is where it is written down.
        onDoubleClick={() => reset()}
        onPointerDown={() => begin()}
        // Only the keys that move the thumb: a Tab through the row is not a
        // hand on it, and banking there would leave a step that undoes nothing.
        onKeyDown={e => {
          if (STEP_KEYS.has(e.key)) begin()
        }}
        onChange={e =>
          props.onChange(
            curved ? atTravel(Number(e.target.value)) : Number(e.target.value),
          )
        }
      />
      {/* Where the control rests at stock — the point the fill is measured
          from, and the one that says at a glance whether a row has been moved
          and which way. It was a 2px line inside the trough, painted by the
          shared track gradient, and on a row with a fill and a thumb near it
          there was nothing left to see.

          Not when stock is a stop, for the reason the redline below skips one:
          the end of the track already says it, and a mark half-overhanging the
          rounded cap is noise. Most rows here rest at their minimum, so this is
          the common case, not an edge one. */}
      {props.defaultValue > props.min && props.defaultValue < props.max ? (
        <span className={styles.defmark} style={{ left: `${defPct}%` }} />
      ) : null}
      {/* How far the routing on this row is swinging the value, drawn on the
          stretch of track it is swinging along. The reading cannot show it: it
          holds the *resting* value on purpose, because that is what a preset, a
          link and a saved look store, and a number rewritten every frame is
          unreadable. So depth was the one number in a routing with nowhere to
          appear outside its editor — and it is the one that decides whether a
          patch is a drift or a wreck.

          Not animated. A band standing still says the same thing every frame
          and costs no render, where a thumb tracking the wave would put every
          patched row through React at 60Hz to say what the band says by sitting
          there. It is the engine's own arithmetic — depth × the row's range,
          around the resting value, clamped to the ends (pipeline.ts › applyMod)
          — so a control parked at one end shows a band with nowhere to go on
          that side, which is the fault the editor's note spells out in words.

          Scaled by the motion fader, so the strip's ❚❚ collapses every band on
          the board: what the row draws is what the engine is about to do, not
          what the slot was dialed to. */}
      {swing === null ? null : (
        <span
          className={styles.swing}
          style={{ left: `${swing.lo}%`, right: `${100 - swing.hi}%` }}
        />
      )}
      {/* Soft takeover: the knob is here, the value is at the thumb, and
          nothing moves until one sweeps past the other. Without the mark
          the control just looks dead. */}
      {midi?.pickup === undefined ? null : (
        <span
          className={styles.pickup}
          style={{ left: `${pct(midi.pickup)}%` }}
          title="the knob is here — sweep it across the value to take over"
        />
      )}
      {/* Only the ends that actually grew get a notch: most widened controls
          were extended one way only, and a mark sitting on the stop is noise. */}
      {redline === undefined
        ? null
        : redline.map((edge, i) =>
            (i === 0 ? edge > props.min : edge < props.max) ? (
              <span
                key={edge}
                className={styles.redline}
                style={{ left: `${pct(edge)}%` }}
                title={`past here is beyond what the hardware would do — stable, but no longer a broken TV (stock range ends at ${reading(edge)})`}
              />
            ) : null,
          )}
    </span>
  )

  return (
    <div className={styles.slider} style={{ anchorName: vernierAnchor }}>
      {/* One line for a plain slider — name, track, readout — and two for a
          mode switch whose options are words ("alternate", "ssavi") and cannot
          be squeezed into a third of a sidebar. A switch that *does* fit there
          takes the one-line form, sitting in the track column where a fader
          would: `off|on` costs 59px against the column's 88px floor, and a row
          that can be one line has no business being two.

          The readout gets a column of its own rather than riding the label's
          line, which is what a first attempt did: at a third of the panel each
          the two of them together overflowed on any label carrying a
          parenthetical, and a fifth of the controls carry one — the label broke
          mid-phrase and the ? and ↺ scattered onto a line of their own. Split
          out, only the label wraps, and it wraps where a label should.

          The reading is written before the track and placed after it, by grid
          area (Slider.module.css). Same source order as the stacked branch
          above, and it is the order the narrow panel actually draws — where the
          row is two lines, the reading rides the label and the track is the one
          below. So the docked sidebar, which is where most of these rows are
          read, has its focus order and its layout agreeing; the wide form
          disagrees about two adjacent things on one line, which is the cheaper
          half of the trade. */}
      {choices && !inline ? (
        <div className={styles.rowStack}>
          <span className={styles.sliderTop}>
            {naming}
            {readout}
          </span>
          {track}
        </div>
      ) : (
        <div className={styles.row}>
          {naming}
          {readout}
          {track}
        </div>
      )}
      {needs ? (
        <button
          type="button"
          className={styles.needs}
          title={needs.title}
          onClick={needs.onFix}
        >
          inert — needs {needs.hint} · click to set
        </button>
      ) : null}
      {props.vernier !== true || choices !== undefined ? null : (
        <Vernier
          id={vernierId}
          anchorName={vernierAnchor}
          label={props.label}
          min={props.min}
          max={props.max}
          step={props.step}
          unit={props.unit}
          value={props.value}
          disabled={locked}
          onChange={props.onChange}
          onOpenChange={setShowVernier}
        />
      )}
      {props.modEditor}
      {hoverHelp && !showHelp && help !== undefined ? (
        <div className={styles.helpPop}>
          <HelpProse text={help} />
        </div>
      ) : null}
      {showHelp && help !== undefined ? (
        <SliderHelpDialog
          label={props.label}
          help={help}
          min={props.min}
          max={props.max}
          step={props.step}
          defaultValue={props.defaultValue}
          unit={props.unit}
          onClose={() => setShowHelp(false)}
        />
      ) : null}
    </div>
  )
}

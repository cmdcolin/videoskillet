import { useRef, useState } from 'react'

import { clamp01 } from '../core/math'
import { cx } from './cx'
import { Dialog } from './Dialog'
import { BulbIcon } from './icons'
import { PRESETS, matchPreset, presetLabel, presetLabelFor } from './presets'
import styles from './PresetsSection.module.css'
import { Section } from './Section'
import { usePersistedFlag } from './storage'
import ui from './ui.module.css'
import { useRecentPresets } from './useRecentPresets'

import type { Controls } from '../core/controls'
import type { PresetDef, PresetWeights } from './presets'
import type { CSSProperties } from 'react'

// Presets grouped under their labeled headers. Derived purely from the static
// PRESETS table, so it's computed once at module load, not every render.
const PRESET_GROUPS = PRESETS.reduce<{ name: string; defs: typeof PRESETS }[]>(
  (acc, p) => {
    const g = acc.find(x => x.name === p.group)
    if (g === undefined) acc.push({ name: p.group, defs: [p] })
    else g.defs.push(p)
    return acc
  },
  [],
)

// Click applies the preset outright; dragging sideways past a few pixels turns
// the button into a weight slider, mixing that preset onto the current look.
const DRAG_SLOP = 4
// Horizontal travel for the full 0→100% sweep. A fixed distance rather than the
// chip's own width, so a narrow chip ("clean") and a wide one ("vertical hold
// gone") scrub at the same rate, and the drag can run past the chip's edge —
// the pointer is captured, so it keeps tracking out there.
const DRAG_FULL = 120

// The preset gesture hint is shown until the user dismisses it with its ×;
// that choice persists, so it teaches once and then stops costing a row. It
// carries the drag and nothing else: it used to run four unrelated facts
// together, which spent the row's attention four ways and let one × dismiss
// tips the reader hadn't read. The rest are all in the help dialog, and the
// drag is the only one nothing else on screen can show you.
const HINT_STORE = 'video_feedback_preset_hint_dismissed'
// Whether the full grouped catalog is unfolded below the shortlist.
const ALL_STORE = 'video_feedback_presets_expanded'

// The shortlist a first visit opens on. Recents displace these as they
// accumulate, and `useRecentPresets` keeps eight — so this row is what a
// stranger sees and almost nobody sees twice. It is picked as a first
// impression rather than as a map of the catalog: the `+ N more…` chip and the
// grouped catalog behind it are what span the families.
//
// Chosen off contact sheets of the whole shortlist question rendered on both
// the source the app boots on and a photograph (scripts/contact.mjs, the
// method docs/CURATION.md's two screening rounds used). What that says:
//
// - Feedback is a third of the table and gets half the row. It is also where
//   the looks that read hardest live — `ringInTheHighlights` scored the highest
//   saturation of anything screened and is the only loud one that leaves the
//   subject photographic, since the key means the trails can only grow where
//   the picture is already lit.
// - `spiral` earns its place on the landing screen specifically. Bars are
//   full-height vertical bands, so a loop that only scales them gives bands
//   back and `tunnelOut` renders as very nearly nothing there; rotation breaks
//   that symmetry, so `spiral` is the one loop whose geometry shows before
//   anyone has loaded a clip.
// - `broadcast` came off. It is a near-clean baseline by design, and with
//   `clean` pinned at the head of the row it was the second chip that looks
//   like nothing happened.
const STARTERS = [
  'vhs',
  'ringInTheHighlights',
  'rainbowStorm',
  'spiral',
  'verticalHoldGone',
  'tunnelOut',
]
const SHORTLIST_MAX = 8

// The one explainer for the whole feature (behind the ? by the section title),
// so the compact chips carry no per-preset help of their own — each chip's blurb
// stays on hover.
function PresetsHelpDialog(props: { onClose: () => void }) {
  return (
    <Dialog title="Presets" size="prose" onClose={props.onClose}>
      <p className={ui.helpText}>
        Each preset is a named look that sets a whole bank of controls at once —
        five for a simple fault, twenty for a whole-board look — spread across
        every stage of the chain, because that is what it takes to recreate a
        particular signal fault or device. Hover one for what it does and how
        many controls it moves; “this look” in the bar above then lists every
        one of them as a live row you can drag.
      </p>
      <p className={ui.helpText}>
        Every preset but “clean” is also a fader: click to dial it fully in, or
        drag sideways for a partial amount. Either way it layers onto what’s
        already there rather than replacing it, and the fill shows how much is
        in — so stacking several accumulates their faults. “clean” is a plain
        reset: click it to clear them all.
      </p>
      <div className={ui.muted}>
        A mix lasts only until something else moves the look — a slider, mutate,
        a saved look — and then the fills reset, since a blended look can’t be
        traced back to exact amounts.
      </div>
    </Dialog>
  )
}

function PresetButton(props: {
  def: PresetDef
  weight: number
  active: boolean
  edited: boolean
  onApply: (name: string, patch: Partial<Controls>) => void
  onMixStart: () => void
  onMix: (name: string, w: number) => void
  onHover: (name: string | null) => void
}) {
  // Gesture bookkeeping only — nothing here should cause a render. The weight
  // is integrated one pointer step at a time, so a clamp at either end can't
  // bank travel the weight didn't follow: run past 100%, reverse, and the fill
  // turns with the drag instead of after paying the overshoot back. `lastX` is
  // null until the press has travelled far enough to mean a drag rather than a
  // click, which is also what tells pointerup which of the two it was.
  // Reading the pointer's absolute position across the chip instead made the
  // result depend on where in the chip the press landed — a stray wobble during
  // an ordinary click would teleport the mix to ~50% with nothing to say why.
  const dragRef = useRef<{
    pressX: number
    lastX: number | null
    w: number
    pointerId: number
  } | null>(null)
  const fill: CSSProperties & Record<'--w', string> = {
    '--w': `${Math.round(props.weight * 100)}%`,
  }
  // How many controls the chip moves — the fact the catalog was not saying. A
  // preset reads as one switch until you know it is a bundle, and the number is
  // what makes stacking two of them, or dragging one halfway in, mean anything.
  const touches = Object.keys(props.def.patch).length
  // "clean" is the reset (an empty patch): blendPresets can never mix it in at
  // any weight, so the drag-to-mix gesture is dead for it — plain click only,
  // hence no resize cursor advertising a gesture that does nothing, and no fill
  // to show an amount that can never be anything but nothing.
  const mixable = touches > 0
  const apply = () => props.onApply(props.def.name, props.def.patch)
  // One chip, with the drag hung off it where there is a drag to hang. It was
  // two whole buttons for one thing — same label, same hover, same
  // active/edited classes, all written out twice — and everything the two
  // genuinely differ in is what is now conditional: the fill, the resize
  // cursor, the sentence about dragging, and the pointer path itself.
  return (
    <button
      title={
        mixable
          ? `sets ${touches} controls at once — ${props.def.blurb} Drag sideways to mix it in partially.${props.edited ? ' The look has moved since.' : ''}`
          : props.def.blurb
      }
      style={mixable ? fill : undefined}
      className={cx(
        ui.btn,
        styles.chip,
        mixable && ui.presetBtn,
        props.active && ui.active,
        props.edited && ui.edited,
      )}
      onPointerEnter={() => props.onHover(props.def.name)}
      onPointerLeave={e => {
        props.onHover(null)
        // Leaving with the button up ends any gesture this chip still thinks it
        // has, and it is the one closer that is guaranteed to fire: to press
        // anywhere else you have to leave here first, so a chip cannot be left
        // armed for a release that starts somewhere else. During a real drag
        // the pointer is captured and this does not fire at all until the
        // release has already been dealt with.
        if (e.buttons === 0) dragRef.current = null
      }}
      onPointerDown={
        !mixable
          ? undefined
          : e => {
              // The primary button only. Any press at all used to arm the
              // fader, and a right-click's release then ran the same path a
              // click does — so right-clicking a chip to read its tooltip
              // applied the preset, in both browsers, measured.
              if (e.button === 0 && e.isPrimary) {
                e.currentTarget.setPointerCapture(e.pointerId)
                // onMixStart rebaselines the mix onto whatever is live, which
                // zeroes the weights when the look has drifted — and
                // props.weight already reads 0 in exactly that case, so this
                // stays the right starting point either way.
                dragRef.current = {
                  pressX: e.clientX,
                  lastX: null,
                  w: props.weight,
                  pointerId: e.pointerId,
                }
                props.onMixStart()
              }
            }
      }
      onPointerMove={
        !mixable
          ? undefined
          : e => {
              const d = dragRef.current
              if (d !== null) {
                if (e.buttons === 0 || e.pointerId !== d.pointerId) {
                  // A release this chip never saw — a context menu ate it, the
                  // tab lost focus mid-drag, the gesture was cancelled. The
                  // gesture used to be disarmed only by pointerup on this same
                  // chip, so one missed release left the chip armed for the
                  // rest of the session and plain hover scrubbed its weight
                  // with no button down. Whatever swallowed the release, the
                  // next move says the hand is empty, and that is enough.
                  dragRef.current = null
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                    // Held capture also pins :hover to this chip in Firefox.
                    e.currentTarget.releasePointerCapture(e.pointerId)
                  }
                } else {
                  // The slop is spent getting here, so the sweep starts from
                  // this point rather than jumping by however far the press had
                  // already drifted.
                  const from =
                    d.lastX === null &&
                    Math.abs(e.clientX - d.pressX) > DRAG_SLOP
                      ? e.clientX
                      : d.lastX
                  if (from !== null) {
                    d.w = clamp01(d.w + (e.clientX - from) / DRAG_FULL)
                    d.lastX = e.clientX
                    props.onMix(props.def.name, d.w)
                  }
                }
              }
            }
      }
      onPointerUp={
        !mixable
          ? undefined
          : e => {
              const d = dragRef.current
              if (d !== null && d.pointerId === e.pointerId) {
                dragRef.current = null
                if (d.lastX === null) apply()
              }
            }
      }
      onPointerCancel={
        !mixable
          ? undefined
          : () => {
              dragRef.current = null
            }
      }
      // A drag that loses its capture is over: nothing more is coming that the
      // weight should follow. A press that has not moved yet is deliberately
      // left alone, because that is the one this must not touch — spec has
      // capture released immediately *after* pointerup, and both browsers
      // measure that way, but an engine that fired it a moment earlier would
      // otherwise take the apply out of every click on a chip. Reading `lastX`
      // costs nothing and means the ordering no longer has to be true.
      onLostPointerCapture={
        !mixable
          ? undefined
          : () => {
              const d = dragRef.current
              if (d !== null && d.lastX !== null) dragRef.current = null
            }
      }
      // On a mixable chip, pointerup is what applies a press, so the click that
      // trails a mouse release must not apply it a second time. Keyboard
      // activation fires a bare click with no pointer events at all, and
      // detail === 0 is what tells the two apart. A chip with no drag has no
      // pointer path, so every press arrives here.
      onClick={e => {
        if (!mixable || e.detail === 0) apply()
      }}
    >
      {presetLabel(props.def)}
      {props.edited ? <span className={styles.editedDot} /> : null}
    </button>
  )
}

// The section is the catalog and nothing else. The verbs that used to close it
// out — compare, copy link, surprise, mutate, undo, redo — act on the whole
// board rather than on presets, and they moved to the LookBar under the
// masthead; this section had grown to a quarter of the sidebar, and they were
// the part of it that was not presets.
// The chips, and the line that describes whichever one is under the pointer.
// Its own component so the hover dies with the row it names. Section unmounts
// its children when it folds, and a chip that vanishes from under a resting
// pointer fires no pointerleave — so a `hovered` held a level up outlived the
// chips it was naming: Escape closes the open stage, which folds this section,
// and reopening it found the caption still describing a chip nobody was on.
function PresetCatalog(props: {
  active: PresetDef | undefined
  lastPreset: string | null
  weights: PresetWeights
  showAll: boolean
  onShowAll: () => void
  onApplyPreset: (name: string, patch: Partial<Controls>) => void
  onMixStart: () => void
  onMix: (name: string, w: number) => void
}) {
  const [hintDismissed, setHintDismissed] = usePersistedFlag(HINT_STORE)
  const { recent, noteUse } = useRecentPresets()
  // The hovered preset's blurb takes over the caption line: faster to browse
  // than the tooltip delay, and the only way touch users ever see the blurbs.
  const [hovered, setHovered] = useState<string | null>(null)

  // The shortlist: the reset, whatever is currently dialed into the mix (so a
  // "surprise me" recipe stays legible with the catalog folded), then recents,
  // topped up from the starters. Rendered in table order rather than pick
  // order, so a chip doesn't move under the pointer as habits shift.
  const live = new Set<string>()
  for (const name of [
    'clean',
    ...[...props.weights].filter(([, w]) => w > 0).map(([n]) => n),
    ...recent,
    ...STARTERS,
  ]) {
    if (live.size < SHORTLIST_MAX) live.add(name)
  }
  // What the row keeps while a pointer is inside it. Membership moves on its own
  // clock — a roll's recipe arrives as weights, and weights only count once the
  // morph has landed, about a second after the gesture that started it — so the
  // row used to rearrange itself under a resting hand: park on "rainbow storm",
  // roll, and a second later that spot is "mixer loop", which is what the click
  // then applies.
  //
  // Only membership is pinned. Every chip's fill still tracks the mix live, so a
  // roll lights up whatever of its recipe is already on the row; the rest of the
  // recipe arrives when the hand leaves, which is the price of a row that holds
  // still. Letting newcomers ride at the end instead reads as the better deal
  // and is not: an appended chip is on the row without being pinned to it, so
  // the next roll drops it out from under the pointer — the same bug, one turn
  // further on. Holding it too would mean accumulating a high-water mark across
  // renders, and a row that grows for as long as a hand rests on it.
  const [pinned, setPinned] = useState<Set<string> | null>(null)
  const picked = pinned === null ? live : pinned
  const shortlist = PRESETS.filter(p => picked.has(p.name))

  // The caption describes the chip under the pointer, so it may only name a
  // chip that is on screen. A chip can still go out from under a pointer that
  // never moved — the catalog opening, the section folding — and one that
  // vanishes fires no pointerleave, which left the caption describing a preset
  // nobody was on.
  const hoveredDef = PRESETS.find(
    p => p.name === hovered && (props.showAll || picked.has(p.name)),
  )
  const presetCaption = hoveredDef
    ? hoveredDef.blurb
    : props.active
      ? props.active.blurb
      : props.lastPreset === null
        ? // One line, not two. The caption's job is describing the chip under the
          // pointer; this is only what it says when there is no chip to describe,
          // and it was spending two lines of the panel's most expensive space on
          // a fact the ? beside the title covers in full and the control count on
          // every hover teaches by itself.
          // Short enough to hold one line at the panel's docked width, which is
          // the whole point of the rewrite: at two lines it saved nothing.
          'a bank of controls at once — click one'
        : `modified from "${presetLabelFor(props.lastPreset)}"`
  // The count rides the caption whenever the caption is describing a particular
  // preset, so browsing the chips teaches the thing the chips cannot say: this
  // is not a switch, it is N controls moving together. "clean" has an empty
  // patch and gets no badge — it is the reset, and "0 controls" would read as
  // broken rather than as "puts everything back".
  const captionDef = hoveredDef ?? props.active
  const captionTouches =
    captionDef === undefined ? 0 : Object.keys(captionDef.patch).length

  const renderButton = (p: PresetDef) => (
    <PresetButton
      key={p.name}
      def={p}
      weight={props.weights.get(p.name) ?? 0}
      active={props.active?.name === p.name}
      edited={props.active === undefined && props.lastPreset === p.name}
      onApply={(name, patch) => {
        noteUse(name)
        props.onApplyPreset(name, patch)
      }}
      onMixStart={props.onMixStart}
      onMix={(name, w) => {
        noteUse(name)
        props.onMix(name, w)
      }}
      onHover={setHovered}
    />
  )

  return (
    <>
      {hintDismissed ? null : (
        <div className={cx(ui.hint, ui.dismissHint)}>
          <span className={ui.hintIcon}>
            <BulbIcon />
          </span>
          <span>drag a preset sideways to mix it in partially</span>
          <button
            className={ui.hintX}
            title="dismiss this hint"
            aria-label="dismiss hint"
            onClick={() => setHintDismissed(true)}
          >
            ×
          </button>
        </div>
      )}
      {props.showAll ? null : (
        // The pin goes on the row rather than on each chip: enter and leave
        // don't fire for a move between two chips inside it, so this is one
        // pair of events per visit to the row, and it covers the gap between
        // two chips as well as the chips themselves. The full catalog needs
        // none of it — it renders every preset in table order, so there is
        // nothing there for membership to change.
        <div
          onPointerEnter={() => setPinned(live)}
          onPointerLeave={() => setPinned(null)}
        >
          {shortlist.map(renderButton)}
          <button
            className={styles.moreChip}
            title="every preset, grouped by the kind of fault it models"
            onClick={() => props.onShowAll()}
          >
            + {PRESETS.length - shortlist.length} more…
          </button>
        </div>
      )}
      {props.showAll
        ? PRESET_GROUPS.map(grp => (
            <div key={grp.name} className={styles.presetGroup}>
              <div className={styles.grpLabel}>{grp.name}</div>
              {grp.defs.map(renderButton)}
            </div>
          ))
        : null}
      {/* Clamped, and carrying the whole line as its tooltip: half the blurbs
          run past three lines in a panel this narrow, and letting the caption
          grow to five meant sweeping the chips pumped everything below it up
          and down by 60px. */}
      <div className={styles.caption} title={presetCaption}>
        {captionTouches === 0 ? null : (
          <span className={styles.captionCount}>
            {captionTouches} controls ·{' '}
          </span>
        )}
        {presetCaption}
      </div>
    </>
  )
}

export function PresetsSection(props: {
  controls: Controls
  lastPreset: string | null
  weights: PresetWeights
  // The stage the panel has open, as a token for "browsing is over" — see
  // Section's `foldOn`. The catalog hands its 162px to the stage that was just
  // opened over it, and is a click away for the rest of the session.
  openStage: string | null
  onApplyPreset: (name: string, patch: Partial<Controls>) => void
  onMixStart: () => void
  onMix: (name: string, w: number) => void
}) {
  const [showHelp, setShowHelp] = useState(false)
  const [showAll, setShowAll] = usePersistedFlag(ALL_STORE)
  const active = matchPreset(props.controls)

  return (
    <>
      <Section
        title="Presets"
        foldOn={props.openStage}
        // What the fold above costs you: the chips are gone and this is the line
        // that says which of them you are on, so folding the catalog is free in
        // the same way folding any other section is.
        summary={
          active
            ? presetLabel(active)
            : props.lastPreset === null
              ? undefined
              : `from "${presetLabelFor(props.lastPreset)}"`
        }
        help={({ openSection }) => (
          <>
            <button
              className={cx(styles.allBtn, showAll && styles.allBtnOn)}
              aria-pressed={showAll}
              title={
                showAll
                  ? 'fold the catalog back to your shortlist'
                  : 'every preset, grouped by the kind of fault it models'
              }
              // Unfolding the catalog with the section itself folded put 74 chips
              // somewhere you can't see, so the button read as broken. Asking for
              // the catalog is asking to see it.
              onClick={() => {
                if (!showAll) openSection()
                setShowAll(!showAll)
              }}
            >
              all
              <span className={styles.allCount}>{PRESETS.length}</span>
            </button>
            <button
              className={styles.helpBtn}
              title="what are presets?"
              onClick={() => setShowHelp(true)}
            >
              ?
            </button>
          </>
        )}
      >
        {/* Keyed on the switch, so the hover is rebuilt along with the row it
            names: `all` destroys every chip in the shortlist and mounts the
            grouped catalog in its place, the chip under the pointer among them,
            and a destroyed chip fires no pointerleave. Chrome then held the
            stale name for the rest of the session; Firefox re-hit-tested its
            way out. */}
        <PresetCatalog
          key={showAll ? 'catalog' : 'shortlist'}
          active={active}
          lastPreset={props.lastPreset}
          weights={props.weights}
          showAll={showAll}
          onShowAll={() => setShowAll(true)}
          onApplyPreset={props.onApplyPreset}
          onMixStart={props.onMixStart}
          onMix={props.onMix}
        />
      </Section>
      {/* Outside the Section rather than among its children: the ? that opens
          this rides the header, which is on screen whether or not the section is
          folded, so a dialog held in the body had nowhere to open from — the
          button did nothing until the section was unfolded, and then the dialog
          appeared on its own. */}
      {showHelp ? (
        <PresetsHelpDialog onClose={() => setShowHelp(false)} />
      ) : null}
    </>
  )
}

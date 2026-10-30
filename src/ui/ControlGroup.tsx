import { useEffect, useRef, useState } from 'react'

import { DEFAULT_CONTROLS, atRest } from '../core/controls'
import { clampCardText } from '../sources/teletype'
import { WIKI_PAGE } from '../sources/wikitext'
import { AudioDiagram } from './AudioDiagram'
import { BeamDiagram } from './BeamDiagram'
import { BusDiagram } from './BusDiagram'
import { CableDiagram } from './CableDiagram'
import { CameraLoopDiagram, TubeFaceDiagram } from './CameraLoopDiagram'
import { useCaptionApi } from './CaptionContext'
import { activeCardPreset, cardPresetsFor } from './cardPresets'
import { ChromaKeyDiagram } from './ChromaKeyDiagram'
import { CaptionDiagram, ChyronDiagram } from './ChyronDiagram'
import styles from './ControlGroup.module.css'
import {
  CAMERA_LOOP_GROUP,
  FEED_A_CABLE_GROUP,
  FEED_B_CABLE_GROUP,
  GROUPS,
  MIXER_LOOP_GROUP,
  MUTATE_CIRCUIT_BY_GROUP,
  NEEDS,
  needMet,
  sliderFor,
  SYNTH_GROUP,
  TUBE_FACE_GROUP,
} from './controls'
import {
  useControlReading,
  useControls,
  useControlsApi,
  useControlValue,
} from './ControlsContext'
import { CrosspointDiagram } from './CrosspointDiagram'
import { cx } from './cx'
import { DecoderDiagram } from './DecoderDiagram'
import { DeflectionDiagram } from './DeflectionDiagram'
import { BoxScope } from './diagram'
import { DRIFT_MODE_WORDS, DRIFT_SECONDS } from './drift'
import { DubDiagram } from './DubDiagram'
import { EnhancerDiagram } from './EnhancerDiagram'
import { FeedACableDiagram, FeedBCableDiagram } from './FeedCableDiagram'
import { filterActive, matchedSliders, useFilter } from './filter'
import { unitSuffix } from './format'
import { LeakDiagram } from './LeakDiagram'
import { LoopTrip } from './LoopTrip'
import { MagnifierFrame } from './MagnifierFrame'
import { SYNCABLE_KEYS } from './midi'
import { MixerLoopDiagram } from './MixerLoopDiagram'
import { ModRowEditor } from './ModRowEditor'
import { modPatch } from './modSlots'
import { useModSlotsApi } from './ModSlotsContext'
import { mutateAmountFor } from './mutate'
import { NoiseDiagram } from './NoiseDiagram'
import { PhosphorDiagram } from './PhosphorDiagram'
import { PipControl } from './PipControl'
import { PurityFrame } from './PurityFrame'
import { RecordingDiagram } from './RecordingDiagram'
import { RfDiagram } from './RfDiagram'
import { rowClaim } from './rollMod'
import { sameKeySet, sameList } from './sameList'
import { SCHEMATICS, type SchematicGroup } from './schematicKeys'
import { Section } from './Section'
import { useSignalDiagrams } from './signalDiagrams'
import { SIGNAL_TAPS, tapFor } from './signalTap'
import { useSignalTapApi } from './SignalTapContext'
import { Rack, Slider } from './Slider'
import { SyncDiagram } from './SyncDiagram'
import { SynthDiagram } from './SynthDiagram'
import { TimebaseDiagram } from './TimebaseDiagram'
import { VhsDiagram } from './VhsDiagram'
import { WipeFrame } from './WipeFrame'

import type { ControlKey } from '../core/controls'
import type { CardPreset } from './cardPresets'
import type { Group, SliderDef, SliderNeed } from './controls'
import type { ControlsApi } from './ControlsContext'
import type { ReactElement } from 'react'

const SYNCABLE_SET = new Set<ControlKey>(SYNCABLE_KEYS)

// One control row. A component, not a render function, so building it costs a
// props object: the panel holds 121 rows and mounts about six, and the render
// function did every row's gate lookup and accessory allocation per write.
export function ControlSlider(props: {
  slider: SliderDef
  // Gates already announced by the group's banner, so the row skips its own
  // copy of the same note.
  muted?: ReadonlySet<ControlKey>
}) {
  const api = useControlsApi()
  const mod = useModSlotsApi()
  const s = props.slider
  const modOpen = mod.editing.has(s.key)
  const need = NEEDS[s.key]
  // Two subscriptions, and the row re-renders when either changes and at no
  // other time.
  const value = useControlValue(s.key)
  // Whether the gate is closed at all, as opposed to whether this row is the
  // one that says so: a banner-muted row is still inert, and offering to
  // modulate a control whose path is shut would start an LFO nothing can show.
  const inert = useControlReading(c => need !== undefined && !needMet(need, c))
  const unmet =
    need !== undefined && inert && props.muted?.has(need.key) !== true
  const slot = mod.modFor(s.key)
  // What this row would patch if asked, and null on a row that may not ask —
  // the view controls, and a strobe that is not already running. rollMod owns
  // both rules, so the button and the roll beside it cannot drift apart.
  const claim = rowClaim(s, value)
  return (
    <Slider
      label={s.label}
      unit={s.unit}
      min={s.min}
      max={s.max}
      step={s.step}
      value={api.lockedValue(s.key) ?? value}
      defaultValue={DEFAULT_CONTROLS[s.key]}
      onChange={v => api.writeControl(s.key, v)}
      onReset={() => api.resetControl(s.key)}
      resetSeconds={api.resetSeconds}
      onBegin={() => api.beginHand()}
      choices={s.choices}
      curve={s.curve}
      redline={s.redline}
      vernier={s.vernier}
      help={s.help}
      needs={unmet ? needsNote(need, api) : undefined}
      favorite={{
        on: api.favorites.has(s.key),
        onToggle: () => api.toggleFavorite(s.key),
      }}
      midi={
        api.midiReady
          ? {
              label: api.bindLabel(s.key),
              armed: api.armed === s.key,
              pickup: api.pickup(s.key),
              onArm: () => api.toggleArm(s.key),
            }
          : undefined
      }
      sync={
        api.midiReady && SYNCABLE_SET.has(s.key)
          ? {
              label: api.syncLabel(s.key),
              live: api.clockLive,
              onCycle: () => api.cycleSync(s.key),
            }
          : undefined
      }
      // Not offered on a row whose gate is shut, and not on a choice control:
      // stepping a mode enum with an LFO picks tubes nobody asked for.
      //
      // Unless it is already routed — a preset, a link or a since-closed gate
      // can all leave one there, and hiding the badge on those rows hid the only
      // way to see what is driving the control or to hand the slot back. The
      // rule is about what may be *claimed*, not about what may be shown.
      mod={
        slot !== null || (!inert && s.choices === undefined && claim !== null)
          ? {
              patch: slot === null ? null : modPatch(slot, mod.bpm, mod.master),
              // Running, as opposed to merely patched. The badge is the switch
              // and this is what it reads.
              on: slot?.on === true,
              open: modOpen,
              // The one-click park, from the row you are already looking at. It
              // keeps the source, rate and depth — the point of it is that the
              // wobble comes back exactly as you dialed it.
              onToggleOn: () => {
                if (slot !== null) mod.setSlotOn(s.key, !slot.on)
              },
              onOpenChange: open => {
                // Claim on open, so the first press already moves the picture
                // rather than handing over an editor with nothing patched into
                // it. Handing the slot back is the remove button, one click
                // away — a claim you can see and undo beats a form to fill in.
                if (open && slot === null && claim !== null) {
                  mod.setSlotForKey(s.key, claim)
                }
                mod.setEditing(s.key, open)
              },
              onRemove: () => mod.setSlotForKey(s.key, null),
            }
          : undefined
      }
      modEditor={
        modOpen ? <ModRowEditor controlKey={s.key} claim={claim} /> : undefined
      }
    />
  )
}

// The note under an inert control, and the one-click fix for its gate.
function needsNote(need: SliderNeed, api: ControlsApi) {
  const prereq = sliderFor(need.key)
  return {
    hint: need.hint,
    title: `does nothing until "${prereq.label}" moves — click to set it to ${need.fix}${unitSuffix(prereq.unit)}`,
    onFix: () => api.writeControl(need.key, need.fix),
  }
}

// These groups' geometry is dragged on a miniature of the picture rather than
// read off sliders; the sliders stay behind the reveal, where MIDI and clock
// sync live.
function WipeControl() {
  const controls = useControls()
  const { writeControl } = useControlsApi()
  return (
    <WipeFrame
      mode={controls.wipeMode}
      pos={controls.wipePos}
      soft={controls.wipeSoft}
      swept={controls.wipeRate > 0}
      inert={controls.wipeMode < 1}
      onFix={() => writeControl('wipeMode', 1)}
      onChange={pos => writeControl('wipePos', pos)}
    />
  )
}

function PurityControl() {
  const controls = useControls()
  const { writeControl, writeControls } = useControlsApi()
  return (
    <PurityFrame
      inert={controls.crtPurity === 0}
      // Enough to see the stain without swamping the picture — the same job the
      // `fix` value on a NEEDS gate does for a slider row.
      onFix={() => writeControl('crtPurity', 0.6)}
      patch={{
        x: controls.crtPurityX,
        y: controls.crtPurityY,
        size: controls.crtPuritySize,
      }}
      // One write for all three, so placing the patch notifies once.
      onChange={patch =>
        writeControls({
          ...controls,
          crtPurityX: patch.x,
          crtPurityY: patch.y,
          crtPuritySize: patch.size,
        })
      }
    />
  )
}

function ZoomControl() {
  const controls = useControls()
  const { writeControls } = useControlsApi()
  return (
    <MagnifierFrame
      zoom={controls.crtZoom}
      point={{ x: controls.crtZoomX, y: controls.crtZoomY }}
      // One write for both axes, so aiming the lens notifies once.
      onChange={point =>
        writeControls({ ...controls, crtZoomX: point.x, crtZoomY: point.y })
      }
      // A box dragged on the miniature sets where and how far in together, so
      // the magnification travels with the aim in the same single write.
      onLens={lens =>
        writeControls({
          ...controls,
          crtZoom: lens.zoom,
          crtZoomX: lens.x,
          crtZoomY: lens.y,
        })
      }
    />
  )
}

// Wherever frameLock's own group ends up living, rather than a hardcoded group
// name: both are non-signal "how the picture is watched" controls, so they
// belong beside each other, and pinning to frameLock's key survives the group
// being renamed or reshuffled in a way a literal string wouldn't.
const TAP_HOST_GROUP = GROUPS.find(g =>
  g.sliders.some(s => s.key === 'frameLock'),
)?.name

// Not a ControlKey — dbgView lives on the engine, outside Controls, so this
// reads its own context instead of useControlsApi(). Laid out like frameLock
// rather than stepped: it decides what the picture on screen even is, which
// is worth reaching directly rather than cycling through.
function SignalTapControl() {
  const { tap, onTap } = useSignalTapApi()
  const index = SIGNAL_TAPS.findIndex(t => t.value === tapFor(tap).value)
  return (
    <Slider
      label="signal tap"
      unit=""
      min={0}
      max={SIGNAL_TAPS.length - 1}
      step={1}
      value={index}
      defaultValue={0}
      choices={SIGNAL_TAPS.map(t => t.short)}
      help={`View a point inside the decode instead of the finished picture.

        - **waveform** — the whole line as brightness, sync tip and burst
          included, squeezed into the picture width.
        - **luma** — Y after Y/C separation.
        - **chroma** — the demodulated axes as false colour: red |U|, green |V|.
        - **burst** — what the receiver measured: red burst amplitude, green
          phase error, blue the gain the ACC settled at.
        - **scope** — one line traced against an IRE graticule, sync tip and
          burst included, with the picture dimmed above it.

        Advanced settings has the same picker with a longer note; the ☰ trigger
        only badges whichever tap is live.`}
      onChange={i => onTap(SIGNAL_TAPS[i]!.value)}
    />
  )
}

// The caption's own group, found by its control the way the tap's host is.
const CAPTION_HOST_GROUP = GROUPS.find(g =>
  g.sliders.some(s => s.key === 'cc'),
)?.name

// What the encoder is sending on line 21. Not a control — it is words, not a
// quantity, so it reads its own context and no preset or random nudge touches
// it. A textarea because a caption is lines: each one rolls the page as it
// lands, and the wrap is a preview of how thirty-two columns will break.
function CaptionControl() {
  const { caption, onCaption } = useCaptionApi()
  return (
    <>
      <textarea
        className={styles.captionField}
        rows={2}
        value={caption}
        placeholder="what line 21 is carrying"
        // The same words as the placeholder, because a placeholder is not a
        // name: it is the weakest thing an assistive technology will fall back
        // to, and it is gone the moment there is a caption to read. Every other
        // field in the panel says what it is (TeletypeRow's carries a title);
        // this one and the editor's were the two that said nothing.
        aria-label="what line 21 is carrying"
        spellCheck={false}
        onChange={e => onCaption(clampCardText(e.target.value))}
      />
      <WikiCaptionRow />
      <p className={styles.captionNote}>
        Sent as data, a character at a time. What arrives is whatever survived
        the chain.
      </p>
    </>
  )
}

function WikiCaptionRow() {
  const { wiki } = useCaptionApi()
  return (
    <>
      <div className={styles.cardChips}>
        <button
          type="button"
          className={styles.cardChip}
          disabled={wiki.busy}
          title="A few sentences from the Wikipedia article on what the picture shows, or from a random article when the deck has nothing off Commons or archive.org on it"
          onClick={wiki.roll}
        >
          {wiki.busy ? 'Fetching…' : 'From Wikipedia'}
        </button>
        <label className={styles.captionCheck}>
          <input
            type="checkbox"
            checked={wiki.follow}
            onChange={e => {
              wiki.setFollow(e.target.checked)
            }}
          />
          follow the picture
        </label>
      </div>
      {wiki.error !== '' ? (
        <p className={styles.captionNote}>{wiki.error}</p>
      ) : wiki.passage !== null ? (
        <p className={styles.captionNote}>
          {wiki.passage.matched
            ? 'From '
            : 'Nothing on Wikipedia matched the picture. From a random article, '}
          <a
            href={
              WIKI_PAGE +
              encodeURIComponent(wiki.passage.article.replace(/ /g, '_'))
            }
            target="_blank"
            rel="noreferrer"
          >
            {wiki.passage.article}
          </a>
        </p>
      ) : null}
    </>
  )
}

// Headers that would wrap to three lines beside the three verbs.
const HEADING: Partial<Record<string, string>> = {
  [CAMERA_LOOP_GROUP]: 'Camera loop (optical)',
  [MIXER_LOOP_GROUP]: 'Mixer loop (electrical)',
  [TUBE_FACE_GROUP]: 'Tube face',
  'Character generator (chyron)': 'Chyron',
}

const SCHEMATIC_FRAMES: Record<SchematicGroup, () => ReactElement> = {
  [CAMERA_LOOP_GROUP]: CameraLoopDiagram,
  [TUBE_FACE_GROUP]: TubeFaceDiagram,
  [MIXER_LOOP_GROUP]: MixerLoopDiagram,
  'Character generator (chyron)': ChyronDiagram,
  Captions: CaptionDiagram,
  Decoder: DecoderDiagram,
  'Recording (luma & FM)': RecordingDiagram,
  Sync: SyncDiagram,
  Deflection: DeflectionDiagram,
  Timebase: TimebaseDiagram,
  'VHS colour & tracking': VhsDiagram,
  'Enhancer (bent)': EnhancerDiagram,
  'Noise & interference': NoiseDiagram,
  'A/B Mixer': BusDiagram,
  Crosspoint: CrosspointDiagram,
  [SYNTH_GROUP]: SynthDiagram,
  'Dropouts & dubs': DubDiagram,
  'RF / Tuner': RfDiagram,
  'Cable / Wiring': CableDiagram,
  'Audio routings': AudioDiagram,
  [FEED_A_CABLE_GROUP]: FeedACableDiagram,
  [FEED_B_CABLE_GROUP]: FeedBCableDiagram,
  'Ghosting & leakage': LeakDiagram,
  'Chroma key (A through B)': ChromaKeyDiagram,
  Beam: BeamDiagram,
  Phosphor: PhosphorDiagram,
}

const FRAMES: {
  group: string
  keys: ReadonlySet<ControlKey>
  Frame: () => ReactElement
}[] = [
  {
    group: 'Wipe (A/B)',
    keys: new Set<ControlKey>(['wipePos']),
    Frame: WipeControl,
  },
  {
    group: 'PiP inset (source B)',
    keys: new Set<ControlKey>(['pipX', 'pipY', 'pipW', 'pipH']),
    Frame: PipControl,
  },
  {
    group: 'Mask & convergence',
    keys: new Set<ControlKey>(['crtPurityX', 'crtPurityY', 'crtPuritySize']),
    Frame: PurityControl,
  },
  {
    group: 'View',
    keys: new Set<ControlKey>(['crtZoomX', 'crtZoomY']),
    Frame: ZoomControl,
  },
  ...SCHEMATICS.map(({ group, keys }) => ({
    group,
    keys: new Set<ControlKey>(keys),
    Frame: SCHEMATIC_FRAMES[group],
  })),
]

// A list of rows, and the component boundary is the point of it.
//
// The group header around it reads the controls — it has counts to show and
// gates to check — so its own JSX is rebuilt whenever a count changes, and rows
// built inline there would be rebuilt with it. Behind this boundary the compiler
// memoizes on two props that a write does not touch, so React skips the lot.
// Both props therefore have to keep their identity across a write: `sliders`
// comes through sameList, `muted` through sameKeySet.
export function ControlRows(props: {
  sliders: readonly SliderDef[]
  muted?: ReadonlySet<ControlKey>
}) {
  // Wrapped rather than returning the array bare: the compiler only treats a
  // function as a component worth memoizing if it returns JSX, and this one
  // exists solely to be memoized.
  return (
    <>
      {props.sliders.map(s => (
        <ControlSlider key={s.key} slider={s} muted={props.muted} />
      ))}
    </>
  )
}

// A group's gates, one entry per distinct gate. Two rows can sit behind the
// same control with different conditions on it, so an entry is a SliderNeed
// rather than a key.
const NEEDS_OF = new WeakMap<Group, readonly SliderNeed[]>()
function needsOf(group: Group): readonly SliderNeed[] {
  const known = NEEDS_OF.get(group)
  if (known !== undefined) return known
  const needs = [...new Set(group.sliders.flatMap(s => NEEDS[s.key] ?? []))]
  NEEDS_OF.set(group, needs)
  return needs
}

// Every control the rows on screen are gated on, and how many of those rows are
// shut — which is a fact about the rows, not about where the controls are. Two
// rows gated on one control can differ on whether a second path opens them, so
// each row counts by its own need, and the banner speaks for the plain one.
function gatesBehind(
  onScreen: readonly SliderDef[],
  isShut: (need: SliderNeed) => boolean,
): { need: SliderNeed; n: number }[] {
  const gates = new Map<ControlKey, { need: SliderNeed; n: number }>()
  for (const s of onScreen) {
    const need = NEEDS[s.key]
    if (need === undefined || !isShut(need)) continue
    const seen = gates.get(need.key)
    if (seen === undefined) gates.set(need.key, { need, n: 1 })
    else {
      seen.n += 1
      if (seen.need.also !== undefined) seen.need = need
    }
  }
  return [...gates.values()]
}

// How long randomize has to stay down before the press becomes a train, and how
// far apart the train's nudges land. Both are long by UI standards on purpose:
// at the 180ms it first repeated at, a hold was a shuffle nobody could stop on
// the look they liked. The delay is also what keeps a click a click — no
// ordinary press is on the button for half a second.
const ROLL_HOLD_MS = 500
const ROLL_TRAIN_MS = 800

// The row of chips over a card's rows. A component of its own because it reads
// which chip is lit, which changes on a write the header does not care about.
// The reading is the lit chip's name, so a write that lights no other chip
// re-renders nothing here.
function CardChips(props: { group: Group; chips: CardPreset[] }) {
  const { group, chips } = props
  const { landCard } = useControlsApi()
  const lit = useControlReading(c => activeCardPreset(group, c)?.name ?? '')
  return (
    <div className={styles.cardChips}>
      {chips.map(chip => (
        <button
          key={chip.name}
          type="button"
          className={cx(
            styles.cardChip,
            lit === chip.name ? styles.cardChipOn : undefined,
          )}
          aria-pressed={lit === chip.name}
          title={`${chip.blurb} — puts this card back to stock first, and leaves the rest of the look alone`}
          onClick={() => {
            landCard(chip, group)
          }}
        >
          {chip.name}
        </button>
      ))}
    </div>
  )
}

// The fold over a group's fine tier. A component of its own because it counts
// the touched trims behind it, which changes on a write the rest of the group
// does not care about.
function FineToggle(props: {
  fine: readonly SliderDef[]
  open: boolean
  mod: boolean
  onToggle: () => void
}) {
  const { fine } = props
  const touched = useControlReading(
    c => fine.filter(s => !atRest(c[s.key], s.key)).length,
  )
  return (
    <button
      className={styles.sliderToggle}
      aria-expanded={props.open}
      onClick={props.onToggle}
      title="trims that shape an effect something else turns on"
    >
      {props.open ? (
        '▾ fine tweaks'
      ) : (
        <>
          {`▸ ${fine.length} fine tweaks`}
          {touched === 0 ? null : (
            <span className={styles.fineTouched}>
              {` · ${touched} touched`}
            </span>
          )}
          {props.mod ? <span className={styles.fineMod}> · mod</span> : null}
        </>
      )}
    </button>
  )
}

export function ControlGroup(props: { group: Group; defaultOpen?: boolean }) {
  const { group } = props
  const {
    writeControl,
    mutateGroup,
    resetGroup,
    driftingGroups,
    driftMode,
    toggleGroupDrift,
  } = useControlsApi()
  const mod = useModSlotsApi()
  const filter = useFilter()
  // Randomize's timers, while it is held: the wait before a hold becomes a
  // train, and the train itself. Refs rather than state — they only ever get
  // started and stopped, never read to render anything.
  const rollDelay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const rollTrain = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  )
  const stopRoll = () => {
    clearTimeout(rollDelay.current)
    clearInterval(rollTrain.current)
    rollDelay.current = undefined
    rollTrain.current = undefined
  }
  useEffect(
    () => () => {
      clearTimeout(rollDelay.current)
      clearInterval(rollTrain.current)
    },
    [],
  )
  // A live filter drops the miniature, so a search can reach the sliders it
  // stands in for, and so does a schematic left folded. The wipe, PiP, mask and
  // view miniatures are controls, and stay.
  const [showFramed, setShowFramed] = useState(false)
  const [showFine, setShowFine] = useState(false)
  // The group reads two primitives off the controls. This component builds
  // every row in the group, and a component that reads the whole board
  // re-renders on every write. With two primitives, a write to some other
  // control returns the same answers and React skips the group entirely.
  //
  // Both are read before anything below is built. The React Compiler cannot
  // memoize a value built before a hook call and used after it, and a reading
  // taken further down left the whole group, header and rows, unmemoized.
  //
  // `touched` is a count, which the header shows (Section's `dot`). The stage's
  // heading sums the same predicate, so the two agree by construction.
  const touched = useControlReading(
    c => group.sliders.filter(s => !atRest(c[s.key], s.key)).length,
  )
  // Which of the group's gates are shut, one character per entry in
  // `needsOf(group)`. Read over the whole group, so the reading does not depend
  // on which rows are showing; `banners` below narrows it to the rows on screen.
  const shut = useControlReading(c =>
    needsOf(group)
      .map(need => (needMet(need, c) ? '-' : 'x'))
      .join(''),
  )
  // Below the readings for the reason they sit above everything else: the
  // compiler cannot tell `drifting` is a boolean, and treats it as handed to
  // `cx` to change, so read above a hook it cost the group its memoization.
  const driftable = MUTATE_CIRCUIT_BY_GROUP.has(group.name)
  const drifting = driftingGroups.has(group.name)
  const driftWords = DRIFT_MODE_WORDS[driftMode]
  // The menu's switch sets every group's schematic; this group's own fold
  // overrides it until the menu's switch moves again.
  const diagrams = useSignalDiagrams()
  const [here, setHere] = useState<{ everywhere: boolean; drawn: boolean }>()
  if (here !== undefined && here.everywhere !== diagrams) setHere(undefined)
  const drawn = here?.drawn ?? diagrams
  const schematic =
    !filterActive(filter) && Object.hasOwn(SCHEMATIC_FRAMES, group.name)
  const frame =
    filterActive(filter) || (schematic && !drawn)
      ? undefined
      : FRAMES.find(f => f.group === group.name)

  // The card's own chips. Hidden under a live filter for the same reason the
  // miniature is: a search is asking for rows, and a chip is not one.
  const chips = filterActive(filter) ? [] : cardPresetsFor(group.name)
  const matched = matchedSliders(group, filter, key => mod.modFor(key) !== null)
  const unframed =
    frame === undefined || showFramed
      ? matched
      : matched.filter(s => !frame.keys.has(s.key))
  // The trims a group hides so its look-makers stay in reach. A filter reaches
  // them for free: with a query up the tier collapses, so a search or a palette
  // jump lands on the row itself rather than on a toggle that hides it.
  // Both through sameList, because both are what ControlRows is memoized on:
  // the members change when the query or the fold does, and a fresh array in
  // between is the difference between React skipping every row in the group and
  // rebuilding it.
  const fine = sameList(
    filterActive(filter) ? [] : unframed.filter(s => s.fine === true),
  )
  const shown = sameList(
    filterActive(filter) ? unframed : unframed.filter(s => s.fine !== true),
  )
  // Every row actually on screen, which is what the gate scan below counts: a
  // banner is a summary of the notes it replaces, so a trim folded behind the
  // fine tier must not be one of the three that raises it.
  const onScreen = showFine ? [...shown, ...fine] : shown
  // The touched count can't cover motion: a routing never moves the resting
  // value, so a folded trim being driven by an LFO looks untouched from here.
  const fineMod = fine.some(s => mod.modFor(s.key) !== null)

  // When most of a group is dead behind the same gate (e.g. all of the mixer loop
  // behind loop mix), one banner beats a stack of identical per-row notes; the
  // notes stay only for the odd ones out.
  //
  // How many rows a gate shuts depends on which rows are showing, so it is
  // counted here; the controls come in only through `shut` above.
  const needs = needsOf(group)
  const banners = gatesBehind(
    onScreen,
    need => shut[needs.indexOf(need)] === 'x',
  ).filter(g => g.n >= 3)
  // Through sameKeySet, not `new Set(...)`: this is a prop on every row in the
  // group, and a fresh Set on each write would be enough on its own to re-render
  // all of them.
  const muted = sameKeySet(banners.map(e => e.need.key))

  const body = (
    <>
      {chips.length === 0 ? null : <CardChips group={group} chips={chips} />}
      {schematic ? (
        <button
          className={styles.diagramToggle}
          aria-expanded={drawn}
          onClick={() => setHere({ everywhere: diagrams, drawn: !drawn })}
        >
          {`${drawn ? '▾' : '▸'} diagram`}
        </button>
      ) : null}
      {frame === undefined ? null : (
        <>
          <BoxScope value={group.name}>
            <frame.Frame />
          </BoxScope>
          <button
            className={styles.sliderToggle}
            aria-expanded={showFramed}
            onClick={() => setShowFramed(!showFramed)}
          >
            {`${showFramed ? '▾' : '▸'} ${frame.keys.size} ${frame.keys.size === 1 ? 'slider' : 'sliders'}`}
          </button>
        </>
      )}
      {banners.map(({ need, n }) => (
        <button
          key={need.key}
          className={styles.groupNeeds}
          title={`click to set "${sliderFor(need.key).label}" to ${need.fix}${unitSuffix(sliderFor(need.key).unit)}`}
          onClick={() => writeControl(need.key, need.fix)}
        >
          {n} controls here are inert — needs {need.hint} · click to set
        </button>
      ))}
      {/* Sized off the whole group rather than off what is currently on screen,
        so unfolding the fine tier doesn't re-align the rows above it — the
        reserve is the same whichever rows are showing. */}
      <Rack sliders={group.sliders}>
        <ControlRows sliders={shown} muted={muted} />
        {group.name === TAP_HOST_GROUP ? <SignalTapControl /> : null}
        {group.name === CAPTION_HOST_GROUP ? <CaptionControl /> : null}
        <LoopTrip group={group.name} />
        {fine.length === 0 ? null : (
          <>
            <FineToggle
              fine={fine}
              open={showFine}
              mod={fineMod}
              onToggle={() => setShowFine(!showFine)}
            />
            {showFine ? <ControlRows sliders={fine} muted={muted} /> : null}
          </>
        )}
      </Rack>
    </>
  )
  // The header's verbs. Built apart from the rows above, so a write that
  // changes the count rebuilds this and leaves the rows' element as it was.
  // Built after them, too: `body` maps over `banners`, and the compiler keeps a
  // value open until its last call, so anything built in between would share
  // its memo block.
  const help = (
    <>
      {/* Only on a group that has something to put back — the same rule the
          row's own ↺ follows, and the reason neither costs anything on the
          majority of headers that are still at stock. It sits before the
          other two because the three read as "back / further / further, on
          its own" in that order. */}
      {touched > 0 ? (
        <button
          className={styles.revert}
          title={`put this stage's controls back to stock, and leave the rest of the look alone (ctrl+z takes it back)`}
          aria-label={`reset ${group.name} to defaults`}
          onClick={() => resetGroup(group.sliders)}
        >
          reset defaults
        </button>
      ) : null}
      {/* One nudge on press; a hold turns into a train of them only after
          ROLL_HOLD_MS, so a click is a single roll you can look at and the
          train runs slowly enough to let go on the look you wanted. It
          stops the instant the button is not down — a pointer that slips
          off it (or a window that loses focus mid-hold) has to stop it
          exactly as a release would, which is why both onPointerLeave and
          onBlur clear it alongside onPointerUp.

          The roll is on the pointer rather than on the click because the
          hold has to start with it, and the click is then only for the
          press that sends no pointer event at all: `detail` is 0 on a
          keyboard activation and never on a mouse one, which is what keeps
          the button reachable from the keyboard without rolling twice for
          every press of it. */}
      <button
        className={styles.dice}
        title={`nudge only this stage's controls randomly around where they sit, and keep nudging while you hold it down — shift for a wilder roll, alt for a gentler one, ctrl (or cmd) for turbo (${group.name})`}
        aria-label={`nudge ${group.name} randomly — press for one, hold to keep going`}
        onPointerDown={e => {
          const amount = mutateAmountFor(e)
          stopRoll()
          mutateGroup(group.sliders, amount)
          rollDelay.current = setTimeout(() => {
            rollTrain.current = setInterval(
              () => mutateGroup(group.sliders, amount),
              ROLL_TRAIN_MS,
            )
          }, ROLL_HOLD_MS)
        }}
        onPointerUp={stopRoll}
        onPointerLeave={stopRoll}
        onBlur={stopRoll}
        onClick={e => {
          if (e.detail === 0) mutateGroup(group.sliders, mutateAmountFor(e))
        }}
      >
        randomize
      </button>
      {/* The same nudge with nobody pressing it, aimed at this stage alone
          (ui/drift.ts). Lit rather than reworded while it runs: the look
          bar's switch has a row to itself and can afford "drifting…", where
          a heading has one line to share with a stage name that can be 33
          characters long.

          Absent from a stage the drift may not touch — the view group is
          nothing but the magnifier, which no roll and no drift moves. */}
      {driftable ? (
        <button
          className={cx(styles.drift, drifting && styles.driftOn)}
          aria-pressed={drifting}
          title={
            drifting
              ? `stop here and keep ${group.name} wherever it has got to (the rest of the board carries on)`
              : `let this stage ${driftWords.does}: a leg every ${DRIFT_SECONDS} seconds, travelling most of the way there so nothing cuts. The rest of the board holds still (${group.name}). The look bar's ▾ is where the three shapes are picked`
          }
          onClick={() => toggleGroupDrift(group)}
        >
          {driftWords.label}
        </button>
      ) : null}
    </>
  )

  // A group the query left with nothing — no rows, no folded trims to offer,
  // and no miniature — is a header over an empty body, so it drops out entirely.
  return shown.length === 0 &&
    fine.length === 0 &&
    frame === undefined ? null : (
    <Section
      title={group.name}
      label={HEADING[group.name]}
      defaultOpen={props.defaultOpen}
      openOnFilter
      dot={touched}
      // A folded door keeps its accessories out of the way, and a stage left
      // wandering has to say so from the outside: the count beside it cannot,
      // since a hand on a slider moves it the same way drift does.
      mark={
        drifting ? (
          <span className={styles.driftMark}>drifting</span>
        ) : undefined
      }
      help={help}
    >
      {body}
    </Section>
  )
}

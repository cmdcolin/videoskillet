import { PASS_THROUGH, UNIPOLAR } from '../core/signal/modstate'
import { sliderFor } from './controls'
import { useControlValue } from './ControlsContext'
import { cx } from './cx'
import { SYNC_DIVISIONS } from './midi'
import styles from './ModRowEditor.module.css'
import {
  bayDef,
  bayKeyFor,
  isBayKey,
  targetLabel,
  MOD_SOURCES,
  RATE_MAX,
  RATE_MIN,
  modPatch,
  slotRate,
} from './modSlots'
import { useModSlotsApi } from './ModSlotsContext'
import { CLAIM_RATE_HZ, depthBudget } from './rollMod'
import { SelectRow } from './SelectRow'
import { Slider } from './Slider'
import ui from './ui.module.css'

import type { BayField, ControlKey, ModTarget } from '../core/controls'
import type { UiSlot } from './modSlots'

// Whether the wobble is running into the end of the control's own range.
//
// The engine adds the wave to the resting value and clamps, so a bipolar LFO
// around a slider already parked at one end spends half its cycle pinned
// against it. That reads as "the wobble is broken" unless something says
// otherwise; the fix is to move the slider, so the note says which way.
//
// Which end can pin depends on which way the wave goes. A one-shot struck at
// the bottom of a range is not clipped at all — it only ever pushes up, so the
// bottom is exactly where it has the most room, and the note used to tell the
// one source you play to move away from the only rest that gives it a full
// stroke. See modstate's UNIPOLAR.
//
// Its own component because it is the one thing in this editor that reads the
// board: a bay knob has no resting value in the control store, and a hook must
// not be the thing that decides whether the subject is a control at all.
function ClippedNote(props: {
  controlKey: ControlKey
  swing: number
  bipolar: boolean
}) {
  const rest = useControlValue(props.controlKey)
  const def = sliderFor(props.controlKey)
  const clipped =
    props.bipolar && rest - props.swing < def.min
      ? 'bottom'
      : rest + props.swing > def.max
        ? 'top'
        : null
  return clipped === null ? null : (
    <div className={ui.hint}>
      “{def.label}” is resting at the {clipped} of its range, so the swing only
      goes one way — move the slider toward the middle for a full wobble.
    </div>
  )
}

// What a wire onto another wire patches in when it is first claimed. It shares
// the drift rate a control row claims (rollMod › CLAIM_RATE_HZ) and neither of
// the other two fields, because this one is not moving the picture — it is
// deciding how much the routing under it moves. So it wants an aimless walk
// rather than a legible cycle, and half the knob's travel rather than a
// fraction sized to a control's span: at 0.08 Hz a walk takes about twelve
// seconds to change its mind, which is the rate at which a fault reads as
// coming and going rather than as stuttering.
const DRIVER_ROUTING = {
  source: 'walk' as const,
  rateHz: CLAIM_RATE_HZ,
  depth: 0.5,
}

// The depth a knob's ↺ puts back, which depends on what the slot drives: the
// control's own budget, or the driver depth a wire onto a wire is claimed at.
const knobStock = (target: UiSlot['target']) =>
  target === '' || isBayKey(target)
    ? DRIVER_ROUTING.depth
    : depthBudget(sliderFor(target))

// One of a routing's own two knobs, wired so a second routing can be clipped
// onto it (modSlots.ts › BAY_TARGETS).
//
// The same row a control gets, with the same `+ mod` button and the same
// editor — which is the whole argument for the bay's knobs living in the
// control key space. A wire onto a wire is not a second kind of patch to
// learn: it is claimed where it lands, exactly like every other one, and the
// routing that results appears as its own numbered slot in the bay.
function KnobRow(props: { i: number; slot: UiSlot; field: BayField }) {
  const mod = useModSlotsApi()
  const key = bayKeyFor(props.i, props.field)
  const driver = mod.modFor(key)
  const open = mod.editing.has(key)
  const s = props.slot
  const rate = props.field === 'rate'
  return (
    <Slider
      label={rate ? 'rate' : 'depth (of slider range)'}
      unit={rate ? 'Hz' : ''}
      min={rate ? RATE_MIN : 0}
      max={rate ? RATE_MAX : 1}
      step={rate ? 0.02 : 0.01}
      // Tempo's business while ♩ is set; the dialed Hz stays put underneath and
      // comes back when the lock cycles off.
      value={rate ? slotRate(s, mod.bpm) : s.depth}
      // Stock for one of these knobs is what the app itself would patch onto
      // this slot's target, so the ↺ puts back the routing the `+ mod` press
      // claimed. It used to be the bay's resting 0.5Hz/0.2 pair, which stopped
      // being anything anybody had chosen the moment the press started reading
      // rollMod: every claimed row wore an "off stock" badge offering to put
      // the flat depth back — 44x too deep on the vertical roll rate.
      defaultValue={rate ? CLAIM_RATE_HZ : knobStock(s.target)}
      help={
        rate
          ? 'How fast this wobble cycles, in Hz. Slow rates drift the control the way a warming-up circuit does. Fast ones buzz it every frame. The ♩ button below locks it to the tempo instead. Press + mod on this row and a second routing modulates the rate itself, so the oscillator speeds up and slows down instead of keeping time.'
          : 'How far the wobble swings the control, as a fraction of its own slider range. The slider itself stays put. It is the centre the motion happens around, which is why a preset or a link still holds the look. The marker under the control’s own track shows this number. Press + mod on this row and a second routing brings the wobble in and out on its own. Leave this at 0 and it comes in from nothing, which is the difference between a fault that runs continuously and one that keeps happening.'
      }
      sync={
        rate
          ? {
              label:
                s.syncDiv === undefined
                  ? null
                  : SYNC_DIVISIONS[s.syncDiv].label,
              live: mod.bpm !== null,
              onCycle: () => mod.cycleSlotSync(props.i),
            }
          : undefined
      }
      mod={{
        patch: driver === null ? null : modPatch(driver, mod.bpm, mod.master),
        on: driver?.on === true,
        open,
        onToggleOn: () => {
          if (driver !== null) mod.setSlotOn(key, !driver.on)
        },
        onOpenChange: next => {
          if (next && driver === null) mod.setSlotForKey(key, DRIVER_ROUTING)
          mod.setEditing(key, next)
        },
        onRemove: () => mod.setSlotForKey(key, null),
      }}
      modEditor={open ? <ModRowEditor controlKey={key} /> : undefined}
      onChange={v => mod.setSlot(props.i, rate ? { rateHz: v } : { depth: v })}
    />
  )
}

// One routing, edited where it is read: under the control row it drives, and
// under its slot head in the bay. The same rows in both places, so learning
// one is learning the other — the bay used to draw its own set, and a reader
// who found one had no way to know the other existed.
//
// An inline expansion rather than a popover: it has no positioning to get
// wrong, it works in the popout's own document, and it fits the ~300px column
// the wide bench gives a panel.
export function ModRowEditor(props: {
  // A control's key, or one of the bay's own knobs — a wire clipped onto
  // another wire (modSlots.ts › BAY_TARGETS). The editor is the same either
  // way, which is the point of the bay knobs being in the same key space.
  controlKey: ModTarget
}) {
  const mod = useModSlotsApi()
  const key = props.controlKey
  const i = mod.slots.findIndex(s => s.target === key)
  const def = isBayKey(key) ? bayDef(key) : sliderFor(key)

  if (i === -1) {
    // Nothing drives this control and the bay has room, so the claim was never
    // made or has since been handed back — e.g. the bay switched this slot off
    // from the other side. There is nothing to say and nothing to edit; the
    // busy note below would be a flat lie about a bay with free slots.
    if (mod.slots.some(s => s.target === '')) {
      return null
    }
    // Every slot busy, and none of them this control's. Naming the holders
    // beats an auto-evict: the bay is small enough that quietly unpatching
    // someone else's routing to make room would be the surprise, not the fix.
    return (
      <div className={styles.editor}>
        <div className={ui.hint}>
          all {mod.slots.length} modulation slots are busy — remove one in the
          MODULATION box on the map, or from{' '}
          {mod.slots
            .flatMap(s => (s.target === '' ? [] : [targetLabel(s.target)]))
            .join(', ')}
          .
        </div>
      </div>
    )
  }

  const slot = mod.slots[i]
  const swing = slot.depth * (def.max - def.min)
  const timed = !PASS_THROUGH.has(slot.source)

  return (
    <div className={styles.editor}>
      <SelectRow
        tag="∿"
        title="modulation source"
        value={slot.source}
        options={MOD_SOURCES}
        onChange={source => mod.setSlot(i, { source })}
      />
      {timed ? <KnobRow i={i} slot={slot} field="rate" /> : null}
      {/* The only control in the bay you play rather than set. It has to be
          next to the rate, because the rate is this envelope's decay and the
          two are read together — press, watch it fall, adjust, press again.

          Gone while the slot is parked, because ❚❚ means it: a parked
          routing is not on the engine's list, so the strike would land on
          nothing. */}
      {slot.source === 'trig' && slot.on ? (
        <button
          className={ui.btn}
          title={`strike slot ${i + 1}'s envelope — or press t to strike every one`}
          onClick={() => mod.fire(i)}
        >
          ⚡ fire
        </button>
      ) : null}
      <KnobRow i={i} slot={slot} field="depth" />
      {isBayKey(key) || !timed || swing === 0 ? null : (
        <ClippedNote
          controlKey={key}
          swing={swing}
          bipolar={!UNIPOLAR.has(slot.source)}
        />
      )}
      {/* Where the beat is coming from, said once, at the only place a lock can
          be thrown from without the tempo being on screen: the tempo lives at
          the top of the MODULATION box, a stage away from most of these rows. */}
      {slot.syncDiv === undefined ? null : (
        <div className={ui.hint}>
          ♩{SYNC_DIVISIONS[slot.syncDiv].label} of{' '}
          {mod.bpm === null
            ? 'a tempo not set yet'
            : `${mod.bpm.toFixed(1)} BPM`}{' '}
          — the tempo is at the top of the MODULATION box on the map.
        </div>
      )}
      {/* The routing's verbs, on one line and all of them words: hold it still
          and it comes back exactly as it is set here, lock its rate to the beat,
          remove it and the slot goes back to the bay. Hold is the same switch as
          the ❚❚ on the row above — here as well, because a reader who opened the
          editor to stop the wobble should find the stop where they looked. */}
      <div className={styles.actions}>
        <button
          className={styles.action}
          title={
            slot.on
              ? `hold ${def.label} still, keeping this patch`
              : `start ${def.label} wobbling again`
          }
          onClick={() => mod.setSlotOn(key, !slot.on)}
        >
          {slot.on ? '❚❚ hold still' : '▶ start again'}
        </button>
        {!timed ? null : (
          <button
            className={cx(
              styles.action,
              slot.syncDiv !== undefined && styles.actionOn,
            )}
            title={
              slot.syncDiv === undefined
                ? 'lock the rate to the tempo — each press steps through 1/1, 1/2, 1/4, 1/8, 1/16 and back to free-running'
                : `locked to ♩${SYNC_DIVISIONS[slot.syncDiv].label} — press for the next division, or on past 1/16 to run free again`
            }
            onClick={() => mod.cycleSlotSync(i)}
          >
            {slot.syncDiv === undefined
              ? '♩ lock to beat'
              : `♩ ${SYNC_DIVISIONS[slot.syncDiv].label} of the beat`}
          </button>
        )}
        <button
          className={cx(styles.action, styles.remove)}
          title={`stop modulating ${def.label} and hand the slot back`}
          onClick={() => mod.setSlotForKey(key, null)}
        >
          × remove
        </button>
      </div>
    </div>
  )
}

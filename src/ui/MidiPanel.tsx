import { useEffect, useState } from 'react'

import { ALL_SLIDERS } from './controls'
import { cx } from './cx'
import {
  ACTIONS,
  AUTOMAP_TARGETS,
  DEVICE_PROFILES,
  MOTION,
  actionLabel,
  controlOf,
  parseAction,
  presetTarget,
  targetLabel,
} from './midi'
import styles from './MidiPanel.module.css'
import { PRESETS, presetLabel } from './presets'
import ui from './ui.module.css'

import type { ActionTarget, BindTarget, MidiStatus } from './midi'
import type { useMidi } from './useMidi'
import type { ReactNode } from 'react'

type Midi = ReturnType<typeof useMidi>

// "clean" is the reset, an empty patch that blendPresets never mixes in, so a
// knob on its weight would do nothing.
const MIXABLE = PRESETS.filter(p => Object.keys(p.patch).length > 0)

function Wired({ midi }: { midi: Midi }) {
  const { armed, armedNote, learn, bpm, bindings, notes, pickups } = midi
  const [deviceName, setDeviceName] = useState(DEVICE_PROFILES[0].name)
  const device =
    DEVICE_PROFILES.find(d => d.name === deviceName) ?? DEVICE_PROFILES[0]
  const [presetName, setPresetName] = useState(MIXABLE[0].name)
  const [action, setAction] = useState<ActionTarget>(ACTIONS[0].target)
  const presetArm = presetTarget(presetName)

  // A fixed order, so a row stays under the pointer as bindings come and go.
  const bound: BindTarget[] = [
    MOTION,
    ...MIXABLE.map(p => presetTarget(p.name)),
    ...ALL_SLIDERS.map(s => s.key),
  ].filter(t => bindings[t] !== undefined)
  const boundActions = ACTIONS.filter(a => notes[a.target] !== undefined)
  const stranded = Object.keys(pickups).length
  const isStranded = (t: BindTarget) => {
    const key = controlOf(t)
    return key !== null && pickups[key] !== undefined
  }

  const hint =
    learn !== null
      ? `turn a knob${learn.nextTarget === null ? '' : ` for ${targetLabel(learn.nextTarget)}`} — ${learn.done}/${learn.total} bound, esc to stop`
      : armedNote !== null
        ? `strike a pad or a key to take ${actionLabel(armedNote)} — esc to cancel`
        : armed !== null
          ? `move a knob to take ${targetLabel(armed)} — esc to cancel`
          : stranded > 0
            ? `${stranded} knob${stranded === 1 ? '' : 's'} out of step with the board — sweep each through its value to pick it up`
            : 'press ⚟ on any control, then move a knob to bind it'
  const waiting =
    learn !== null || armed !== null || armedNote !== null || stranded > 0

  return (
    <>
      <div className={waiting ? styles.waiting : styles.hint}>{hint}</div>

      {learn === null ? (
        <div className={styles.row}>
          <select
            className={styles.select}
            value={deviceName}
            onChange={e => setDeviceName(e.target.value)}
          >
            {DEVICE_PROFILES.map(d => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            className={styles.btn}
            title="Bind this device's knobs by CC number, in order: the motion amount first, then the controls in signal-path order. Replaces every knob binding you have."
            onClick={() => midi.autoMap(device)}
          >
            auto-map {Math.min(device.ccs.length, AUTOMAP_TARGETS.length)}
          </button>
          <button
            className={styles.btn}
            title="Works on any controller whatever its CC numbers: sweep each knob once, left to right, and each takes the next control. Replaces every knob binding you have."
            onClick={() => midi.learnSequence()}
          >
            learn in order
          </button>
        </div>
      ) : (
        <button className={styles.btn} onClick={() => midi.stopLearn()}>
          stop learning — keep the {learn.done} bound so far
        </button>
      )}

      <div className={styles.row}>
        <select
          className={styles.select}
          value={presetName}
          onChange={e => setPresetName(e.target.value)}
        >
          {MIXABLE.map(p => (
            <option key={p.name} value={p.name}>
              {presetLabel(p)}
            </option>
          ))}
        </select>
        <button
          className={armed === presetArm ? styles.btnOn : styles.btn}
          title="Put this preset's mix amount on a knob. One knob then moves everything the preset touches."
          onClick={() => midi.toggleArm(presetArm)}
        >
          ⚟ preset mix
        </button>
      </div>

      <div className={styles.row}>
        <select
          className={styles.select}
          value={action}
          onChange={e =>
            setAction(parseAction(e.target.value) ?? ACTIONS[0].target)
          }
        >
          {ACTIONS.map(a => (
            <option key={a.target} value={a.target}>
              {a.label}
            </option>
          ))}
        </select>
        <button
          className={armedNote === action ? styles.btnOn : styles.btn}
          title="Put this gesture on a pad or a key."
          onClick={() => midi.toggleArmNote(action)}
        >
          ⚟ pad
        </button>
      </div>
      <div className={styles.hint}>
        {boundActions.length === 0
          ? 'with no pad bound, any note fires the whole bay. Bind one and only the pads listed below fire.'
          : 'notes fire only the pads listed below.'}
      </div>

      <div className={styles.row}>
        <span className={bpm === null ? styles.quiet : styles.clock}>
          {bpm === null ? '♩ no clock' : `♩ ${bpm.toFixed(1)}`}
        </span>
        <span className={styles.hint}>
          ♩ in a rate control’s ⋮ locks it to the beat
        </span>
      </div>

      {bound.length === 0 && boundActions.length === 0 ? null : (
        <>
          <div className={styles.list}>
            {bound.map(t => {
              const b = bindings[t]
              return b === undefined ? null : (
                <div key={t} className={styles.bound}>
                  <span
                    className={
                      isStranded(t) ? styles.strandedName : styles.boundName
                    }
                  >
                    {targetLabel(t)}
                  </span>
                  <span className={styles.cc}>
                    CC{b.controller}
                    {b.channel === 0 ? '' : ` ch${b.channel + 1}`}
                  </span>
                  <button
                    className={styles.drop}
                    title={`take ${targetLabel(t)} off its knob`}
                    aria-label={`unbind ${targetLabel(t)}`}
                    onClick={() => midi.clearBinding(t)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
            {boundActions.map(a => {
              const b = notes[a.target]
              return b === undefined ? null : (
                <div key={a.target} className={styles.bound}>
                  <span className={styles.boundName}>{a.label}</span>
                  <span className={styles.cc}>
                    note {b.note}
                    {b.channel === 0 ? '' : ` ch${b.channel + 1}`}
                  </span>
                  <button
                    className={styles.drop}
                    title={`take ${a.label} off its pad`}
                    aria-label={`unbind ${a.label}`}
                    onClick={() => midi.clearNote(a.target)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
          <button className={styles.danger} onClick={() => midi.clearAll()}>
            clear all {bound.length + boundActions.length} bindings
          </button>
        </>
      )}
    </>
  )
}

// The masthead button for the wire. The status stays on the button while the
// card is shut, because a stranded knob does nothing until swept and nothing
// else on screen says so.
export function MidiPanel(props: {
  midi: Midi
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const { midi } = props
  const stranded = Object.keys(midi.pickups).length
  const note = midiTabNote(midi.status, stranded)

  return (
    <>
      <button
        className={cx(
          ui.outline,
          stranded > 0
            ? styles.tabWaiting
            : midi.status === 'ready' && styles.tabOn,
        )}
        title={
          midi.status === 'ready'
            ? stranded > 0
              ? `${stranded} bound knob${stranded === 1 ? ' is' : 's are'} out of step with the board and doing nothing until you sweep each through its value`
              : 'the knobs and pads you have bound, and the clock on the wire'
            : 'play the board from a MIDI controller: bind any control to a knob, and gestures to pads'
        }
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        midi
        {note === null ? null : <span className={styles.tabNote}>{note}</span>}
      </button>
      {props.open && (
        <MidiDialog
          status={midi.status}
          onEnable={midi.enable}
          onClose={props.onClose}
        >
          <Wired midi={midi} />
        </MidiDialog>
      )}
    </>
  )
}

// CROSS_REPO_SYNC(midi-dialog)
function midiTabNote(status: MidiStatus, stranded: number): string | null {
  if (status === 'ready') return stranded > 0 ? `${stranded} waiting` : null
  if (status === 'unsupported') return 'n/a'
  if (status === 'denied') return 'refused'
  if (status === 'requesting') return 'asking…'
  return null
}

// Non-modal: every control binds from its own ⚟, in the panel behind this card,
// so the panel has to stay reachable with the card up. A shown dialog gets no
// `cancel` event, so Escape is bound by hand.
function MidiDialog(props: {
  status: MidiStatus
  onEnable: () => void
  onClose: () => void
  children: ReactNode
}) {
  const { onClose } = props

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <dialog
      ref={el => {
        if (el && !el.open) el.show()
      }}
      aria-label="midi"
      className={styles.card}
    >
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>midi</span>
        <button
          className={styles.close}
          onClick={onClose}
          aria-label="close midi"
        >
          ×
        </button>
      </div>
      {props.status === 'ready' ? (
        props.children
      ) : props.status === 'unsupported' ? (
        <div className={styles.hint}>
          this browser has no Web MIDI — try Chrome or Edge.
        </div>
      ) : (
        <div className={styles.row}>
          {/* Focus lands on the button that does the work, not on the close
              that comes first in the markup. */}
          <button className={styles.btn} autoFocus onClick={props.onEnable}>
            connect a controller
          </button>
          <span className={styles.hint}>
            {props.status === 'denied'
              ? 'the browser refused — allow MIDI for this site and try again'
              : 'the browser will ask once, then remember'}
          </span>
        </div>
      )}
    </dialog>
  )
}
// CROSS_REPO_SYNC_END(midi-dialog)

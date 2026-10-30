import { useState } from 'react'

import { SLIDER_BY_KEY, loopGroups } from '../ui/controls'
import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { CloseIcon } from './icons'
import { KEYER_KNOBS } from './keyed'
import { Knob } from './Tune'

import type { ControlKey, Controls } from '../core/controls'
import type { LoopPlace, SliderDef } from '../ui/controls'

// The knobs that do most of each loop's work, in the order a hand reaches for
// them: how much returns, how hard, and where each lap lands.
const MAIN: Record<LoopPlace, ControlKey[]> = {
  camera: ['fbMix', 'fbGain', 'fbZoom', 'fbRotateDeg', 'fbShiftX', 'fbShiftY'],
  mixer: [
    'cfbMix',
    'cfbGain',
    'cfbDelayUs',
    'cfbLines',
    'cfbTrail',
    'cfbServoUs',
  ],
}

const LOOPS: { place: LoopPlace; name: string; about: string }[] = [
  {
    place: 'camera',
    name: 'camera loop',
    about: 'a camera pointed at the screen, fed back into the input',
  },
  {
    place: 'mixer',
    name: 'mixer loop',
    about: 'the mixer’s output patched back into its own input',
  },
]

const sliders = (place: LoopPlace, more: boolean) => {
  const all = loopGroups(place).flatMap(g => g.sliders)
  const main = MAIN[place].flatMap(k => all.filter(s => s.key === k))
  return more ? [...main, ...all.filter(s => !main.includes(s))] : main
}

const keyerSliders = (more: boolean): SliderDef[] =>
  [...KEYER_KNOBS.main, ...(more ? KEYER_KNOBS.more : [])].flatMap(
    k => SLIDER_BY_KEY.get(k) ?? [],
  )

export interface KeyerSwitch {
  on: boolean
  disabled: boolean
  onSwitch: (on: boolean) => void
}

// Every feedback knob on the set, whatever look is up: the two loops' main
// knobs, and the rest of them behind `more`. A knob moved here lands on top of
// the look, the same as one moved in the tune sheet. Below them, the chroma
// keyer switches the camera onto B and fills what it cuts from the frame store.
export function Loops(props: {
  controls: Controls
  keyer: KeyerSwitch
  tweaked: boolean
  onKnob: (key: ControlKey, value: number) => void
  onReset: () => void
  onClose: () => void
}) {
  const [more, setMore] = useState(false)
  return (
    <section className={styles.sheet} aria-label="Feedback loops">
      <header className={styles.sheetHead}>
        <span className={styles.sheetTitle}>feedback</span>
        <button
          className={styles.sheetButton}
          aria-pressed={more}
          onClick={() => setMore(!more)}
        >
          {more ? 'fewer' : 'more'}
        </button>
        <button
          className={styles.sheetButton}
          disabled={!props.tweaked}
          onClick={() => props.onReset()}
        >
          reset
        </button>
        <button
          className={styles.sheetClose}
          aria-label="close"
          onClick={() => props.onClose()}
        >
          <CloseIcon />
        </button>
      </header>
      <div className={styles.knobs}>
        {LOOPS.map(loop => (
          <div key={loop.place} className={styles.loop}>
            <h3 className={styles.loopName}>
              {loop.name}
              <small>{loop.about}</small>
            </h3>
            {sliders(loop.place, more).map(def => (
              <Knob
                key={def.key}
                def={def}
                value={props.controls[def.key]}
                onChange={v => props.onKnob(def.key, v)}
              />
            ))}
          </div>
        ))}
        <div className={styles.loop}>
          <h3 className={styles.loopName}>
            colour key
            <small>
              the camera keyed on a colour, filled from the mixer’s frame store;
              tap the picture to pick the colour
            </small>
          </h3>
          <div className={styles.knob}>
            <span className={styles.knobName}>key</span>
            <span className={styles.choices}>
              {[false, true].map(on => (
                <button
                  key={String(on)}
                  className={cx(
                    styles.choice,
                    props.keyer.on === on && styles.choiceOn,
                  )}
                  aria-pressed={props.keyer.on === on}
                  disabled={props.keyer.disabled}
                  onClick={() => props.keyer.onSwitch(on)}
                >
                  {on ? 'on' : 'off'}
                </button>
              ))}
            </span>
          </div>
          {props.keyer.on
            ? keyerSliders(more).map(def => (
                <Knob
                  key={def.key}
                  def={def}
                  value={props.controls[def.key]}
                  onChange={v => props.onKnob(def.key, v)}
                />
              ))
            : null}
        </div>
      </div>
    </section>
  )
}

// The keys this sheet can move, for a reset that leaves the look's other
// knobs alone.
export const LOOP_KEYS: ReadonlySet<string> = new Set([
  ...LOOPS.flatMap(l => sliders(l.place, true).map(s => s.key)),
  ...keyerSliders(true).map(s => s.key),
])

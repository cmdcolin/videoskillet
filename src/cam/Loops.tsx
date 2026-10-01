import { useState } from 'react'

import { loopGroups } from '../ui/controls'
import styles from './cam.module.css'
import { CloseIcon } from './icons'
import { Knob } from './Tune'

import type { ControlKey, Controls } from '../core/controls'
import type { LoopPlace } from '../ui/controls'

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

// Every feedback knob on the set, whatever look is up: the two loops' main
// knobs, and the rest of them behind `more`. A knob moved here lands on top of
// the look, the same as one moved in the tune sheet.
export function Loops(props: {
  controls: Controls
  tweaked: boolean
  onKnob: (key: ControlKey, value: number) => void
  onReset: () => void
  onClose: () => void
}) {
  const [more, setMore] = useState(false)
  return (
    <section className={styles.sheet} aria-label="Feedback loops">
      <header className={styles.sheetHead}>
        <span className={styles.sheetTitle}>loops</span>
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
          onClick={props.onReset}
        >
          reset
        </button>
        <button
          className={styles.sheetClose}
          aria-label="close"
          onClick={props.onClose}
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
      </div>
    </section>
  )
}

// The keys this sheet can move, for a reset that leaves the look's other
// knobs alone.
export const LOOP_KEYS: ReadonlySet<string> = new Set(
  LOOPS.flatMap(l => sliders(l.place, true).map(s => s.key)),
)

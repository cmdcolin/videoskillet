import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { CloseIcon } from './icons'
import { DRAW_FROM, ROLLS, ROLL_ABOUT, ROLL_LABEL, WILDNESS } from './roll'

import type { Roll, RollSettings } from './roll'

function Choice<T extends string>(props: {
  name: string
  options: readonly T[]
  value: T
  onPick: (v: T) => void
}) {
  return (
    <div className={styles.knob}>
      <span className={styles.knobName}>{props.name}</span>
      <span
        className={styles.choices}
        role="radiogroup"
        aria-label={props.name}
      >
        {props.options.map(o => (
          <button
            key={o}
            role="radio"
            aria-checked={o === props.value}
            className={cx(styles.choice, o === props.value && styles.choiceOn)}
            onClick={() => props.onPick(o)}
          >
            {o}
          </button>
        ))}
      </span>
    </div>
  )
}

// Four ways to roll, each a button that rolls on the press and leaves the sheet
// up for the next one, and the two settings the rolls read.
export function RandomSheet(props: {
  settings: RollSettings
  onChange: (settings: RollSettings) => void
  onRoll: (roll: Roll) => void
  onClose: () => void
}) {
  const { settings } = props
  return (
    <section className={styles.sheet} aria-label="Random">
      <header className={styles.sheetHead}>
        <span className={styles.sheetTitle}>random</span>
        <button
          className={styles.sheetClose}
          aria-label="close"
          onClick={props.onClose}
        >
          <CloseIcon />
        </button>
      </header>
      <div className={styles.knobs}>
        <div className={styles.rolls}>
          {ROLLS.map(r => (
            <button
              key={r}
              className={styles.rollButton}
              title={ROLL_ABOUT[r]}
              onClick={() => props.onRoll(r)}
            >
              {ROLL_LABEL[r]}
            </button>
          ))}
        </div>
        <Choice
          name="wildness"
          options={WILDNESS}
          value={settings.wildness}
          onPick={wildness => props.onChange({ ...settings, wildness })}
        />
        <Choice
          name="draw from"
          options={DRAW_FROM}
          value={settings.from}
          onPick={from => props.onChange({ ...settings, from })}
        />
        <p className={styles.mixNote}>
          Wildness sets how many looks a stack adds and how far nudge and throw
          move the knobs. Draw from sets where new look, stack and the random
          chip pick their looks.
        </p>
      </div>
    </section>
  )
}

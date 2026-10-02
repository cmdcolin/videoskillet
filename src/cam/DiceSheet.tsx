import { cx } from '../ui/cx'
import styles from './cam.module.css'
import {
  DICE_AMOUNTS,
  DICE_KINDS,
  DICE_REACHES,
  diceAbout,
  usesAmount,
  usesReach,
} from './dice'
import { CloseIcon } from './icons'

import type { Dice } from './dice'

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

// What the random chip does when it is tapped: which kind of roll, how far it
// reaches for looks, and how hard it moves the knobs. The roll button here
// rolls with those settings, since the sheet covers the strip's own chip.
export function DiceSheet(props: {
  dice: Dice
  onChange: (dice: Dice) => void
  onRoll: () => void
  onClose: () => void
}) {
  const { dice } = props
  return (
    <section className={styles.sheet} aria-label="Random settings">
      <header className={styles.sheetHead}>
        <span className={styles.sheetTitle}>random</span>
        <button className={styles.sheetButton} onClick={props.onRoll}>
          roll
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
        <Choice
          name="roll"
          options={DICE_KINDS}
          value={dice.kind}
          onPick={kind => props.onChange({ ...dice, kind })}
        />
        {usesReach(dice.kind) ? (
          <Choice
            name="looks from"
            options={DICE_REACHES}
            value={dice.reach}
            onPick={reach => props.onChange({ ...dice, reach })}
          />
        ) : null}
        {usesAmount(dice.kind) ? (
          <Choice
            name="amount"
            options={DICE_AMOUNTS}
            value={dice.amount}
            onPick={amount => props.onChange({ ...dice, amount })}
          />
        ) : null}
        <p className={styles.mixNote}>{diceAbout(dice)}</p>
      </div>
    </section>
  )
}

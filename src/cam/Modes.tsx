import { cx } from '../ui/cx'
import styles from './cam.module.css'

export type Mode = 'photo' | 'video'

export function Modes(props: {
  mode: Mode
  disabled: boolean
  onMode: (mode: Mode) => void
}) {
  return (
    <div className={styles.modes} role="radiogroup" aria-label="Shutter">
      {(['photo', 'video'] as const).map(m => (
        <button
          key={m}
          role="radio"
          aria-checked={props.mode === m}
          className={cx(styles.mode, props.mode === m && styles.modeOn)}
          disabled={props.disabled}
          onClick={() => props.onMode(m)}
        >
          {m}
        </button>
      ))}
    </div>
  )
}

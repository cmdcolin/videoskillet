import { cx } from '../ui/cx'
import styles from './cam.module.css'

import type { ReactNode } from 'react'

// A round switch on the picture with its name under it.
export function Switch(props: {
  on: boolean
  label: string
  title: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      className={styles.switch}
      aria-pressed={props.on}
      title={props.title}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <span className={cx(styles.switchDot, props.on && styles.on)}>
        {props.children}
      </span>
      <span className={styles.switchLabel}>{props.label}</span>
    </button>
  )
}

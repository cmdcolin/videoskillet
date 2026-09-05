import { cx } from './cx'
import styles from './PanelSheet.module.css'
import ui from './ui.module.css'

import type { ReactNode } from 'react'

// A surface that takes the sidebar over for as long as it is up: a title row, an
// optional verb or two beside it, close, and the panel's whole height below.
//
// The palette and the board dump are the two of these. Both were floating cards
// in the top layer, and both landed on the picture — which is the surface the
// app exists to watch, and the one the palette's own ←→ nudge is aimed at. The
// sidebar is where the controls already are, so a sheet goes there and the
// picture is never covered.
export function PanelSheet(props: {
  title: string
  // Named for the accessibility tree, which is how a screen reader and a
  // browsing agent both find this. The title is the heading a person reads.
  label: string
  actions?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  return (
    <section className={styles.sheet} aria-label={props.label}>
      <div className={styles.head}>
        <h2 className={styles.title}>{props.title}</h2>
        {props.actions}
        <button
          className={cx(ui.btn, ui.btnFlush)}
          title="close (esc)"
          onClick={props.onClose}
        >
          close
        </button>
      </div>
      {props.children}
    </section>
  )
}

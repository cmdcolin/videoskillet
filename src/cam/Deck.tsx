import { TRANSITIONS } from '../ui/transitions'
import styles from './cam.module.css'

import type { Transition } from '../ui/transitions'

// The fault pads: each breaks the picture and lets it heal.
export function Deck(props: { onHit: (t: Transition) => void }) {
  return (
    <div className={styles.hits} aria-label="Faults">
      {TRANSITIONS.map(t => (
        <button
          key={t.name}
          className={styles.hit}
          title={t.title}
          onClick={() => props.onHit(t)}
        >
          <span className={styles.hitGlyph} aria-hidden>
            {t.glyph}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  )
}

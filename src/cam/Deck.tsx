import { TRANSITIONS } from '../ui/transitions'
import { usePadHold } from '../ui/usePadHold'
import styles from './cam.module.css'

import type { Transition } from '../ui/transitions'

// The fault pads: each breaks the picture and lets it heal, and holds it broken
// while a finger stays on it.
export function Deck(props: {
  onHit: (t: Transition, held: boolean) => (() => void) | undefined
}) {
  const pad = usePadHold()
  return (
    <div className={styles.hits} aria-label="Faults">
      {TRANSITIONS.map(t => (
        <button
          key={t.name}
          className={styles.hit}
          title={`${t.title}, or for as long as you hold it`}
          {...pad(held => props.onHit(t, held))}
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

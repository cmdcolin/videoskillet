import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { ShuffleIcon } from './icons'
import { LookChip } from './LookChip'
import { lookLabel } from './looks'

import type { Layers, Look, Shelf } from './looks'

// The tabs for each part of the signal path and the strip of looks under them.
export function LookStrip(props: {
  shelves: readonly Shelf[]
  shelf: Shelf
  look: Look | null
  layers: Layers
  tweaked: boolean
  onShelf: (name: string) => void
  onRoll: () => void
  onNormal: () => void
  onPick: (name: string) => void
  onWeigh: (name: string, weight: number) => void
}) {
  const { look, shelf } = props
  const strength = look === null ? 0 : Math.round(look.strength * 100)
  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Kinds of look">
        {props.shelves.map(s => (
          <button
            key={s.name}
            role="tab"
            aria-selected={s === shelf}
            className={cx(styles.tab, s === shelf && styles.tabOn)}
            onClick={() => props.onShelf(s.name)}
          >
            {s.name}
          </button>
        ))}
      </div>

      <nav className={styles.strip} aria-label="Looks">
        <button
          className={cx(styles.chip, look?.rolled === true && styles.chipOn)}
          title="scramble the picture"
          onClick={props.onRoll}
        >
          <ShuffleIcon />
          random
        </button>
        <button
          className={cx(styles.chip, look === null && styles.chipOn)}
          data-look="normal"
          onClick={props.onNormal}
        >
          normal
        </button>
        {shelf.looks.map(name => {
          const up = look !== null && !look.rolled && look.name === name
          return (
            <LookChip
              key={name}
              name={name}
              label={lookLabel({ name, strength: 1, rolled: false })}
              up={up}
              weight={up ? look.strength : (props.layers[name] ?? 0)}
              onPick={() => props.onPick(name)}
              onWeigh={w => props.onWeigh(name, w)}
            >
              {up && (look.strength < 1 || props.tweaked) ? (
                <span className={styles.chipStrength}>
                  {props.tweaked ? '•' : strength}
                </span>
              ) : null}
            </LookChip>
          )
        })}
      </nav>
    </>
  )
}

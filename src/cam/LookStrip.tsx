import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { ShuffleIcon } from './icons'
import { LookChip } from './LookChip'
import { lookLabel } from './looks'

import type { Layers, Look, Shelf } from './looks'
import type { ReactNode } from 'react'

// The strip mounts afresh for each tab and scrolls to the look that is up.
// Stable, so a render leaves the strip where the thumb put it.
const showUpChip = (nav: HTMLElement | null) =>
  nav
    ?.querySelector('[aria-pressed="true"]')
    ?.scrollIntoView({ inline: 'center', block: 'nearest' })

// The tabs for each part of the signal path and the strip of looks under them.
// The faults tab shows its pads, passed as children, in place of the strip.
export function LookStrip(props: {
  shelves: readonly Shelf[]
  shelf: Shelf
  faults: boolean
  look: Look | null
  layers: Layers
  tweaked: boolean
  onShelf: (name: string) => void
  onFaults: () => void
  onRoll: () => void
  onNormal: () => void
  onPick: (name: string) => void
  onWeigh: (name: string, weight: number) => void
  children: ReactNode
}) {
  const { look, shelf, faults } = props
  const strength = look === null ? 0 : Math.round(look.strength * 100)
  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="Kinds of look">
        {props.shelves.map(s => (
          <button
            key={s.name}
            role="tab"
            aria-selected={!faults && s === shelf}
            className={cx(styles.tab, !faults && s === shelf && styles.tabOn)}
            onClick={() => props.onShelf(s.name)}
          >
            {s.name}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={faults}
          className={cx(styles.tab, styles.faultsTab, faults && styles.tabOn)}
          onClick={props.onFaults}
        >
          faults
        </button>
      </div>

      {faults ? (
        props.children
      ) : (
        <nav
          key={shelf.name}
          className={styles.strip}
          aria-label="Looks"
          ref={showUpChip}
        >
          <span className={styles.roll}>
            <button
              className={cx(
                styles.chip,
                look?.rolled === true && styles.chipOn,
              )}
              title="scramble the picture"
              onClick={props.onRoll}
            >
              <ShuffleIcon />
              random
            </button>
          </span>
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
      )}
    </>
  )
}

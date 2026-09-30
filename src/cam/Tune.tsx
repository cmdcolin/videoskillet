import { snapToStep } from '../ui/controls'
import { cx } from '../ui/cx'
import { readingOf } from '../ui/format'
import { presetLabelFor } from '../ui/presets'
import { fromTravel, toTravel } from '../ui/travel'
import styles from './cam.module.css'
import { CloseIcon } from './icons'
import { lookKnobs, lookLabel, stackLabel } from './looks'

import type { Controls } from '../core/controls'
import type { SliderDef } from '../ui/controls'
import type { Layers, Look } from './looks'

const TRAVEL = 1000

function Knob(props: {
  def: SliderDef
  value: number
  onChange: (v: number) => void
}) {
  const { def, value } = props
  if (def.choices !== undefined) {
    return (
      <div className={styles.knob}>
        <span className={styles.knobName}>{def.label}</span>
        <span className={styles.choices}>
          {def.choices.map((c, i) => (
            <button
              key={c}
              className={cx(
                styles.choice,
                Math.round(value) === i && styles.choiceOn,
              )}
              onClick={() => props.onChange(i)}
            >
              {c}
            </button>
          ))}
        </span>
      </div>
    )
  }
  const t = Math.round(toTravel(def, value) * TRAVEL)
  return (
    <label className={styles.knob}>
      <span className={styles.knobName}>{def.label}</span>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={TRAVEL}
        value={t}
        onChange={e =>
          props.onChange(
            snapToStep(def, fromTravel(def, Number(e.target.value) / TRAVEL)),
          )
        }
      />
      <span className={styles.knobValue}>
        {readingOf(value, def.step, def.unit)}
      </span>
    </label>
  )
}

function Weight(props: {
  name: string
  weight: number
  onWeigh: (weight: number) => void
  onDrop?: () => void
}) {
  const pct = Math.round(props.weight * 100)
  return (
    <label className={cx(styles.knob, styles.strength)}>
      <span className={styles.knobName}>{props.name}</span>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={e => props.onWeigh(Number(e.target.value) / 100)}
      />
      <span className={styles.knobValue}>{pct}</span>
      {props.onDrop === undefined ? null : (
        <button
          className={styles.drop}
          aria-label={`take ${props.name} off`}
          onClick={props.onDrop}
        >
          <CloseIcon />
        </button>
      )}
    </label>
  )
}

// The look's strength, the weight of each look stacked on it, and then every
// control any of them sets and the set's own few, over the controls so the
// picture stays where it is. `controls` is the board as the looks and the
// knobs make it; `tweaked` says whether a knob has moved off the looks.
export function Tune(props: {
  look: Look | null
  layers: Layers
  controls: Controls
  tweaked: boolean
  onStrength: (strength: number) => void
  onLayer: (name: string, weight: number) => void
  onDrop: (name: string) => void
  onKnob: (key: SliderDef['key'], value: number) => void
  onReset: () => void
  onClose: () => void
}) {
  const { look, layers } = props
  return (
    <section className={styles.sheet} aria-label="Tune the look">
      <header className={styles.sheetHead}>
        <span className={styles.sheetTitle}>{stackLabel(look, layers)}</span>
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
        {look === null ? null : (
          <Weight
            name={Object.keys(layers).length > 0 ? lookLabel(look) : 'strength'}
            weight={look.strength}
            onWeigh={props.onStrength}
          />
        )}
        {Object.entries(layers).map(([name, weight]) => (
          <Weight
            key={name}
            name={presetLabelFor(name)}
            weight={weight}
            onWeigh={w => props.onLayer(name, w)}
            onDrop={() => props.onDrop(name)}
          />
        ))}
        {lookKnobs(look, layers).map(def => (
          <Knob
            key={def.key}
            def={def}
            value={props.controls[def.key]}
            onChange={v => props.onKnob(def.key, v)}
          />
        ))}
      </div>
    </section>
  )
}

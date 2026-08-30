import { cx } from './cx'
import styles from './ToggleButtonGroup.module.css'

// A discrete control: one button per option, index == value. Writes the same
// number a slider would, so MIDI, mod and presets treat it identically.
export function ToggleButtonGroup(props: {
  label: string
  options: string[]
  value: number
  disabled?: boolean
  // Sitting in a control row's track column rather than on a line of its own,
  // where the group's own vertical margin would make the row taller than the
  // sliders it lines up with.
  dense?: boolean
  // The cell a control row wants this in. A row is a grid and the switch is one
  // of its three items, so which area it lands in is the row's to say — see
  // Slider.module.css, where the narrow panel moves that area under the label.
  className?: string
  onChange: (v: number) => void
}) {
  return (
    <div
      className={cx(
        styles.group,
        props.dense === true && styles.dense,
        props.className,
      )}
      role="radiogroup"
      aria-label={props.label}
    >
      {props.options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={props.value === i}
          className={cx(styles.button, props.value === i && styles.on)}
          disabled={props.disabled}
          onClick={() => props.onChange(i)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

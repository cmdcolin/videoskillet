import styles from './cam.module.css'

// A native select, so a phone's own list opens.
export function Pick<K extends string>(props: {
  name: string
  label?: string
  value: K | ''
  placeholder?: string
  options: { key: K; label: string; title?: string; disabled?: boolean }[]
  disabled?: boolean
  onChange: (key: K) => void
}) {
  return (
    <label className={styles.pick}>
      {props.label === undefined ? null : <span>{props.label}</span>}
      <select
        className={styles.pickSelect}
        aria-label={props.name}
        value={props.value}
        disabled={props.disabled}
        onChange={e => {
          const hit = props.options.find(o => o.key === e.target.value)
          if (hit !== undefined) props.onChange(hit.key)
        }}
      >
        {props.placeholder === undefined ? null : (
          <option value="" disabled>
            {props.placeholder}
          </option>
        )}
        {props.options.map(o => (
          <option
            key={o.key}
            value={o.key}
            title={o.title}
            disabled={o.disabled}
          >
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

import styles from './cam.module.css'

// The colour a tap keyed on, as a dot where the finger was.
export function KeyRing(props: { x: number; y: number; rgb: string }) {
  return (
    <span
      className={styles.ring}
      style={{
        left: `${props.x * 100}%`,
        top: `${props.y * 100}%`,
        background: props.rgb,
      }}
    />
  )
}

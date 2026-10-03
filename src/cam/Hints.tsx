import styles from './cam.module.css'

const HINTS: [string, string][] = [
  ['swipe', 'step to the next or previous look'],
  ['hold', 'see the camera without the look'],
  ['pinch', 'zoom, or tap a lens stop under the picture'],
  ['tap', 'aim the key at a colour, on looks that key by colour'],
  ['drag up', 'on a look, mixes it in partway; stack as many as you like'],
]

export function Hints(props: { onClose: () => void }) {
  return (
    <button className={styles.hints} onClick={props.onClose}>
      <dl>
        {HINTS.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <span className={styles.hintsClose}>tap to close</span>
    </button>
  )
}

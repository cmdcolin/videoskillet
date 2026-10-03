import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { FlipIcon } from './icons'
import { Thumb } from './Thumb'

import type { Shot } from './deliver'
import type { Mode } from './Modes'

// The last shot at the left, the shutter in the middle and, where a camera can
// be switched, the flip at the right.
export function Shutter(props: {
  shot: Shot | null
  mode: Mode
  recording: boolean
  flip: { label: string; onClick: () => void } | null
  onShutter: () => void
}) {
  const { flip } = props
  return (
    <div className={styles.row}>
      {props.shot === null ? (
        <span className={styles.thumbSlot} />
      ) : (
        <Thumb shot={props.shot} />
      )}
      <button
        className={cx(
          styles.shutter,
          props.mode === 'video' && styles.shutterVideo,
          props.recording && styles.shutterRec,
        )}
        aria-label={
          props.mode === 'photo'
            ? 'take a photo'
            : props.recording
              ? 'stop recording'
              : 'start recording'
        }
        onClick={props.onShutter}
      />
      {flip === null ? (
        <span className={styles.thumbSlot} />
      ) : (
        <button
          className={styles.flip}
          aria-label={flip.label}
          onClick={flip.onClick}
        >
          <FlipIcon />
        </button>
      )}
    </div>
  )
}

import styles from './cam.module.css'

import type { CameraState } from './useCamera'

// What stands in for the picture until it is running: the engine rebuilding or
// stuck, and the camera not yet started, starting or refused.
export function CameraNotice(props: {
  rebuilding: boolean
  frozen: boolean
  state: CameraState
  error: string
  onCamera: boolean
  onStart: () => void
}) {
  if (props.rebuilding)
    return <p className={styles.notice}>Reconnecting to the GPU…</p>
  if (props.frozen)
    return (
      <p className={styles.notice}>
        The picture stopped updating. Reload the page to bring it back.
      </p>
    )
  if (props.state === 'off' && props.onCamera)
    return (
      <button className={styles.start} onClick={props.onStart}>
        Start camera
      </button>
    )
  if (props.state === 'starting')
    return <p className={styles.notice}>Starting the camera…</p>
  if (props.state === 'error')
    return (
      <div className={styles.notice}>
        <p>{props.error}</p>
        <button className={styles.start} onClick={props.onStart}>
          Try again
        </button>
      </div>
    )
  return null
}

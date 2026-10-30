import styles from './cam.module.css'
import { cameraMessage } from './useCamera'

import type { FrozenKind } from '../core/gpu/renderloop'
import type { CameraState } from './useCamera'

// What stands in for the picture until it is running: the engine rebuilding or
// stuck, and the camera not yet started, starting or refused.
export function CameraNotice(props: {
  rebuilding: boolean
  frozen: FrozenKind | null
  state: CameraState
  error: unknown
  onCamera: boolean
  onStart: () => void
}) {
  if (props.rebuilding)
    return <p className={styles.notice}>Reconnecting to the GPU…</p>
  if (props.frozen === 'cold')
    return (
      <div className={styles.notice}>
        <p>
          This tab has not been given a single frame since it loaded. Reloading
          lands in the same place, so open the page in a new tab.
        </p>
        <a
          className={styles.start}
          href={location.href}
          target="_blank"
          rel="noreferrer"
        >
          Open in a new tab
        </a>
      </div>
    )
  if (props.frozen === 'stalled')
    return (
      <p className={styles.notice}>
        The browser stopped painting this tab. It clears itself if the browser
        resumes; if it does not, close the tab and open it again.
      </p>
    )
  if (props.state === 'off' && props.onCamera)
    return (
      <button className={styles.start} onClick={() => props.onStart()}>
        Start camera
      </button>
    )
  if (props.state === 'starting')
    return <p className={styles.notice}>Starting the camera…</p>
  if (props.state === 'error')
    return (
      <div className={styles.notice}>
        <p>{cameraMessage(props.error)}</p>
        <button className={styles.start} onClick={() => props.onStart()}>
          Try again
        </button>
      </div>
    )
  return null
}

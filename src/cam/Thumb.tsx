import styles from './cam.module.css'
import { deliver } from './deliver'
import { ShareIcon } from './icons'

import type { Shot } from './deliver'

// The last photo or video, which opens the share sheet.
export function Thumb(props: { shot: Shot }) {
  const { shot } = props
  return (
    <button
      className={styles.thumb}
      title={`save or share ${shot.name}`}
      onClick={() => void deliver(shot)}
    >
      {shot.video ? (
        <video src={`${shot.url}#t=0.1`} muted playsInline preload="metadata" />
      ) : (
        <img src={shot.url} alt="" />
      )}
      <span className={styles.thumbShare}>
        <ShareIcon />
      </span>
    </button>
  )
}

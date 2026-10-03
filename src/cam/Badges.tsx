import { cx } from '../ui/cx'
import styles from './cam.module.css'
import { Elapsed } from './Elapsed'

export function Badges(props: {
  tapeLeft: number
  opening: boolean
  comparing: boolean
  recording: boolean
  recSince: number
}) {
  return (
    <>
      {props.tapeLeft > 0 ? (
        <span className={cx(styles.badge, styles.rec)}>
          tape {props.tapeLeft}
        </span>
      ) : props.opening ? (
        <span className={styles.badge}>second camera</span>
      ) : null}
      {props.comparing ? <span className={styles.badge}>original</span> : null}
      {props.recording ? (
        <span className={cx(styles.badge, styles.rec)}>
          <Elapsed since={props.recSince} />
        </span>
      ) : null}
    </>
  )
}

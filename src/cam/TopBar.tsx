import { publicUrl } from '../publicUrl'
import { versionLabel } from '../version'
import styles from './cam.module.css'
import { ShareIcon, UndoIcon } from './icons'

export function TopBar(props: {
  help: boolean
  canUndo: boolean
  fullHref: string
  onUndo: () => void
  onHelp: () => void
  onShare: () => void
}) {
  return (
    <header className={styles.top}>
      <a className={styles.brand} href="../" aria-label="videoskillet home">
        <img className={styles.mark} src={publicUrl('favicon.svg')} alt="" />
        <span className={styles.brandName}>videoskillet</span>
        <span className={styles.brandVersion}>{versionLabel}</span>
      </a>
      <span className={styles.topRight}>
        <button
          className={styles.help}
          aria-label="undo the last change to the look"
          disabled={!props.canUndo}
          onClick={() => props.onUndo()}
        >
          <UndoIcon />
        </button>
        <button
          className={styles.help}
          aria-label="share a link to this look"
          onClick={() => props.onShare()}
        >
          <ShareIcon />
        </button>
        <button
          className={styles.help}
          aria-label="how to use the camera"
          aria-pressed={props.help}
          onClick={() => props.onHelp()}
        >
          ?
        </button>
        <a
          className={styles.full}
          href={props.fullHref}
          title="open the whole instrument on this look"
        >
          full app ↗
        </a>
      </span>
    </header>
  )
}

import { publicUrl } from '../publicUrl'
import styles from './cam.module.css'

export function TopBar(props: {
  help: boolean
  fullHref: string
  onHelp: () => void
}) {
  return (
    <header className={styles.top}>
      <a className={styles.brand} href="../" aria-label="videoskillet home">
        <img className={styles.mark} src={publicUrl('favicon.svg')} alt="" />
        <span className={styles.brandName}>videoskillet</span>
      </a>
      <span className={styles.topRight}>
        <button
          className={styles.help}
          aria-label="how to use the camera"
          aria-pressed={props.help}
          onClick={props.onHelp}
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

import styles from './DemoDialog.module.css'
import { DEMOS } from './demos'
import { Dialog } from './Dialog'

export function DemoDialog(props: {
  onOpen: (query: string) => void
  onClose: () => void
}) {
  return (
    <Dialog title="Demos" size="paint" onClose={() => props.onClose()}>
      <div className={styles.grid}>
        {DEMOS.map(demo => (
          <button
            key={demo.name}
            className={styles.card}
            title={demo.says}
            onClick={() => {
              props.onOpen(demo.link)
              props.onClose()
            }}
          >
            <img
              className={styles.still}
              src={demo.still}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className={styles.name}>{demo.name}</span>
          </button>
        ))}
      </div>
      <p className={styles.note}>
        A demo is a whole board, so it loads its own pictures into A and B.
      </p>
    </Dialog>
  )
}

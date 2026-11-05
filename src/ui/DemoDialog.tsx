import demos from '../../demos.json'
import { publicUrl } from '../publicUrl'
import styles from './DemoDialog.module.css'
import { Dialog } from './Dialog'

const slug = (name: string) =>
  name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')

const GALLERY = demos.filter(d => d.gallery)

export function DemoDialog(props: {
  onOpen: (query: string) => void
  onClose: () => void
}) {
  return (
    <Dialog title="Demos" size="paint" onClose={() => props.onClose()}>
      <div className={styles.grid}>
        {GALLERY.map(demo => (
          <button
            key={demo.name}
            className={styles.card}
            title={demo.says}
            onClick={() => {
              props.onOpen(demo.query)
              props.onClose()
            }}
          >
            <img
              className={styles.still}
              src={publicUrl(`demos/${slug(demo.name)}.webp`)}
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

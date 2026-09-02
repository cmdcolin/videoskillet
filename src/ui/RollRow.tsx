import { ORIGIN_LABEL } from '../sources/pools'
import styles from './RollRow.module.css'

import type { PickKind, PoolOrigin } from '../sources/pools'

// The roll buttons under a deck that is on one of the public archives.
//
// A roll used to be hidden twice over: on the caption — clicking the name of a
// photograph to get a different photograph — and on re-picking the option that
// was already lit. Both are gestures you have to be told about, and the roll is
// the whole of what a channel *is*, so it gets the one row on the panel that
// says so in words.
//
// Commons gets two buttons because it holds two kinds of material and they are
// not interchangeable mid-set: a still holds perfectly still under the chain and
// gives still artifacts, a clip moves and gives moving ones. Rolling for one and
// being handed the other is the coin-flip this row exists to take away.
// archive.org holds footage alone (sources/archive.ts), so there is one button
// and nothing to choose between.
export function RollRow(props: {
  origin: PoolOrigin
  onRoll: (kind?: PickKind) => void
}) {
  const from = ORIGIN_LABEL[props.origin]
  return (
    <div className={styles.rollRow}>
      {props.origin === 'commons' ? (
        <>
          <button
            type="button"
            className={styles.rollBtn}
            title={`roll another still off ${from} — the one on this deck goes`}
            onClick={() => props.onRoll('photo')}
          >
            roll photo
          </button>
          <button
            type="button"
            className={styles.rollBtn}
            title={`roll another clip off ${from} — the one on this deck goes`}
            onClick={() => props.onRoll('video')}
          >
            roll clip
          </button>
        </>
      ) : (
        <button
          type="button"
          className={styles.rollBtn}
          title={`roll another clip off ${from} — it downloads whole first, so give it a few seconds`}
          onClick={() => props.onRoll('video')}
        >
          roll clip
        </button>
      )}
    </div>
  )
}

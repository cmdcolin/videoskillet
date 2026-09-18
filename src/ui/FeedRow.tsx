import { ORIGIN_LABEL, rollTopicsOf } from '../sources/pools'
import { cx } from './cx'
import { clampEvery, FEED_EVERY_MAX, FEED_EVERY_MIN } from './feed'
import styles from './FeedRow.module.css'
import ui from './ui.module.css'

import type { PoolOrigin, RollTopic } from '../sources/pools'
import type { FeedSettings } from './feed'

// Consecutive runs of one group, in the order the topics are listed.
function bandsOf(topics: readonly RollTopic[]) {
  const bands: { group: string | null; topics: RollTopic[] }[] = []
  for (const t of topics) {
    const last = bands.at(-1)
    if (last !== undefined && last.group === t.group) last.topics.push(t)
    else bands.push({ group: t.group, topics: [t] })
  }
  return bands
}

function TopicOption(props: { topic: RollTopic }) {
  return <option value={props.topic.value}>{props.topic.label}</option>
}

// The feed controls under a deck that is on a public archive: which topic it
// draws from, the next file now, and an automatic advance every N seconds.
export function FeedRow(props: {
  origin: PoolOrigin
  feed: FeedSettings
  rolling: boolean
  onAdvance: () => void
  onTopic: (topic: RollTopic) => void
  onRetime: (patch: Partial<FeedSettings>) => void
}) {
  const { origin, feed } = props
  const topics = rollTopicsOf(origin)
  const from = ORIGIN_LABEL[origin]
  const commitEvery = (raw: string) => {
    const n = Number(raw)
    if (raw !== '' && Number.isFinite(n))
      props.onRetime({ every: clampEvery(n) })
  }
  return (
    <div className={styles.feed}>
      <div className={styles.row}>
        <select
          className={cx(ui.select, styles.topic)}
          aria-label={`topic on ${from}`}
          title={`what this deck draws from on ${from}`}
          value={feed.topic[origin].value}
          onChange={e => {
            const picked = topics.find(t => t.value === e.target.value)
            if (picked !== undefined) props.onTopic(picked)
          }}
        >
          {bandsOf(topics).map(band =>
            band.group === null ? (
              band.topics.map(t => <TopicOption key={t.value} topic={t} />)
            ) : (
              <optgroup key={band.group} label={band.group}>
                {band.topics.map(t => (
                  <TopicOption key={t.value} topic={t} />
                ))}
              </optgroup>
            ),
          )}
        </select>
        <button
          type="button"
          className={styles.btn}
          title={
            origin === 'archive'
              ? `next clip off ${from} — it downloads whole first, so give it a few seconds`
              : `next file off ${from} — the one on this deck goes`
          }
          disabled={props.rolling}
          onClick={() => props.onAdvance()}
        >
          {props.rolling ? 'rolling…' : 'next'}
        </button>
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={cx(styles.btn, feed.auto && styles.btnOn)}
          aria-pressed={feed.auto}
          title={
            feed.auto
              ? 'stop the slideshow'
              : `advance to the next file every ${feed.every} seconds`
          }
          onClick={() => props.onRetime({ auto: !feed.auto })}
        >
          {feed.auto ? '■ slideshow' : '▶ slideshow'}
        </button>
        <label className={styles.every}>
          every
          <input
            // Remounted on each commit so the box shows the clamped value.
            key={feed.every}
            type="number"
            className={styles.seconds}
            min={FEED_EVERY_MIN}
            max={FEED_EVERY_MAX}
            defaultValue={feed.every}
            onBlur={e => commitEvery(e.currentTarget.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          s
        </label>
      </div>
    </div>
  )
}

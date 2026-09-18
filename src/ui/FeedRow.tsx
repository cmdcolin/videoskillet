import { useState } from 'react'

import { ORIGIN_LABEL, rollTopicsOf } from '../sources/pools'
import { cx } from './cx'
import { FEED_EVERY_MAX, FEED_EVERY_MIN, canStepBack, clampEvery } from './feed'
import styles from './FeedRow.module.css'
import ui from './ui.module.css'

import type { PoolOrigin, RollTopic } from '../sources/pools'
import type { DeckFeed, FeedSettings } from './feed'

const SEARCH = 'search'

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

function TopicPicker(props: {
  origin: PoolOrigin
  topic: RollTopic
  onTopic: (topic: RollTopic) => void
  onSearch: () => void
}) {
  const topics = rollTopicsOf(props.origin)
  return (
    <select
      className={cx(ui.select, styles.topic)}
      aria-label={`topic on ${ORIGIN_LABEL[props.origin]}`}
      title={`what this deck draws from on ${ORIGIN_LABEL[props.origin]}`}
      value={props.topic.value}
      onChange={e => {
        const picked = topics.find(t => t.value === e.target.value)
        if (e.target.value === SEARCH) props.onSearch()
        else if (picked !== undefined) props.onTopic(picked)
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
      <option value={SEARCH}>Search…</option>
    </select>
  )
}

function SearchBox(props: {
  origin: PoolOrigin
  onSearch: (query: string) => void
  onCancel: () => void
}) {
  return (
    <input
      type="search"
      className={styles.search}
      // Focused on arrival: it replaces the select the user has just used.
      autoFocus
      placeholder={`search ${ORIGIN_LABEL[props.origin]}, then Enter`}
      aria-label={`search ${ORIGIN_LABEL[props.origin]} for a feed`}
      onKeyDown={e => {
        if (e.key === 'Enter') props.onSearch(e.currentTarget.value)
        else if (e.key === 'Escape') props.onCancel()
      }}
      onBlur={e => {
        if (e.currentTarget.value.trim() === '') props.onCancel()
      }}
    />
  )
}

// The feed controls under a deck that is on one: what it draws from, a step
// back and forward along what it has shown, and an automatic advance every N
// seconds.
//
// `origin` is the archive the deck is on, or null for a list feed off the
// browser or the shelf, which has no topics to choose between.
export function FeedRow(props: {
  origin: PoolOrigin | null
  feed: DeckFeed
  onAdvance: () => void
  onBack: () => void
  onTopic: (topic: RollTopic) => void
  onSearch: (query: string) => void
  onEnd: () => void
  onRetime: (change: Partial<FeedSettings>) => void
}) {
  const { origin, feed } = props
  const { settings, list, busy } = feed
  const [searching, setSearching] = useState(false)
  const commitEvery = (raw: string) => {
    const n = Number(raw)
    if (raw !== '' && Number.isFinite(n))
      props.onRetime({ every: clampEvery(n) })
  }
  return (
    <div className={styles.feed}>
      <div className={styles.row}>
        {list !== null ? (
          <>
            <span className={styles.label} title={list.label}>
              {list.label} · {list.items.length}
            </span>
            <button
              type="button"
              className={styles.btn}
              title={
                origin === null
                  ? 'stop this feed — the deck keeps what it is showing'
                  : 'back to the topics'
              }
              aria-label="end this feed"
              onClick={() => props.onEnd()}
            >
              ✕
            </button>
          </>
        ) : origin === null ? null : searching ? (
          <SearchBox
            origin={origin}
            onSearch={q => {
              setSearching(false)
              props.onSearch(q)
            }}
            onCancel={() => setSearching(false)}
          />
        ) : (
          <TopicPicker
            origin={origin}
            topic={settings.topic[origin]}
            onTopic={t => props.onTopic(t)}
            onSearch={() => setSearching(true)}
          />
        )}
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.btn}
          title="the one before"
          aria-label="previous"
          disabled={busy || !canStepBack(feed.trail)}
          onClick={() => props.onBack()}
        >
          ◂
        </button>
        <button
          type="button"
          className={styles.btn}
          title={
            origin === 'archive'
              ? 'the next clip — archive.org downloads it whole first, so give it a few seconds'
              : 'the next one — what is on this deck now goes'
          }
          disabled={busy}
          onClick={() => props.onAdvance()}
        >
          {busy ? 'loading…' : 'next ▸'}
        </button>
        <button
          type="button"
          className={cx(styles.btn, settings.auto && styles.btnOn)}
          aria-pressed={settings.auto}
          title={
            settings.auto
              ? 'stop the slideshow'
              : `advance on its own every ${settings.every} seconds`
          }
          onClick={() => props.onRetime({ auto: !settings.auto })}
        >
          slideshow
        </button>
        <label className={styles.every}>
          every
          <input
            // Remounted on each commit so the box shows the clamped value.
            key={settings.every}
            type="number"
            className={styles.seconds}
            min={FEED_EVERY_MIN}
            max={FEED_EVERY_MAX}
            defaultValue={settings.every}
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

import { useEffect, useRef, useState } from 'react'

import { COOL_KEYS } from '../labels'
import { VOTE_SOURCE_NAMES } from './prepare'
import { useStream } from './useStream'
import { useVoteAuth } from './useVoteAuth'
import { useVoteEngines } from './useVoteEngines'
import styles from './vote.module.css'

import type { VoteSource } from './prepare'

// The volume labeller: one look, live, a 1-5 key, the next one.
//
// The same blindness rule as the pair page — nothing on screen names the
// recipe. The look is judged as a picture, and the record carries the rest.

const HOLD_HINT =
  'Hold this one: no auto-advance until you rate or skip. Time on screen is recorded either way.'

export function StreamPage() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [source, setSource] = useState<VoteSource>('bars')
  const { engines, error } = useVoteEngines([canvas])
  const auth = useVoteAuth()
  const stream = useStream({
    engine: engines?.[0] ?? null,
    source,
    uid: auth.user?.uid ?? null,
  })
  const armed = stream.judgeable && auth.user !== null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (stream.phase === 'idle') {
        e.preventDefault()
        stream.resume()
        return
      }
      const cool = COOL_KEYS.find(k => k.key === e.key)
      const tag = stream.vocabulary.find(t => t.key === e.key)
      if (cool !== undefined) {
        e.preventDefault()
        stream.rate(cool.cool)
      } else if (tag !== undefined) {
        e.preventDefault()
        stream.toggle(tag.name)
      } else if (e.key === ' ') {
        e.preventDefault()
        stream.hold()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        stream.skip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  })

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <h1 className={styles.title}>cool or not?</h1>
        <a className={styles.link} href="vote.html">
          pairs instead
        </a>
        <div className={styles.spacer} />
        <span className={styles.count}>{stream.seen} rated</span>
        {stream.pending > 0 && (
          <span
            className={styles.queued}
            title="Ratings held in this browser until they reach the server"
          >
            {stream.pending} unsent
          </span>
        )}
        <select
          className={styles.btn}
          value={source}
          onChange={e => {
            const next = VOTE_SOURCE_NAMES.find(n => n === e.target.value)
            if (next !== undefined) setSource(next)
          }}
          title="What the looks are rendered over"
        >
          {VOTE_SOURCE_NAMES.map(name => (
            <option key={name} value={name}>
              over {name}
            </option>
          ))}
        </select>
        {auth.user === null ? (
          <button
            className={styles.btn}
            disabled={auth.busy}
            onClick={() => void auth.start()}
          >
            sign in to save
          </button>
        ) : (
          <button className={styles.btn} onClick={() => void auth.stop()}>
            sign out{auth.user.name === null ? '' : ` (${auth.user.name})`}
          </button>
        )}
      </div>

      <p className={styles.blurb}>
        One roll of the signal path at a time. Rate it and the next one comes
        up; say nothing and it moves on by itself, and after a few of those it
        stops and waits. A 1 is as useful as a 5 — the model needs both.
      </p>

      {error !== '' && (
        <p className={styles.error}>
          WebGPU did not start: {error}. On Linux this page wants Firefox
          Nightly.
        </p>
      )}

      <div className={styles.stage}>
        <canvas ref={canvas} className={styles.clip} />
        {stream.phase === 'idle' && (
          <div className={styles.idle}>
            <span>stopped — nobody rated the last few</span>
            <button className={styles.pick} onClick={stream.resume}>
              keep going
            </button>
          </div>
        )}
      </div>

      <div className={styles.rating}>
        {COOL_KEYS.map(({ key, cool, label }) => (
          <button
            key={key}
            className={styles.pick}
            disabled={!armed}
            onClick={() => {
              stream.rate(cool)
            }}
          >
            <span className={styles.key}>{key}</span> {label}
          </button>
        ))}
      </div>

      <div className={styles.tags}>
        {stream.vocabulary.map(t => (
          <button
            key={t.key}
            className={stream.tags.includes(t.name) ? styles.tagOn : styles.tag}
            disabled={!stream.judgeable}
            title={t.hint}
            onClick={() => {
              stream.toggle(t.name)
            }}
          >
            <span className={styles.key}>{t.key}</span> {t.name}
          </button>
        ))}
      </div>

      <div className={styles.keys}>
        {armed ? (
          <>
            <span>
              <span className={styles.key}>z</span>…
              <span className={styles.key}>b</span> rate
            </span>
            <span>
              <span className={styles.key}>1</span>…
              <span className={styles.key}>0</span> tag first, optional
            </span>
            <span title={HOLD_HINT}>
              <span className={styles.key}>space</span>{' '}
              {stream.phase === 'held' ? 'holding' : 'hold'}
            </span>
            <span>
              <span className={styles.key}>→</span> skip
            </span>
          </>
        ) : auth.user === null && stream.judgeable ? (
          <span className={styles.notice}>
            Watch as long as you like — sign in above when you want the ratings
            counted.
          </span>
        ) : stream.phase === 'idle' ? (
          <span className={styles.notice}>any key continues</span>
        ) : (
          <span className={styles.notice}>
            {stream.phase === 'flushing'
              ? 'clearing the last look out of the feedback loops…'
              : 'letting it develop…'}
          </span>
        )}
      </div>
    </div>
  )
}

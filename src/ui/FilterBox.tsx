import styles from './FilterBox.module.css'

import type { RefObject } from 'react'

// The control filter, with a chip for each mode a button elsewhere set, so a
// narrowing you did not type is on screen and can be dropped where it shows.
export function FilterBox({
  inputRef,
  ...props
}: {
  inputRef: RefObject<HTMLInputElement | null>
  text: string
  moving: boolean
  look: boolean
  autoFocus: boolean
  onText: (text: string) => void
  onToggleMoving: () => void
  onToggleLook: () => void
  onClear: () => void
}) {
  return (
    <div className={styles.box}>
      {props.moving ? (
        <button
          className={styles.chip}
          title="showing only what the bay is driving — click to drop it"
          onClick={() => props.onToggleMoving()}
        >
          mod only ×
        </button>
      ) : null}
      {props.look ? (
        <button
          className={styles.chip}
          title="showing only what this look moves off stock — click to drop it"
          onClick={() => props.onToggleLook()}
        >
          this look ×
        </button>
      ) : null}
      {/* autoFocus rather than a focusing ref callback: an inline callback is
          new every render, and the fps counter re-renders the masthead four
          times a second, which pulled focus back here each time. */}
      <input
        ref={inputRef}
        className={styles.input}
        type="search"
        autoFocus={props.autoFocus}
        placeholder="rainbow, ghost, tear…"
        title="matches names and descriptions, so artifact words work: rainbow, ghost, dot crawl, tear, roll… — the count on the modulation row narrows whatever is up here to the controls the bay is driving"
        value={props.text}
        onChange={e => props.onText(e.target.value)}
      />
      <button
        className={styles.clear}
        title="clear the filter (esc)"
        aria-label="clear the filter"
        onClick={() => props.onClear()}
      >
        ×
      </button>
    </div>
  )
}

import { useState } from 'react'

import { boardText } from './boardText'
import styles from './BoardTextSheet.module.css'
import { cx } from './cx'
import { PanelSheet } from './PanelSheet'
import ui from './ui.module.css'

import type { Board, BoardApplied } from './boardText'

// The board, written out. See boardText.ts for what goes in it and why it is on
// screen rather than only on the clipboard.
//
// A `<pre>` with the text in it, so whatever is reading the page — a person, a
// screen reader, an agent walking the accessibility tree — gets the same block,
// and the copy button is there for the one reader that wanted the clipboard
// after all.
//
// The box under it takes a board back: a link, or a whole dump pasted from a
// chat, lands the way the link would.
export function BoardTextSheet(props: {
  board: Board
  onCopy: (text: string) => Promise<boolean>
  onApply: (text: string) => BoardApplied
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [draft, setDraft] = useState('')
  const [applied, setApplied] = useState<BoardApplied | null>(null)
  const text = boardText(props.board)
  return (
    <PanelSheet
      title="Board as text"
      label="board as text"
      onClose={props.onClose}
      actions={
        <button
          className={cx(ui.btn, ui.btnFlush)}
          onClick={() => {
            void props.onCopy(text).then(ok => {
              setCopied(ok)
            })
          }}
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      }
    >
      <pre className={styles.dump} tabIndex={0}>
        {text}
      </pre>
      <form
        className={styles.apply}
        onSubmit={e => {
          e.preventDefault()
          setApplied(props.onApply(draft))
        }}
      >
        <textarea
          className={styles.paste}
          aria-label="board to apply"
          placeholder="paste a link or a board here to apply it"
          rows={2}
          wrap="off"
          value={draft}
          onChange={e => {
            setDraft(e.target.value)
            setApplied(null)
          }}
        />
        <button
          className={cx(ui.btn, ui.btnFlush)}
          type="submit"
          disabled={draft.trim() === ''}
        >
          apply
        </button>
      </form>
      {applied !== null && (
        <p className={ui.hint} role="status">
          {applied.unknown.length === 0
            ? 'applied'
            : `applied without ${applied.unknown.join(', ')}, which ${applied.unknown.length === 1 ? 'is not a control' : 'are not controls'}`}
        </p>
      )}
    </PanelSheet>
  )
}

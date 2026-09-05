import { useState } from 'react'

import { boardText } from './boardText'
import styles from './BoardTextDialog.module.css'
import { cx } from './cx'
import { Dialog } from './Dialog'
import ui from './ui.module.css'

import type { Board } from './boardText'

// The board, written out. See boardText.ts for what goes in it and why it is on
// screen rather than only on the clipboard.
//
// A `<pre>` with the text in it, so whatever is reading the page — a person, a
// screen reader, an agent walking the accessibility tree — gets the same block,
// and the copy button is there for the one reader that wanted the clipboard
// after all.
export function BoardTextDialog(props: {
  board: Board
  onCopy: (text: string) => Promise<boolean>
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const text = boardText(props.board)
  return (
    <Dialog title="Board as text" size="paint" onClose={props.onClose}>
      <pre className={styles.dump} data-autofocus tabIndex={0}>
        {text}
      </pre>
      <div className={ui.helpText}>
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
      </div>
    </Dialog>
  )
}

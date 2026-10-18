import { useState } from 'react'

import { readFilter } from './filter'

import type { ControlKey } from '../core/controls'
import type { SliderDef } from './controls'

// The panel's filter: the words in the box, the motion mode and the look mode,
// and the verbs that move them from outside the box.
//
// A hook of its own so that App receives the query as a hook result. The React
// Compiler treats a hook result as frozen, so the query keeps its own memo in
// App. Built inline in App, the query shared a memo block with everything App
// later handed it to, and came back a new object whenever any of that changed.
// The query is the value of FilterContext, so a new one re-renders every group
// and section in the panel.
//
// `edited` is the controls the look moves off stock, which the look mode keeps
// its list in step with.
export function usePanelFilter(edited: readonly SliderDef[]) {
  const [text, setText] = useState('')
  // The other half of the filter, and a mode rather than a word: which controls
  // the bay is driving is a question the box cannot hold, because a routing
  // leaves the resting value alone and there is nothing to type. It rode in the
  // box as a pasted `∿` once, which made the two alternatives — you could ask
  // for moving rows or for "ghost", never both — and left the ✕ clearing a mode
  // it could not tell from a search.
  const [moving, setMoving] = useState(false)
  // The third half, raised from the look bar on a phone (see LookPopover): the
  // controls the look moves off stock, or null for the whole panel.
  const [look, setLook] = useState<ReadonlySet<ControlKey> | null>(null)
  const editedKeys = () => new Set(edited.map(s => s.key))
  // The same sticky membership LookPopover holds, for the same reason: a row
  // dragged back to stock stays put under the finger.
  if (
    look !== null &&
    (edited.some(s => !look.has(s.key)) ||
      (edited.length === 0 && look.size > 0))
  )
    setLook(editedKeys())
  return {
    text,
    setText,
    moving,
    look,
    query: readFilter(text, moving, look),
    // The three ways the filter moves from outside the box. Together here
    // because each has to speak for both halves of it: a mode the ✕ leaves
    // standing is a panel still narrowed by something with nothing on screen
    // explaining it.
    clear: () => {
      setText('')
      setMoving(false)
      setLook(null)
    },
    // A jump — the palette revealing a control, a door into a free box — asks
    // for one named thing, so it drops the mode rather than intersecting with
    // it. Landing on "nothing matches" because the bay happens not to be
    // driving what you looked up is not an answer to what was asked.
    reveal: (words: string) => {
      setText(words)
      setMoving(false)
      setLook(null)
    },
    // One switch wherever it is pressed — the Modulation section's count, the
    // palette, the chip in the box. Nothing typed can reach the mode, so this
    // is the whole of it.
    toggleMoving: () => setMoving(!moving),
    showMoving: () => setMoving(true),
    toggleLook: () => setLook(look === null ? editedKeys() : null),
  }
}

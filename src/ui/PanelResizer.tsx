import { useState } from 'react'

import { cx } from './cx'
import { MIN_PANEL_W, PANEL_W, panelWidthIn } from './panelWidth'

import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

// The grip between the picture and the panel.
//
// The panel was 332px and nothing but the bench could change it: one flag, one
// jump to 664px, and only above a 1280px viewport. Width is the sidebar's
// scarcest quantity — it is what decides whether a label wraps, and 305 controls
// are read through it — so it belongs to whoever is looking at it.
//
// Pointer capture rather than window listeners, so the drag needs no effect to
// wire up and no cleanup to get wrong: the rail keeps receiving moves after the
// pointer has left it, including over the canvas, which is the whole of what a
// document-level listener was for.
export function PanelResizer(props: {
  className: string
  onClassName: string
  width: number
  onWidth: (w: number) => void
}) {
  // Where the press landed and how wide the panel was then, so the width tracks
  // the pointer's travel rather than its position: the rail is a few pixels of
  // an element whose own left edge moves as the panel grows, and measuring
  // against that fed the drag back into itself.
  const [from, setFrom] = useState<{ x: number; w: number } | null>(null)
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (from !== null) {
      props.onWidth(
        panelWidthIn(from.w - (e.clientX - from.x), window.innerWidth),
      )
    }
  }
  // Arrows for the same gesture, in the direction the panel actually moves:
  // left widens it, because the edge being dragged is the panel's left one.
  const step = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.key === 'ArrowLeft' ? 16 : e.key === 'ArrowRight' ? -16 : 0
    if (by !== 0) {
      e.preventDefault()
      props.onWidth(panelWidthIn(props.width + by, window.innerWidth))
    }
  }
  return (
    <div
      className={cx(props.className, from !== null && props.onClassName)}
      // The window-splitter shape: a separator that is focusable and carries the
      // width it is set to, so the arrows below are announced as doing something
      // rather than as a tab stop that swallows them.
      role="separator"
      aria-orientation="vertical"
      aria-label="sidebar width"
      aria-valuenow={props.width}
      aria-valuemin={MIN_PANEL_W}
      tabIndex={0}
      title="drag to set the sidebar's width — arrows nudge it, double-click puts it back"
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setFrom({ x: e.clientX, w: props.width })
      }}
      onPointerMove={e => drag(e)}
      onPointerUp={() => setFrom(null)}
      onPointerCancel={() => setFrom(null)}
      onDoubleClick={() => props.onWidth(PANEL_W)}
      onKeyDown={e => step(e)}
    />
  )
}

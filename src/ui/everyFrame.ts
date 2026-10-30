// Calls `tick` on each animation frame of the window `el` is shown in. A panel
// portalled into the popout runs on the popout's frames, which keep coming while
// the main window is hidden. Returns the stop, which leaves a window that has
// closed alone.
export function everyFrame(el: Element, tick: () => void) {
  const view = el.ownerDocument.defaultView
  return view === null ? () => {} : loopOn(view, tick)
}

function loopOn(view: Window, tick: () => void) {
  let id = 0
  const loop = () => {
    tick()
    if (!view.closed) id = view.requestAnimationFrame(loop)
  }
  id = view.requestAnimationFrame(loop)
  return () => {
    if (!view.closed) view.cancelAnimationFrame(id)
  }
}

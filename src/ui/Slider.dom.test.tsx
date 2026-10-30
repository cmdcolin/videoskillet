import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { Slider } from './Slider'

// The ? card and the minor-adjustment card hang off the same edge of a row, so
// asking for the ? closes the vernier. A row can live in the popped-out window,
// where the vernier is in that window's document and not in this one.

vi.stubGlobal('matchMedia', (media: string) => ({
  matches: false,
  media,
  addEventListener: () => {},
  removeEventListener: () => {},
}))

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

function mountInPopout() {
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const popout = frame.contentDocument
  if (popout === null) throw new Error('the frame has no document')
  const view = popout.defaultView
  if (view === null) throw new Error('the frame has no window')
  view.HTMLDialogElement.prototype.showModal = () => {}
  view.HTMLDialogElement.prototype.close = () => {}
  const container = popout.createElement('div')
  popout.body.append(container)
  const { getByTitle } = render(
    <Slider
      label="noise"
      unit=""
      min={0}
      max={1}
      step={0.01}
      value={0.5}
      defaultValue={0}
      help="what it does"
      vernier
      onChange={() => {}}
    />,
    { container },
  )
  const id = getByTitle(/^minor adjustment/).getAttribute('popovertarget')
  const card = id === null ? null : popout.getElementById(id)
  if (card === null) throw new Error('the row drew no vernier card')
  const hidePopover = vi.fn()
  card.hidePopover = hidePopover
  act(() => {
    card.dispatchEvent(
      Object.assign(new view.Event('toggle'), { newState: 'open' }),
    )
  })
  return { help: getByTitle('what does this do?'), hidePopover }
}

test('hovering the ? closes an open vernier in the popped-out window', () => {
  const { help, hidePopover } = mountInPopout()
  fireEvent.mouseEnter(help)
  expect(hidePopover).toHaveBeenCalledTimes(1)
})

test('clicking the ? closes an open vernier in the popped-out window', () => {
  const { help, hidePopover } = mountInPopout()
  fireEvent.click(help)
  expect(hidePopover).toHaveBeenCalled()
})

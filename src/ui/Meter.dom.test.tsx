import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { AudioState } from '../core/signal/audiostate'
import { Meter } from './Meter'

// The level bar in the popped-out panel follows the audio on the popout's own
// frames, which keep coming while the main window is hidden.

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

test('runs on the frames of the window it is shown in', () => {
  const main = vi.fn(() => 0)
  vi.stubGlobal('requestAnimationFrame', main)
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const doc = frame.contentDocument
  if (doc === null) throw new Error('the frame has no document')
  const view = doc.defaultView
  if (view === null) throw new Error('the frame has no window')
  const due: FrameRequestCallback[] = []
  view.requestAnimationFrame = cb => due.push(cb)
  const container = doc.createElement('div')
  doc.body.append(container)
  const audio = new AudioState()
  render(<Meter audio={audio} orient="h" />, { container })

  audio.hit = 0.75
  for (const cb of due.splice(0)) cb(0)
  const unlit = container.firstElementChild?.firstElementChild
  if (!(unlit instanceof view.HTMLElement)) throw new Error('no unlit mask')
  expect(unlit.style.width).toBe('25%')
  expect(main).not.toHaveBeenCalled()
})

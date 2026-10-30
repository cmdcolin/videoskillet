import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { LoopScrub, Scrub } from './Scrub'

// The seek bar follows a playing clip by reading the element each frame and
// writing the thumb, the fill and the clock straight to the DOM. A clip that
// plays must not re-render anything: the transport state lives in App's hooks,
// so a render here used to be a render of the whole app at 10 Hz.

let frames: FrameRequestCallback[] = []

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

const step = () => {
  const due = frames
  frames = []
  for (const cb of due) cb(0)
}

test('follows the playhead every frame without a render', () => {
  let now = 5
  let commits = 0
  render(
    <Profiler id="scrub" onRender={() => commits++}>
      <Scrub duration={120} readTime={() => now} onSeek={() => {}} />
    </Profiler>,
  )
  const input = screen.getByRole<HTMLInputElement>('slider')
  expect(input.value).toBe('5')
  expect(input.parentElement?.parentElement?.textContent).toBe('0:05 / 2:00')

  const before = commits
  now = 65
  step()
  expect(input.value).toBe('65')
  expect(input.style.getPropertyValue('--p')).toBe('54.2%')
  expect(input.parentElement?.parentElement?.textContent).toBe('1:05 / 2:00')
  expect(commits).toBe(before)
})

test('holds the thumb at the end past the duration', () => {
  render(<Scrub duration={10} readTime={() => 12} onSeek={() => {}} />)
  const input = screen.getByRole<HTMLInputElement>('slider')
  expect(input.value).toBe('10')
  expect(input.style.getPropertyValue('--p')).toBe('100.0%')
})

test('a drag seeks and the next frame shows where it landed', () => {
  let now = 0
  render(
    <Scrub
      duration={60}
      readTime={() => now}
      onSeek={t => {
        now = t
      }}
    />,
  )
  const input = screen.getByRole<HTMLInputElement>('slider')
  fireEvent.change(input, { target: { value: '30' } })
  step()
  expect(now).toBe(30)
  expect(input.value).toBe('30')
  expect(input.style.getPropertyValue('--p')).toBe('50.0%')
})

// A panel popped out into its own window keeps its seek bar moving while the
// main window is hidden, so the bar has to run on the popout's frames.
function popout() {
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const view = frame.contentWindow
  if (view === null) throw new Error('the frame has no window')
  const due: FrameRequestCallback[] = []
  const cancel = vi.fn()
  view.requestAnimationFrame = cb => due.push(cb)
  view.cancelAnimationFrame = cancel
  const container = view.document.createElement('div')
  view.document.body.append(container)
  const advance = () => {
    for (const cb of due.splice(0)) cb(0)
  }
  const close = () => Object.defineProperty(view, 'closed', { value: true })
  return { container, advance, cancel, close }
}

test('runs on the frames of the window it is shown in', () => {
  let now = 5
  const win = popout()
  render(<Scrub duration={120} readTime={() => now} onSeek={() => {}} />, {
    container: win.container,
  })
  const input = within(win.container).getByRole<HTMLInputElement>('slider')
  now = 65
  win.advance()
  expect(input.value).toBe('65')
  expect(frames).toEqual([])
})

test('lets go of the popout on unmount, and leaves a closed one alone', () => {
  const open = popout()
  const first = render(
    <Scrub duration={10} readTime={() => 0} onSeek={() => {}} />,
    { container: open.container },
  )
  first.unmount()
  expect(open.cancel).toHaveBeenCalledTimes(1)

  const closed = popout()
  const second = render(
    <Scrub duration={10} readTime={() => 0} onSeek={() => {}} />,
    { container: closed.container },
  )
  closed.close()
  second.unmount()
  expect(closed.cancel).not.toHaveBeenCalled()
})

test('the loop bar runs on the popout too', () => {
  let now = 2
  const win = popout()
  render(
    <LoopScrub
      cue={{ in: 1, out: 3 }}
      duration={10}
      readTime={() => now}
      onSeek={() => {}}
      onMoveEdge={() => {}}
      onSettle={() => {}}
    />,
    { container: win.container },
  )
  const input = win.container.querySelector('input')
  now = 2.5
  win.advance()
  expect(input?.value).toBe('2.5')
  expect(frames).toEqual([])
})

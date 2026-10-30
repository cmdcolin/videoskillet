import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { Scrub } from './Scrub'

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

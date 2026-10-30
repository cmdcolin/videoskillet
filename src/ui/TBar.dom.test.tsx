import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { Listeners } from '../core/listeners'
import { ControlsContext, ControlStoreContext } from './ControlsContext'
import { barPosition } from './deckModel'
import { TBar } from './TBar'

import type { Controls } from '../core/controls'
import type { ControlsApi } from './ControlsContext'

// A key on the bar takes it back from a running auto-take, as a pointer on it
// does: the take's next frame must not overwrite where the key put it.

const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0

beforeEach(() => {
  frames.clear()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    nextFrame += 1
    frames.set(nextFrame, cb)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: false,
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const runFrames = (at: number) => {
  const due = [...frames.values()]
  frames.clear()
  for (const cb of due) cb(at)
}

function mount() {
  const listeners = new Listeners()
  let board: Controls = { ...DEFAULT_CONTROLS, bGain: 0, aGain: 1 }
  const store = { subscribe: listeners.subscribe, get: () => board }
  const writeControls = (next: Controls) => {
    board = next
    listeners.emit()
  }
  const api = new Proxy(
    { writeControls },
    { get: (t, k) => (k in t ? t[k as keyof typeof t] : () => {}) },
  ) as unknown as ControlsApi
  render(
    <ControlStoreContext value={store}>
      <ControlsContext value={api}>
        <TBar />
      </ControlsContext>
    </ControlStoreContext>,
  )
  return () => barPosition(board)
}

test('a key on the bar stops a running auto-take', () => {
  const position = mount()
  fireEvent.click(screen.getByText('take'))
  runFrames(performance.now())
  fireEvent.keyDown(screen.getByRole('slider'), { key: 'Home' })
  runFrames(performance.now() + 60_000)
  expect(position()).toBe(0)
  expect(screen.getByText('take')).toBeDefined()
})

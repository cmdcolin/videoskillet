import { cleanup, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { useShortcuts } from './useShortcuts'

// The listeners are bound once per window, and each key reaches the handlers
// of the latest render.

afterEach(cleanup)

const noop = () => {}

const handlers = (onEscape: () => void) => ({
  onEscape,
  onSearch: noop,
  onPalette: noop,
  onUndo: noop,
  canUndo: false,
  onRedo: noop,
  canRedo: false,
  onToggleFullscreen: noop,
  onToggleSidebar: noop,
  onStartCompare: noop,
  onEndCompare: noop,
  onToggleRecord: noop,
  onGrabStill: noop,
  onSaveSlot: noop,
  onRecallSlot: noop,
  onSaveProfile: noop,
  onTapCue: noop,
  onRetrigger: noop,
  onFire: noop,
  onToggleDrift: noop,
  onFault: () => undefined,
})

test('a key reaches the handlers of the latest render without rebinding', () => {
  const add = vi.spyOn(window, 'addEventListener')
  const first = vi.fn()
  const second = vi.fn()
  const { rerender } = renderHook(h => useShortcuts(null, h), {
    initialProps: handlers(first),
  })
  const bound = add.mock.calls.length
  rerender(handlers(second))
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
  expect(add.mock.calls.length).toBe(bound)
  add.mockRestore()
})

// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { useFlash } from './useFlash'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

test('a second flash keeps its mark for the whole time, whatever the first was', () => {
  const { result } = renderHook(() => useFlash<string>(1200))
  act(() => result.current.flash('first'))
  wait(1000)
  act(() => result.current.flash('second'))
  wait(300)
  expect(result.current.shown).toBe('second')
  wait(900)
  expect(result.current.shown).toBeNull()
})

test('the same mark flashed again starts its clock over', () => {
  const { result } = renderHook(() => useFlash<string>(1200))
  act(() => result.current.flash('copied'))
  wait(1000)
  act(() => result.current.flash('copied'))
  wait(300)
  expect(result.current.shown).toBe('copied')
  wait(900)
  expect(result.current.shown).toBeNull()
})

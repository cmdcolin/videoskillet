import { describe, expect, it, vi } from 'vitest'

import { PadPresses } from './usePadHold'

const pad = () => {
  const release = vi.fn()
  const start = vi.fn((_held: boolean) => release)
  return { presses: new PadPresses(), start, release }
}

describe('PadPresses', () => {
  it('holds the fault from pointer down to pointer up', () => {
    const { presses, start, release } = pad()
    presses.down(1, start)
    expect(start).toHaveBeenCalledWith(true)
    expect(release).not.toHaveBeenCalled()
    presses.up(1)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('ignores the click that follows a press', () => {
    const { presses, start } = pad()
    presses.down(1, start)
    presses.up(1)
    presses.click(start)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('runs a click with no press before it as a tap', () => {
    const { presses, start } = pad()
    presses.click(start)
    expect(start).toHaveBeenCalledWith(false)
  })

  it('still taps from the keyboard after a cancelled press', () => {
    const { presses, start, release } = pad()
    presses.down(1, start)
    presses.cancel(1)
    expect(release).toHaveBeenCalledTimes(1)
    presses.click(start)
    expect(start).toHaveBeenLastCalledWith(false)
  })

  it('lets go of one finger without releasing the other', () => {
    const presses = new PadPresses()
    const first = vi.fn()
    const second = vi.fn()
    presses.down(1, () => first)
    presses.down(2, () => second)
    presses.up(1)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })
})

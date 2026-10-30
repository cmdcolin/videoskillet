import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSecond } from './useSecond'

import type { OtherAnswer } from './dual'
import type { Opened } from './useCamera'

vi.mock('./tape', () => ({
  TAPE_SECONDS: 4,
  dropLoop: vi.fn(),
  playLoop: vi.fn(),
  recordTape: vi.fn(),
  relayCamera: vi.fn(),
}))

const DUAL_STORE = 'videoskillet_cam_dual'

const mount = (answer: OtherAnswer<Opened>) => {
  const openOther = vi.fn(() => Promise.resolve(answer))
  const { result } = renderHook(() =>
    useSecond(
      {
        camera: () => null,
        showSecond: vi.fn(),
        layoutNow: () => 'whole',
      },
      { openOther, adopt: () => null },
      vi.fn(),
      null,
    ),
  )
  const load = () => act(() => result.current.load())
  return { openOther, load }
}

describe('the second camera on B', () => {
  it('asks again after a refusal that left the first camera running', async () => {
    const { openOther, load } = mount({ kind: 'refused' })
    await load()
    await load()
    expect(openOther).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(DUAL_STORE)).toBeNull()
  })

  it('asks again after an ask a newer one superseded', async () => {
    const { openOther, load } = mount({ kind: 'superseded' })
    await load()
    await load()
    expect(openOther).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(DUAL_STORE)).toBeNull()
  })

  it('stops asking a phone that runs one camera at a time', async () => {
    const { openOther, load } = mount({ kind: 'oneAtATime' })
    await load()
    await load()
    expect(openOther).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(DUAL_STORE)).toBe('no')
  })
})

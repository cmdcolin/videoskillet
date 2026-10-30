import { describe, expect, it } from 'vitest'

import { answerOf, dualAfter } from './dual'

const both = {
  other: 'back',
  latest: true,
  same: false,
  firstLive: true,
  otherLive: true,
}

describe('the ask for the other camera', () => {
  it('takes the other camera while both deliver', () => {
    expect(answerOf(both)).toEqual({ kind: 'ok', other: 'back' })
  })

  it('hears one camera at a time when the first goes down', () => {
    expect(answerOf({ ...both, firstLive: false }).kind).toBe('oneAtATime')
    expect(answerOf({ ...both, other: null, firstLive: false }).kind).toBe(
      'oneAtATime',
    )
  })

  it('hears one camera at a time when the same camera comes back', () => {
    expect(answerOf({ ...both, same: true }).kind).toBe('oneAtATime')
  })

  // getUserMedia threw, a NotReadableError say, and the first camera ran on.
  it('hears a refusal that leaves the first camera running', () => {
    expect(answerOf({ ...both, other: null, otherLive: false }).kind).toBe(
      'refused',
    )
    expect(answerOf({ ...both, otherLive: false }).kind).toBe('refused')
  })

  it('says nothing about the phone once a newer ask has started', () => {
    expect(answerOf({ ...both, latest: false }).kind).toBe('superseded')
    expect(answerOf({ ...both, latest: false, firstLive: false }).kind).toBe(
      'superseded',
    )
  })
})

describe('the stored word for both cameras', () => {
  it('is yes after both ran and no after one at a time', () => {
    expect(dualAfter('ok', null)).toBe('yes')
    expect(dualAfter('oneAtATime', 'yes')).toBe('no')
  })

  it('keeps what it was after a refusal or a superseded ask', () => {
    expect(dualAfter('refused', null)).toBeNull()
    expect(dualAfter('refused', 'yes')).toBe('yes')
    expect(dualAfter('superseded', 'yes')).toBe('yes')
  })
})

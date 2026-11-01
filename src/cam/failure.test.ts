import { describe, expect, it } from 'vitest'

import { failureMessage } from './failure'

describe('a failure on the camera page', () => {
  it('asks for a permission that was turned down', () => {
    const refused = new DOMException('no', 'NotAllowedError')
    expect(failureMessage({ during: 'sound', error: refused })).toMatch(
      /^Microphone access was turned down/,
    )
    expect(
      failureMessage({ during: 'captions', error: 'not-allowed' }),
    ).toMatch(/^Captions need the microphone/)
    expect(failureMessage({ during: 'tilt', error: null })).toMatch(
      /^Motion access was turned down/,
    )
  })

  it('names what the page was doing, and the reason', () => {
    expect(
      failureMessage({ during: 'tape', error: new Error('encoder gone') }),
    ).toBe('tape: encoder gone')
    expect(failureMessage({ during: 'sound', error: new Error('busy') })).toBe(
      'sound: busy',
    )
    expect(
      failureMessage({ during: 'shutter', error: 'recording failed: full' }),
    ).toBe('recording failed: full')
  })
})

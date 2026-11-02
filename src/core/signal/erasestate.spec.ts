import { describe, expect, it } from 'vitest'

import { OldRecording } from './erasestate'

describe('OldRecording', () => {
  it('stays erased without colour-under to hide in', () => {
    const old = new OldRecording()
    for (let f = 0; f < 600; f++) {
      const u = old.update(f, 0.8, false)
      expect(u.uniforms.eraseOld).toBe(0)
      expect(u.capture).toBe(false)
    }
  })

  it('takes a copy on engaging and renews it at random cuts', () => {
    const old = new OldRecording()
    const captures = Array.from(
      { length: 60 * 120 },
      (_, f) => old.update(f, 0.5, true).capture,
    )
    expect(captures[0]).toBe(true)
    const count = captures.filter(Boolean).length
    expect(count).toBeGreaterThan(8)
    expect(count).toBeLessThan(40)
  })

  it('reproduces from the frame count', () => {
    const run = () => {
      const old = new OldRecording()
      return Array.from({ length: 900 }, (_, f) => old.update(f, 0.5, true))
    }
    expect(run()).toEqual(run())
  })
})

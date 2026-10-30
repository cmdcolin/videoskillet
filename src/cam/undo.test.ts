import { describe, expect, it } from 'vitest'

import { CLEAN } from './scene'
import { MAX_STEPS, STEP_GAP_MS, banked, changesStep, stepOf } from './undo'

import type { Scene } from './scene'

const scene: Scene = {
  ...CLEAN,
  look: { name: 'vhs', strength: 1, rolled: false },
  mix: null,
  keyHue: null,
}
const CLEAN_SCENE: Scene = { ...CLEAN, mix: null, keyHue: null }

describe('changesStep', () => {
  it('ignores a change to the mixer alone', () => {
    expect(
      changesStep(scene, { ...scene, mix: { mode: 'dissolve', fader: 1 } }),
    ).toBe(false)
  })

  it('sees a knob turned', () => {
    expect(changesStep(scene, { ...scene, tweaks: { bKeyHueDeg: 90 } })).toBe(
      true,
    )
  })
})

describe('banked', () => {
  it('banks the scene before a change that follows a pause', () => {
    expect(banked([], scene, STEP_GAP_MS + 1)).toEqual([stepOf(scene)])
  })

  it('folds a change that follows quickly into the step before it', () => {
    const past = [stepOf(scene)]
    expect(banked(past, scene, STEP_GAP_MS - 1)).toBe(past)
  })

  it('keeps the latest steps', () => {
    const past = Array.from({ length: MAX_STEPS }, () => stepOf(CLEAN_SCENE))
    const next = banked(past, scene, Infinity)
    expect(next).toHaveLength(MAX_STEPS)
    expect(next.at(-1)).toEqual(stepOf(scene))
  })
})

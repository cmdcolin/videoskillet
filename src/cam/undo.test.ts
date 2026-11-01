import { describe, expect, it } from 'vitest'

import { CLEAN, boardOf } from './scene'
import {
  MAX_STEPS,
  STEP_GAP_MS,
  banked,
  changesStep,
  restored,
  stepOf,
} from './undo'

import type { Scene } from './scene'

const scene: Scene = {
  ...CLEAN,
  look: { name: 'vhs', strength: 1, rolled: false },
  mix: null,
  keyer: null,
}
const CLEAN_SCENE: Scene = { ...CLEAN, mix: null, keyer: null }

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

describe('the chroma keyer in a step', () => {
  const green = { level: 0.3, luma: 0.5 }
  const blue = { level: 0.25, luma: 0.2 }
  const keyed: Scene = {
    ...scene,
    keyer: { hue: 120, backing: green },
    hue: 120,
  }
  const retapped = { ...keyed, keyer: { hue: 200, backing: blue }, hue: 200 }

  it('sees a tap that re-aims the keyer', () => {
    expect(changesStep(keyed, retapped)).toBe(true)
  })

  it('ignores the keyer switched on or off', () => {
    expect(changesStep(scene, { ...scene, keyer: keyed.keyer })).toBe(false)
    expect(changesStep(keyed, { ...keyed, keyer: null })).toBe(false)
  })

  it('puts back where a tap aimed the keyer and the backing it measured', () => {
    expect(restored(retapped, stepOf(keyed))).toMatchObject({
      hue: 120,
      keyer: { hue: 120, backing: green },
    })
  })

  it('puts back the additive calibration a tap made', () => {
    const before = boardOf(keyed, 1).controls
    const after = boardOf(
      { ...retapped, ...restored(retapped, stepOf(keyed)) },
      1,
    ).controls
    expect(after.bKeyLevel).toBe(before.bKeyLevel)
    expect(after.bKeyBackY).toBe(before.bKeyBackY)
    expect(boardOf(retapped, 1).controls.bKeyLevel).not.toBe(before.bKeyLevel)
  })

  it('leaves the keyer off when it was switched off since', () => {
    expect(restored(scene, stepOf(keyed)).keyer).toBeNull()
  })

  it('leaves the keyer on when it was switched on since', () => {
    expect(restored(keyed, stepOf(scene)).keyer).toBe(keyed.keyer)
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

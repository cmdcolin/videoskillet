import { describe, expect, it } from 'vitest'

import { MIX_SHELF, mixControls } from './looks'
import { CLEAN, FIRST_MIX, boardOf, mixerOwned } from './scene'

import type { Scene } from './scene'

const mixLook = MIX_SHELF.looks[0] ?? ''
const scene: Scene = {
  ...CLEAN,
  look: { name: 'pictureSearch', strength: 1, rolled: false },
  mix: FIRST_MIX,
  keyer: null,
}

describe('the mixer', () => {
  it('belongs to a look stacked on top that sets it', () => {
    expect(mixerOwned(scene)).toBe(false)
    expect(mixerOwned({ ...scene, layers: { [mixLook]: 0.5 } })).toBe(true)
  })

  it('comes back when that layer is dragged to zero', () => {
    const dropped = { ...scene, layers: { [mixLook]: 0 } }
    expect(mixerOwned(dropped)).toBe(false)
    expect(boardOf(dropped, 1).controls).toMatchObject(
      mixControls(FIRST_MIX, 1),
    )
  })
})

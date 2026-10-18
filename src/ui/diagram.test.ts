import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS, type ControlKey } from '../core/controls'
import { NEEDS } from './controls'
import { boxFold, shutBy } from './diagram'
import { MIXER_LOOP_OPENS } from './schematicKeys'

const at = (over: Partial<typeof DEFAULT_CONTROLS>) => ({
  ...DEFAULT_CONTROLS,
  ...over,
})

describe('folding an open box', () => {
  it('ends every chain of needs', () => {
    for (const start of Object.keys(NEEDS) as ControlKey[]) {
      const seen = new Set<ControlKey>()
      for (let k = start; NEEDS[k]; k = NEEDS[k]!.key) {
        expect(seen.has(k)).toBe(false)
        seen.add(k)
      }
    }
  })

  it('names the outermost shut gate', () => {
    const c = at({ cfbMix: 0, cfbKey: 0, cfbKeyAcceptDeg: 0 })
    expect(shutBy('cfbKeyHueDeg', c)).toBe('cfbKey')
    expect(shutBy('cfbKey', c)).toBe('cfbKey')
    expect(shutBy('cfbKeyHueDeg', at({ cfbMix: 0.6, cfbKey: 0.5 }))).toBe(
      'cfbKeyHueDeg',
    )
    expect(
      shutBy(
        'cfbKeyHueDeg',
        at({ cfbMix: 0.6, cfbKey: 0.5, cfbKeyAcceptDeg: 40 }),
      ),
    ).toBe(undefined)
  })

  it('keeps the gate and folds what sits behind it', () => {
    const fold = boxFold(
      MIXER_LOOP_OPENS.ring,
      at({ cfbMix: 0.6, cfbRing: 0, cfbRingSrc: 0 }),
    )
    expect(fold).toBe(',cfbRingSrc,cfbRingSrc')
  })

  it('draws a row moved off its default even behind a shut gate', () => {
    const fold = boxFold(
      MIXER_LOOP_OPENS.ring,
      at({ cfbMix: 0.6, cfbRing: 0, cfbCarrierKHz: 3 }),
    )
    expect(fold).toBe(',cfbRingSrc,')
  })
})

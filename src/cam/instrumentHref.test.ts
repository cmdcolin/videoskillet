import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { PRESETS } from '../ui/presets'
import { parseSessionParams } from '../ui/urlParams'
import { instrumentHref } from './instrumentHref'
import { lookMod, mixesItself } from './looks'
import { CLEAN, boardOf } from './scene'

import type { Scene } from './scene'

const opened = (href: string) => {
  const search = href.slice(href.indexOf('?'))
  const params = parseSessionParams(search)
  return {
    q: new URLSearchParams(search),
    params,
    controls: { ...DEFAULT_CONTROLS, ...params.controls },
  }
}

const withMod = PRESETS.find(
  p => lookMod({ name: p.name, strength: 1, rolled: false }).length > 0,
)!.name
const plain = PRESETS.find(
  p => !mixesItself(p.name) && p.name !== withMod,
)!.name

describe('the full-app link', () => {
  it('carries a weak, stacked, tweaked look with its bay and the mix', () => {
    const scene: Scene = {
      ...CLEAN,
      look: { name: withMod, strength: 0.4, rolled: false },
      layers: { [plain]: 0.7 },
      tweaks: { fbMix: 0.3 },
      mix: { mode: 'dissolve', fader: 0.25 },
    }
    const { q, params, controls } = opened(
      instrumentHref(scene, 'webcam', 'bars'),
    )
    const want = boardOf(scene, 1).controls
    for (const k of Object.keys(want) as (keyof typeof want)[])
      expect(controls[k], k).toBeCloseTo(want[k], 3)
    expect(params.mod).toEqual(lookMod(scene.look, scene.layers))
    expect(q.get('src')).toBe('webcam')
    expect(q.get('srcb')).toBe('bars')
  })

  it('leaves the mixer behind when B holds nothing a link can carry', () => {
    const scene: Scene = {
      ...CLEAN,
      look: null,
      mix: { mode: 'dissolve', fader: 0.25 },
    }
    const { q, params, controls } = opened(instrumentHref(scene, null, null))
    expect(params.damaged).toBe(false)
    expect(controls).toEqual(DEFAULT_CONTROLS)
    expect(q.has('srcb')).toBe(false)
    expect(q.has('mod')).toBe(false)
  })
})

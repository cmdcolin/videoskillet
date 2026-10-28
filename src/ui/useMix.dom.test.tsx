import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { Listeners } from '../core/listeners'
import { Glide } from '../core/signal/glide'
import { DEFAULT_STAB } from './modSlots'
import { PRESET_BY_NAME, blendPresets } from './presets'
import { useMix } from './useMix'

import type { ControlKey, Controls } from '../core/controls'
import type { GlidePlan } from '../core/signal/glide'

// The engine's half of a morph, without a GPU: the live board, the settled one
// it publishes on every write and landing, and the real glide between them.
function fakeEngine() {
  let live: Controls = { ...DEFAULT_CONTROLS }
  let settled = live
  let now = 0
  const listeners = new Listeners()
  const glide = new Glide(new Set())
  const settle = () => {
    settled = { ...live }
    listeners.emit()
  }
  return {
    settledStore: { subscribe: listeners.subscribe, get: () => settled },
    getControls: () => ({ ...live }),
    writeControls: (next: Controls) => {
      glide.stop()
      live = { ...next }
      settle()
    },
    setControl: (key: ControlKey, value: number) => {
      glide.stop()
      live = { ...live, [key]: value }
      settle()
    },
    startGlide: (plan: GlidePlan) => glide.start(live, plan, now),
    getGlideTarget: () => glide.target,
    tick: (ms: number) => {
      now += ms
      if (glide.apply(live, now).done) settle()
    },
  }
}

const mod = {
  slots: [],
  setSlots: vi.fn(),
  setRoutings: vi.fn(),
  master: 1,
  setMaster: vi.fn(),
  stab: DEFAULT_STAB,
  setStab: vi.fn(),
}

const mount = (morphSeconds: number) => {
  const eng = fakeEngine()
  const { result } = renderHook(() =>
    useMix({ ...eng, morphSeconds, sourceBOn: false, rand: Math.random, mod }),
  )
  const run = (verb: () => void) => act(verb)
  const land = () => act(() => eng.tick(60_000))
  return { eng, mix: () => result.current, run, land }
}

const patchOf = (name: string) => PRESET_BY_NAME.get(name)!.patch

describe('useMix under a morph', () => {
  it('resets a view control from its row', () => {
    const { eng, mix, run, land } = mount(1)
    run(() => eng.setControl('crtZoom', 4))
    run(() => mix().resetControl('crtZoom'))
    land()
    expect(eng.getControls().crtZoom).toBe(DEFAULT_CONTROLS.crtZoom)
  })

  it('takes a zoom back on undo', () => {
    const { eng, mix, run, land } = mount(1)
    run(() => mix().snapshotForUndo())
    run(() => eng.setControl('crtZoom', 4))
    run(() => mix().undo())
    land()
    expect(eng.getControls().crtZoom).toBe(DEFAULT_CONTROLS.crtZoom)
  })

  it('lands the zoom of a preset that sets one', () => {
    const { eng, mix, run, land } = mount(1)
    const patch = patchOf('noseAgainstTheGlass')
    run(() => mix().applyPreset('noseAgainstTheGlass', patch))
    land()
    expect(eng.getControls().crtZoom).toBe(patch.crtZoom)
  })

  it('holds the zoom through a preset that does not set one', () => {
    const { eng, mix, run, land } = mount(1)
    run(() => eng.setControl('crtZoom', 4))
    run(() => mix().startMix())
    run(() => mix().applyPreset('bentDetailer', patchOf('bentDetailer')))
    expect(eng.getGlideTarget()?.crtZoom).toBe(4)
    land()
    expect(eng.getControls().crtZoom).toBe(4)
  })

  it('keeps a hand edit under a preset applied without a press', () => {
    const { eng, mix, run, land } = mount(0)
    run(() => eng.setControl('hDetuneHz', 7))
    run(() => mix().applyPreset('bentDetailer', patchOf('bentDetailer')))
    land()
    expect(eng.getControls().hDetuneHz).toBe(7)
  })

  it('stacks a second preset clicked while the first is still arriving', () => {
    const { eng, mix, run, land } = mount(4)
    const click = (name: string) => {
      run(() => mix().startMix())
      run(() => mix().applyPreset(name, patchOf(name)))
    }
    click('bentDetailer')
    run(() => eng.tick(1000))
    click('noseAgainstTheGlass')
    land()
    const both = new Map([
      ['bentDetailer', 1],
      ['noseAgainstTheGlass', 1],
    ])
    expect(eng.getControls()).toEqual(blendPresets(DEFAULT_CONTROLS, both))
    expect(mix().weights).toEqual(both)
  })
})

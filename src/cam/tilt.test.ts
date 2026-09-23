import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { lookBoard, SUBTLE } from './looks'
import { integrate, LEVEL, steered } from './tilt'

import type { Controls } from '../core/controls'

const camLoop: Controls = { ...DEFAULT_CONTROLS, fbMix: 0.8, fbZoom: 1.02 }
const mixLoop: Controls = { ...DEFAULT_CONTROLS, cfbMix: 0.9, cfbDelayUs: 0.35 }

describe('integrate', () => {
  it('adds up a turn', () => {
    let t = LEVEL
    for (let i = 0; i < 10; i++)
      t = integrate(t, { alpha: 30, beta: 0, gamma: 0 }, 0, 0.01)
    expect(t.roll).toBeCloseTo(3, 1)
  })

  it('settles back to level once the hand stops', () => {
    let t = { roll: 8, pitch: -5, yaw: 3 }
    for (let i = 0; i < 1200; i++)
      t = integrate(t, { alpha: 0, beta: 0, gamma: 0 }, 0, 1 / 60)
    expect(Math.abs(t.roll)).toBeLessThan(0.1)
    expect(Math.abs(t.pitch)).toBeLessThan(0.1)
    expect(Math.abs(t.yaw)).toBeLessThan(0.1)
  })

  // Landscape at 90: the device's y axis lies along the screen's horizontal.
  it('keeps pitch and yaw on the screen when the page turns', () => {
    const t = integrate(LEVEL, { alpha: 0, beta: 0, gamma: 10 }, 90, 1)
    expect(t.pitch).toBeCloseTo(-10)
    expect(t.yaw).toBeCloseTo(0)
  })
})

describe('steered', () => {
  it('leaves a level phone on the look as tuned', () => {
    expect(steered(camLoop, LEVEL, false)).toEqual({
      fbRotateDeg: 0,
      fbShiftX: 0,
      fbShiftY: 0,
    })
    expect(steered(mixLoop, LEVEL, false)).toEqual({ cfbDelayUs: 0.35 })
  })

  it('touches nothing on a look without a loop', () => {
    expect(
      steered(DEFAULT_CONTROLS, { roll: 20, pitch: 5, yaw: 5 }, false),
    ).toEqual({})
  })

  it('turns the camera loop against the hand', () => {
    const p = steered(camLoop, { roll: 5, pitch: 0, yaw: 0 }, false)
    expect(p.fbRotateDeg).toBeCloseTo(-0.5)
  })

  it('never steers past the subtle limits', () => {
    const hard = { roll: 90, pitch: 90, yaw: -90 }
    const p = steered(camLoop, hard, false)
    expect(Math.abs(p.fbRotateDeg ?? 0)).toBeLessThanOrEqual(SUBTLE.rotateDeg)
    expect(Math.abs(p.fbShiftX ?? 0)).toBeLessThanOrEqual(SUBTLE.shift)
    expect(Math.abs(p.fbShiftY ?? 0)).toBeLessThanOrEqual(SUBTLE.shift)
    const d = steered(mixLoop, hard, false).cfbDelayUs ?? 0
    expect(d).toBeLessThanOrEqual(SUBTLE.delayUs)
    const back = steered(mixLoop, { ...hard, roll: -90 }, false)
    expect(back.cfbDelayUs).toBe(0)
  })

  it('lands an aim across the screen down a turned raster', () => {
    const aim = { roll: 0, pitch: 0, yaw: 4 }
    const flat = steered(camLoop, aim, false)
    const turned = steered(camLoop, aim, true)
    expect(flat.fbShiftY).toBe(0)
    expect(turned.fbShiftX).toBe(0)
    expect(turned.fbShiftY).toBeCloseTo(-(flat.fbShiftX ?? 0))
  })

  it('steers every loop on the strip', () => {
    for (const name of ['zoomBloom', 'theLightIsALapBehind']) {
      const rest = lookBoard({ name, strength: 1, rolled: false }).controls
      const p = steered(rest, { roll: 5, pitch: 0, yaw: 0 }, false)
      expect(Object.keys(p).length, name).toBeGreaterThan(0)
    }
  })
})

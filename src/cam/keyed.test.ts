import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { coverFit43 } from '../core/gpu/sources'
import { aimKey, chromaHue, keyOn, keysOnHue, sourcePoint } from './keyed'
import { CLEAN, boardOf } from './scene'
import { cropRect } from './zoom'

import type { Scene } from './scene'

describe('chromaHue', () => {
  // The keyer's own reference points, from the comments beside its controls.
  it('puts the primaries where the encoder does', () => {
    expect(chromaHue(0, 1, 0)).toBeCloseTo(240.7, 0)
    expect(chromaHue(1, 0, 0)).toBeCloseTo(103.4, 0)
  })

  it('puts skin on the I axis', () => {
    const hue = chromaHue(0.87, 0.67, 0.53) ?? 0
    expect(Math.abs(hue - 123)).toBeLessThan(6)
  })

  it('has no hue for grey', () => {
    expect(chromaHue(0.5, 0.5, 0.5)).toBeNull()
  })
})

describe('aimKey', () => {
  const keyed = {
    ...DEFAULT_CONTROLS,
    cfbMix: 0.9,
    cfbKey: 1,
    cfbKeyAcceptDeg: 40,
    cfbKeyHueDeg: 103,
  }

  it('re-aims a hue keyer', () => {
    expect(keysOnHue(keyed)).toBe(true)
    expect(aimKey(keyed, 240.6).cfbKeyHueDeg).toBe(241)
  })

  it('leaves a luma keyer and a look with no loop alone', () => {
    const luma = { ...keyed, cfbKeyAcceptDeg: 0 }
    expect(aimKey(luma, 200)).toBe(luma)
    expect(aimKey(DEFAULT_CONTROLS, 200)).toBe(DEFAULT_CONTROLS)
  })
})

describe('keyOn', () => {
  it('keys B on the hue and fills from the loop bus', () => {
    const c = keyOn(DEFAULT_CONTROLS, {}, 123.4)
    expect(c).toMatchObject({
      bGain: 1,
      bGenlock: 1,
      bKey: 1,
      bKeyHueDeg: 123,
      bKeyFill: 2,
      bKeyFillMixA: 0.15,
    })
  })

  it('holds strobe hold odd, where the fade keeps the colour', () => {
    expect(keyOn(DEFAULT_CONTROLS, {}, 0).cfbHold % 2).toBe(1)
  })

  it('lets a knob turned by hand win over its settings', () => {
    const c = keyOn(DEFAULT_CONTROLS, { bKeyAcceptDeg: 20, cfbHold: 5 }, 0)
    expect(c.bKeyAcceptDeg).toBe(20)
    expect(c.cfbHold).toBe(5)
  })

  it('holds the switches that make the mixer a keyer', () => {
    const c = keyOn(
      DEFAULT_CONTROLS,
      { bGain: 0.3, bKey: 0, pipMix: 1, bKeyHueDeg: 10 },
      200,
    )
    expect(c).toMatchObject({ bGain: 1, bKey: 1, pipMix: 0, bKeyHueDeg: 200 })
  })
})

describe('a scene with the keyer on', () => {
  const scene: Scene = {
    ...CLEAN,
    look: null,
    mix: { mode: 'wipe', fader: 0.3 },
    keyHue: 241,
  }

  it('sets the mixer over whatever mode it was in', () => {
    const c = boardOf(scene, 1).controls
    expect(c).toMatchObject({ bKey: 1, bGain: 1, wipeMode: 0, bKeyHueDeg: 241 })
  })

  it('leaves the mixer to its mode once off', () => {
    const c = boardOf({ ...scene, keyHue: null }, 1).controls
    expect(c).toMatchObject({ bKey: 0, wipeMode: 1 })
  })
})

describe('sourcePoint', () => {
  const frame = { width: 400, height: 300 }

  it('crops the long side of a wider camera', () => {
    const p = sourcePoint({ x: 0, y: 0.5 }, frame, {
      width: 1600,
      height: 900,
      mirror: false,
    })
    expect(p.x).toBeCloseTo(0.5 - 0.5 * (4 / 3 / (16 / 9)))
    expect(p.y).toBe(0.5)
  })

  it('pulls a point toward the middle of a cropped camera', () => {
    const p = sourcePoint({ x: 0, y: 1 }, frame, {
      width: 640,
      height: 480,
      mirror: false,
      crop: 2,
    })
    expect(p.x).toBeCloseTo(0.25)
    expect(p.y).toBeCloseTo(0.75)
  })

  it('reads a mirrored camera from the other side', () => {
    const p = sourcePoint({ x: 0.2, y: 0.3 }, frame, {
      width: 640,
      height: 480,
      mirror: true,
    })
    expect(p.x).toBeCloseTo(0.8)
    expect(p.y).toBeCloseTo(0.3)
  })

  it('maps a tall camera on a turned set straight through', () => {
    const p = sourcePoint(
      { x: 0.25, y: 0.75 },
      { width: 300, height: 400 },
      { width: 480, height: 640, mirror: false },
    )
    expect(p.x).toBeCloseTo(0.25)
    expect(p.y).toBeCloseTo(0.75)
  })
})

// Where a point on the camera's frame shows on the picture when the relay puts
// that camera on B: the relay draws the zoom's crop of the frame across its
// whole canvas, and the engine cover-fits the canvas into the 4:3 raster.
function onB(
  p: { x: number; y: number },
  cam: { width: number; height: number; crop: number },
) {
  const { width: w, height: h } = cam
  const [sx, sy, sw, sh] = cropRect(w, h, cam.crop)
  const cx = ((p.x * w - sx) / sw) * w
  const cy = ((p.y * h - sy) / sh) * h
  const [fx, fy, fw, fh] = coverFit43(w, h)
  return { x: (cx - fx) / fw, y: (cy - fy) / fh }
}

describe('a tap on a zoomed colour key', () => {
  const view = { width: 400, height: 300 }

  it('reads the camera where B shows it', () => {
    for (const [width, height] of [
      [640, 480],
      [1280, 720],
    ] as const)
      for (const crop of [1, 1.5, 3])
        for (const at of [
          { x: 0.1, y: 0.2 },
          { x: 0.5, y: 0.5 },
          { x: 0.9, y: 0.7 },
        ]) {
          const p = sourcePoint(at, view, {
            width,
            height,
            mirror: false,
            crop,
          })
          const shown = onB(p, { width, height, crop })
          expect(shown.x).toBeCloseTo(at.x)
          expect(shown.y).toBeCloseTo(at.y)
        }
  })
})

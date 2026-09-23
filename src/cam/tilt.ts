import { SUBTLE } from './looks'

import type { Controls } from '../core/controls'

// How far the phone has turned lately, in degrees about the screen's own axes:
// `roll` about the axis out of the glass, anticlockwise as the holder sees it,
// `pitch` about the screen's horizontal with the top edge tipping towards the
// holder, and `yaw` about its vertical with the right edge going away.
export interface Tilt {
  roll: number
  pitch: number
  yaw: number
}

export const LEVEL: Tilt = { roll: 0, pitch: 0, yaw: 0 }

// How long a turn is held before it fades back to level. A hand shifting its
// grip should not leave the loop turned for good, and a hand that stays still
// hands the look back as it was tuned.
const SETTLE_S = 4

// A turn of ten degrees takes a loop to the edge of subtle.
const ROTATE_PER_DEG = SUBTLE.rotateDeg / 10
const SHIFT_PER_DEG = SUBTLE.shift / 10
const DELAY_US_PER_DEG = 0.015

// The gyro's rates (deg/s about the device's own x, y and z axes) folded into a
// Tilt that leaks back to level. `angle` is the screen's rotation against the
// device, as `screen.orientation.angle` gives it, so pitch and yaw stay on the
// screen's axes when the page turns to landscape.
export function integrate(
  t: Tilt,
  rate: { alpha: number; beta: number; gamma: number },
  angle: number,
  dt: number,
): Tilt {
  const a = (angle * Math.PI) / 180
  const keep = Math.exp(-dt / SETTLE_S)
  return {
    roll: t.roll * keep + rate.alpha * dt,
    pitch:
      t.pitch * keep +
      (rate.beta * Math.cos(a) - rate.gamma * Math.sin(a)) * dt,
    yaw:
      t.yaw * keep + (rate.beta * Math.sin(a) + rate.gamma * Math.cos(a)) * dt,
  }
}

const around = (rest: number, off: number, lim: number) =>
  Math.min(Math.max(rest + off, Math.min(rest, -lim)), Math.max(rest, lim))

// The phone is the feedback camera. Turning a camera aimed at a monitor about
// its lens turns the loop the other way, and aiming it off-centre moves where
// each lap lands, so a hand steers the loop the way it steers a feedback rig. A
// mixer loop has no camera, and roll trims its delay instead, which slides the
// echoes and turns their hue. No steer takes a loop past the subtle limits,
// unless the look itself already sits past them.
//
// A set on its side has its raster turned against the screen, so an aim across
// the screen lands down the raster.
export function steered(
  rest: Controls,
  t: Tilt,
  turned: boolean,
): Partial<Controls> {
  const patch: Partial<Controls> = {}
  if (rest.fbMix > 0) {
    const sx = -t.yaw * SHIFT_PER_DEG
    const sy = -t.pitch * SHIFT_PER_DEG
    const [dx, dy] = turned ? [sy, -sx] : [sx, sy]
    patch.fbRotateDeg = around(
      rest.fbRotateDeg,
      -t.roll * ROTATE_PER_DEG,
      SUBTLE.rotateDeg,
    )
    patch.fbShiftX = around(rest.fbShiftX, dx, SUBTLE.shift)
    patch.fbShiftY = around(rest.fbShiftY, dy, SUBTLE.shift)
  }
  if (rest.cfbMix > 0) {
    patch.cfbDelayUs = Math.min(
      Math.max(rest.cfbDelayUs + t.roll * DELAY_US_PER_DEG, 0),
      Math.max(rest.cfbDelayUs, SUBTLE.delayUs),
    )
  }
  return patch
}

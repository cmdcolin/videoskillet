import type { Controls } from '../core/controls'

// How far a loop may move the picture each lap and still count as subtle: a
// camera within 4.5% of unity zoom, turning at most a degree and shifting at
// most 2% of the frame, or a mixer loop at most 1.2 us and four lines late
// whose delay the video does not pull far. Feedback looks best on a camera
// with that little movement per lap. Big zooms, spins and delays read as
// cheesy.
//
// A subtle loop cannot be made out of a dramatic one by scaling its geometry
// down. The preset's gain is tuned to how far its geometry spreads each lap,
// and at a quarter of the zoom and turn the same gain stacks the picture onto
// itself and walls out to white.
export const SUBTLE = {
  zoom: 0.045,
  rotateDeg: 1,
  shift: 0.02,
  delayUs: 1.2,
  lines: 4,
  servoUs: 5,
}

export function subtleLoop(c: Controls): boolean {
  const camera =
    c.fbMix === 0 ||
    (Math.abs(c.fbZoom - 1) <= SUBTLE.zoom &&
      Math.abs(c.fbRotateDeg) <= SUBTLE.rotateDeg &&
      Math.abs(c.fbShiftX) <= SUBTLE.shift &&
      Math.abs(c.fbShiftY) <= SUBTLE.shift)
  const mixer =
    c.cfbMix === 0 ||
    (c.cfbDelayUs <= SUBTLE.delayUs &&
      Math.abs(c.cfbLines) <= SUBTLE.lines &&
      Math.abs(c.cfbServoUs) <= SUBTLE.servoUs)
  return camera && mixer
}

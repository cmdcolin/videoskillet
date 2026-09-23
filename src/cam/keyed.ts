import type { Controls } from '../core/controls'

// The hue the encoder gives an RGB colour, in degrees: the angle of its (U, V)
// chroma, atan2(V, U), which is the angle the loop's hue keyer slices. Null
// for a colour too close to grey to have a hue worth keying on.
export function chromaHue(r: number, g: number, b: number): number | null {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const u = 0.492 * (b - y)
  const v = 0.877 * (r - y)
  if (Math.hypot(u, v) < 0.035) return null
  return ((Math.atan2(v, u) * 180) / Math.PI + 360) % 360
}

// Whether the look's mixer loop keys on hue, which is what a tap can re-aim.
export const keysOnHue = (c: Controls): boolean =>
  c.cfbMix > 0 && c.cfbKey !== 0 && c.cfbKeyAcceptDeg > 0

export const aimKey = (c: Controls, hue: number | null): Controls =>
  hue === null || !keysOnHue(c) ? c : { ...c, cfbKeyHueDeg: Math.round(hue) }

// Where a point on the picture lands on the camera's own frame, both in 0..1.
// The picture is the camera cover-fitted into the frame, so the long side is
// cropped, and a camera facing its subject is shown mirrored. A set on its
// side needs no case of its own: turning the tube and the camera together
// leaves the picture upright in the camera's own axes.
export function sourcePoint(
  at: { x: number; y: number },
  view: { width: number; height: number },
  src: { width: number; height: number; mirror: boolean },
): { x: number; y: number } {
  const va = view.width / view.height
  const sa = src.width / src.height
  let { x, y } = at
  if (sa > va) x = 0.5 + (x - 0.5) * (va / sa)
  else y = 0.5 + (y - 0.5) * (sa / va)
  return { x: src.mirror ? 1 - x : x, y }
}

// The camera's colour at a point, averaged over a few pixels so one noisy
// photosite does not decide it, as 0..1 RGB.
export function colourAt(
  video: HTMLVideoElement,
  p: { x: number; y: number },
): [number, number, number] | null {
  const n = 7
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const g = c.getContext('2d', { willReadFrequently: true })
  if (g === null || video.videoWidth === 0) return null
  const sx = Math.min(
    Math.max(p.x * video.videoWidth - n / 2, 0),
    video.videoWidth - n,
  )
  const sy = Math.min(
    Math.max(p.y * video.videoHeight - n / 2, 0),
    video.videoHeight - n,
  )
  g.drawImage(video, sx, sy, n, n, 0, 0, n, n)
  const d = g.getImageData(0, 0, n, n).data
  let r = 0
  let gr = 0
  let b = 0
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]
    gr += d[i + 1]
    b += d[i + 2]
  }
  const k = 255 * n * n
  return [r / k, gr / k, b / k]
}

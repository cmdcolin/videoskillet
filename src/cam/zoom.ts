// The camera's zoom, split between its own lens and a crop of A. A phone whose
// browser exposes the camera's zoom gets its real lenses, the ultrawide below
// 1× included, and the crop takes over only past the lens's longest reach. A
// browser that exposes none gets the crop alone, from 1×.

export interface Span {
  min: number
  max: number
}

// How far the page zooms in, lens and crop together, when the lens stops short
// of it. The raster is a few hundred samples across, so a crop this deep still
// feeds it more than it resolves.
export const CROP_MAX = 4

const isSpan = (v: unknown): v is Span =>
  typeof v === 'object' &&
  v !== null &&
  'min' in v &&
  'max' in v &&
  typeof v.min === 'number' &&
  typeof v.max === 'number'

// The camera's own zoom range, where the track reports one. DOM's types do not
// list `zoom` among a track's capabilities yet.
export function lensSpan(track: MediaStreamTrack | null): Span | null {
  if (track === null || typeof track.getCapabilities !== 'function') return null
  const z: unknown = Reflect.get(track.getCapabilities(), 'zoom')
  return isSpan(z) && z.max > z.min ? { min: z.min, max: z.max } : null
}

export const zoomSpan = (lens: Span | null): Span => ({
  min: Math.min(1, lens?.min ?? 1),
  max: Math.max(lens?.max ?? 1, CROP_MAX),
})

const clamp = (v: number, s: Span) => Math.min(s.max, Math.max(s.min, v))

// How much of `zoom` the lens gives and how much the crop makes up.
export function zoomSplit(
  zoom: number,
  lens: Span | null,
): { lens: number; crop: number } {
  const optical = lens === null ? 1 : clamp(zoom, lens)
  return { lens: optical, crop: Math.max(1, zoom / optical) }
}

// The stops a phone camera offers as buttons: its ultrawide where it has one,
// 1× and 2×.
export const zoomStops = (lens: Span | null): number[] =>
  lens !== null && lens.min < 1 ? [lens.min, 1, 2] : [1, 2]

// The stop a zoom belongs to: the longest one it has reached.
export function stopAt(zoom: number, stops: readonly number[]): number {
  let at = stops[0]
  for (const s of stops) if (zoom >= s - 0.01) at = s
  return at
}

export const zoomLabel = (z: number): string => String(Number(z.toFixed(1)))

import { useRef, useState } from 'react'

import { lensSpan, zoomSpan, zoomSplit, zoomStops } from './zoom'

import type { Lens, Span } from './zoom'

export const trackOf = (video: HTMLVideoElement | undefined) =>
  video?.srcObject instanceof MediaStream
    ? (video.srcObject.getVideoTracks()[0] ?? null)
    : null

// The zoom of the camera on A. `track` is that camera's track, `crop` the
// engine's crop of A, and `onLens` hears the lens settle after a zoom. A pinch
// asks for a new zoom every frame, and a camera takes a while to answer each
// one, so only the latest ask waits its turn, and it goes to whichever camera
// is on A when its turn comes.
export function useZoom(
  track: () => Lens | null,
  crop: (zoom: number) => void,
  onLens: () => void,
) {
  const [zoom, setZoom] = useState(1)
  const [lens, setLens] = useState<Span | null>(null)
  const lensRef = useRef<Span | null>(null)
  const pending = useRef<number | null>(null)
  const busy = useRef(false)

  const drive = async () => {
    busy.current = true
    while (pending.current !== null) {
      const z = pending.current
      const t = track()
      pending.current = null
      if (t !== null) {
        try {
          // Set by name: DOM's constraint types do not list `zoom` yet.
          const set: MediaTrackConstraintSet = {}
          Reflect.set(set, 'zoom', z)
          await t.applyConstraints({ advanced: [set] })
        } catch {
          // A camera that turns down a zoom it listed keeps the one it has.
        }
      }
    }
    busy.current = false
    onLens()
  }

  const set = (z: number) => {
    const span = zoomSpan(lensRef.current)
    const next = Math.min(span.max, Math.max(span.min, z))
    const split = zoomSplit(next, lensRef.current)
    setZoom(next)
    crop(split.crop)
    if (lensRef.current !== null && track() !== null) {
      pending.current = split.lens
      if (!busy.current) void drive()
    }
  }

  // A camera coming on screen starts at 1×, with whatever lens it has. A zoom
  // still waiting was asked of the camera before it.
  const reset = () => {
    pending.current = null
    const found = lensSpan(track())
    lensRef.current = found
    setLens(found)
    setZoom(1)
    crop(1)
  }

  return {
    zoom,
    stops: zoomStops(lens),
    set,
    reset,
  }
}

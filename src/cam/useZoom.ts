import { useRef, useState } from 'react'

import { lensSpan, zoomSpan, zoomSplit, zoomStops } from './zoom'

import type { Span } from './zoom'

export const trackOf = (video: HTMLVideoElement | undefined) =>
  video?.srcObject instanceof MediaStream
    ? (video.srcObject.getVideoTracks()[0] ?? null)
    : null

// The zoom of the camera on A. `track` is that camera's track and `crop` the
// engine's crop of A. A pinch asks for a new zoom every frame, and a camera
// takes a while to answer each one, so only the latest ask waits its turn.
export function useZoom(
  track: () => MediaStreamTrack | null,
  crop: (zoom: number) => void,
) {
  const [zoom, setZoom] = useState(1)
  const [lens, setLens] = useState<Span | null>(null)
  const lensRef = useRef<Span | null>(null)
  const pending = useRef<number | null>(null)
  const busy = useRef(false)

  const drive = async (t: MediaStreamTrack) => {
    busy.current = true
    while (pending.current !== null) {
      const z = pending.current
      pending.current = null
      try {
        // Set by name: DOM's constraint types do not list `zoom` yet.
        const set: MediaTrackConstraintSet = {}
        Reflect.set(set, 'zoom', z)
        await t.applyConstraints({ advanced: [set] })
      } catch {
        // A camera that turns down a zoom it listed keeps the one it has.
      }
    }
    busy.current = false
  }

  const set = (z: number) => {
    const span = zoomSpan(lensRef.current)
    const next = Math.min(span.max, Math.max(span.min, z))
    const split = zoomSplit(next, lensRef.current)
    setZoom(next)
    crop(split.crop)
    const t = track()
    if (lensRef.current === null || t === null) return
    pending.current = split.lens
    if (!busy.current) void drive(t)
  }

  // A camera coming on screen starts at 1×, with whatever lens it has.
  const reset = () => {
    const found = lensSpan(track())
    lensRef.current = found
    setLens(found)
    setZoom(1)
    crop(1)
  }

  return {
    zoom,
    crop: zoomSplit(zoom, lens).crop,
    stops: zoomStops(lens),
    set,
    reset,
  }
}

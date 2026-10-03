import { useRef, useState } from 'react'

import { chromaHue, colourAt, sourcePoint } from './keyed'

import type { Camera } from './tape'
import type { PointerEvent } from 'react'

interface Ring {
  x: number
  y: number
  rgb: string
}

// A tap on a look that keys its loop by hue moves the key to the camera's
// colour under the finger, and a ring shows the colour it took.
export function useKeyTap(opts: {
  camera: () => Camera | null
  crop: number
  keyed: () => boolean
  onAim: (hue: number) => void
  onMiss: (text: string) => void
}) {
  const [ring, setRing] = useState<Ring | null>(null)
  const timer = useRef(0)

  const tap = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = opts.camera()
    if (c === null || !opts.keyed()) return
    const rect = e.currentTarget.getBoundingClientRect()
    const at = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
    const rgb = colourAt(
      c.video,
      sourcePoint(at, rect, {
        width: c.video.videoWidth,
        height: c.video.videoHeight,
        mirror: c.mirror,
        crop: opts.crop,
      }),
    )
    if (rgb === null) return
    const hue = chromaHue(...rgb)
    if (hue === null) {
      opts.onMiss('no colour there to key on')
      return
    }
    opts.onAim(hue)
    setRing({
      ...at,
      rgb: `rgb(${rgb.map(v => Math.round(v * 255)).join(' ')})`,
    })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setRing(null), 800)
  }

  return { ring, tap }
}

import { useFlash } from '../ui/useFlash'
import { backingOf, chromaHue, colourAt, sourcePoint } from './keyed'

import type { HueSlice } from '../ui/hueKey'
import type { Backing } from './keyed'
import type { Camera } from './tape'
import type { PointerEvent } from 'react'

interface Ring {
  x: number
  y: number
  rgb: string
}

// A tap on a look that keys its loop by hue moves the key to the camera's
// colour under the finger, and a ring shows the colour it took. The colour is
// measured as a backing too, for the additive keyer on B.
export function useKeyTap(opts: {
  camera: () => Camera | null
  keyed: () => boolean
  slice: () => HueSlice
  onAim: (hue: number, backing: Backing) => void
  onMiss: (text: string) => void
}) {
  const { shown: ring, flash: showRing } = useFlash<Ring>(800)

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
        crop: c.crop,
      }),
    )
    if (rgb === null) return
    const hue = chromaHue(...rgb, opts.slice())
    if (hue === null) {
      opts.onMiss('no colour there to key on')
      return
    }
    opts.onAim(hue, backingOf(...rgb))
    showRing({
      ...at,
      rgb: `rgb(${rgb.map(v => Math.round(v * 255)).join(' ')})`,
    })
  }

  return { ring, tap }
}

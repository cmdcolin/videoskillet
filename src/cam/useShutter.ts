import { useEffect, useState } from 'react'

import { useCapture } from '../ui/useCapture'

import type { InputTap } from '../core/signal/audiostate'
import type { Shot } from './deliver'
import type { Failure } from './failure'
import type { Mode } from './Modes'
import type { RefObject } from 'react'

// The shutter: a still or a take of the canvas, the last one held as a shot.
export function useShutter(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  name: string,
  onError: (failure: Failure | null) => void,
  audio: () => InputTap | null,
) {
  const [mode, setMode] = useState<Mode>('photo')
  const [shot, setShot] = useState<Shot | null>(null)
  const [recSince, setRecSince] = useState(0)

  const capture = useCapture(
    canvasRef,
    name,
    message => onError({ during: 'shutter', error: message }),
    (blob, file) =>
      setShot({
        blob,
        name: file,
        url: URL.createObjectURL(blob),
        video: blob.type.startsWith('video/'),
      }),
    // 30fps, which is what a phone's own camera records, and half the
    // encoding a phone's encoder has to keep up with.
    { clock: true, fps: { num: 30, den: 1 }, audio },
  )

  useEffect(() => {
    if (shot === null) return undefined
    const url = shot.url
    return () => URL.revokeObjectURL(url)
  }, [shot])

  const press = () => {
    onError(null)
    if (mode === 'photo') {
      capture.grabStill()
    } else {
      if (!capture.recording) setRecSince(performance.now())
      capture.toggleRecord()
    }
  }

  return {
    mode,
    setMode,
    shot,
    recSince,
    recording: capture.recording,
    press,
  }
}

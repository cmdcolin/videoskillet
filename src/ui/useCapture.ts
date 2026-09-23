import { useEffect, useRef, useState } from 'react'

import { fileName, save } from './download'
import { isSupported, startRecording } from './record'

import type { Recorder } from './record'
import type { RefObject } from 'react'

// The rate the file is written at, and it is the simulation's own: the signal
// path is a fixed-timestep 60Hz sim (`signal/modstate.ts` is `const DT = 1/60`,
// and the artifacts clock off the frame counter), so any other number would be
// a file whose timing disagrees with what produced it.
const FPS = { num: 60, den: 1 }

// The sizes a profile's still is tried at, largest first. 5:4, which is what the
// home page's cards are. A card shows its still about 320px wide, and a picture
// busy enough that the larger encode passes the cap gets the smaller one.
const THUMB_SIZES = [
  [320, 256],
  [160, 128],
] as const

// A still still needs the 2D mirror, and that is not an oversight: `toBlob` on
// a WebGPU canvas comes back blank in Firefox because the presented drawing
// buffer is not retained for async readback, while `drawImage` out of it
// synchronously does work. The *recording* path no longer needs the mirror —
// `new VideoFrame(canvas)` reads the WebGPU canvas directly (see record.ts) —
// which is the copy per frame this used to cost.
function mirrorOf(src: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = src.width
  canvas.height = src.height
  canvas.getContext('2d')?.drawImage(src, 0, 0)
  return canvas
}

// Save the rendered canvas as a PNG still or a constant-framerate MP4.
// Downstream of `present` — the same pixels the user sees — so nothing touches
// the signal path. Recording holds the window visible (rAF at full rate) by
// design.
//
// `deliver` takes each finished file. It downloads by default; the camera page
// keeps the file instead, because a phone saves to its photo library through
// the share sheet.
//
// `clock` paces the take by the wall clock instead of by rendered frames,
// repeating or dropping frames so a second of take is a second of file. A
// camera is live, so a 120 Hz phone would otherwise write slow motion and one
// held to 30 Hz double speed.
export function useCapture(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  name: string,
  onError: (message: string) => void,
  deliver: (blob: Blob, name: string) => void = save,
  opts: { clock?: boolean } = {},
) {
  const recRef = useRef<Recorder | null>(null)
  const rafRef = useRef(0)
  const [recording, setRecording] = useState(false)

  // The encoder and its rAF pump are browser objects that outlive React, so a
  // teardown mid-recording would leave both running forever. Aborted rather
  // than finished, unlike the `MediaRecorder` this replaces: that one could
  // flush a clip to disk on the way out, and a download started from an
  // unmounting tree is not a thing that reliably lands.
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      recRef.current?.abort()
      recRef.current = null
    },
    [],
  )

  const grabStill = () => {
    const canvas = canvasRef.current
    if (canvas !== null) {
      // Drawn inside a frame: Chrome only keeps the WebGPU drawing buffer
      // readable during a paint, so a synchronous drawImage from the event
      // handler copies a blank buffer.
      requestAnimationFrame(() => {
        mirrorOf(canvas).toBlob(blob => {
          if (blob !== null) deliver(blob, fileName(name, 'png'))
        }, 'image/png')
      })
    }
  }

  // A profile's still, as base64 webp with the `data:` prefix taken off — what
  // putStill writes under the profile's id. Null when there is no canvas yet,
  // the browser declined to encode, or no size fits under `max` characters.
  //
  // It scales straight out of the WebGPU canvas into a small 2D canvas, which
  // is the same drawImage `mirrorOf` relies on and works for the same reason.
  // Inside a frame, as grabStill is, because Chrome only keeps the drawing
  // buffer readable during a paint.
  const grabThumb = (max: number): Promise<string | null> =>
    new Promise(resolve => {
      const canvas = canvasRef.current
      if (canvas === null) {
        resolve(null)
        return
      }
      requestAnimationFrame(() => {
        for (const [w, h] of THUMB_SIZES) {
          const thumb = document.createElement('canvas')
          thumb.width = w
          thumb.height = h
          const ctx = thumb.getContext('2d')
          if (ctx === null) break
          ctx.drawImage(canvas, 0, 0, w, h)
          const url = thumb.toDataURL('image/webp', 0.7)
          const webp = url.slice(url.indexOf(',') + 1)
          if (webp !== '' && webp.length <= max) {
            resolve(webp)
            return
          }
        }
        resolve(null)
      })
    })

  const stop = async () => {
    const rec = recRef.current
    cancelAnimationFrame(rafRef.current)
    recRef.current = null
    setRecording(false)
    if (rec === null) return
    try {
      deliver(await rec.finish(), fileName(name, 'mp4'))
    } catch (e) {
      onError(`recording failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const toggleRecord = () => {
    if (recRef.current !== null) {
      void stop()
      return
    }
    const canvas = canvasRef.current
    if (canvas === null) return
    if (!isSupported()) {
      onError('this browser cannot encode video (WebCodecs is missing)')
      return
    }
    // The size is fixed for the whole recording, unlike the stream this
    // replaces, which tracked the canvas and changed resolution mid-clip when
    // somebody went fullscreen. An encoder is configured once with a frame
    // size, and a file whose resolution changes halfway is one an editor has to
    // be told about — so going fullscreen now scales into the size the
    // recording started at, which is the behaviour a take actually wants.
    const width = canvas.width
    const height = canvas.height
    startRecording({ width, height, fps: FPS }).then(
      rec => {
        recRef.current = rec
        setRecording(true)
        const start = performance.now()
        const pump = () => {
          rafRef.current = requestAnimationFrame(pump)
          const live = canvasRef.current
          const r = recRef.current
          if (live === null || r === null) return
          if (opts.clock === true) {
            const due =
              Math.floor(
                ((performance.now() - start) / 1000) * (FPS.num / FPS.den),
              ) + 1
            while (r.frames() < due) r.frame(live)
          } else {
            // One frame per rAF, and the timestamp comes off the count rather
            // than the clock (record.ts). A slow frame therefore stretches the
            // take in real time and not in the file, which is the trade this
            // whole path exists to make.
            r.frame(live)
          }
        }
        rafRef.current = requestAnimationFrame(pump)
      },
      (e: unknown) => {
        onError(
          `could not start recording: ${e instanceof Error ? e.message : String(e)}`,
        )
      },
    )
  }

  return { recording, toggleRecord, grabStill, grabThumb }
}

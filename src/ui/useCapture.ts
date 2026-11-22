import { useEffect, useRef, useState } from 'react'

import { heldAdapter } from '../core/gpu/context'
import { fileName, save } from './download'
import { isSupported, startRecording } from './record'
import {
  clearTake,
  noteTake,
  reportLostTake,
  reportTakeFailed,
  reportTakeRescued,
  reportTakeRetried,
  takeLive,
} from './takeLog'
import { sweepTakes } from './takeSink'

import type { FrameStats } from '../core/controls'
import type { FrameSink } from '../core/gpu/frameread'
import type { RenderHealth } from '../core/gpu/renderloop'
import type { InputTap } from '../core/signal/audiostate'
import type { Recorder } from './record'
import type { TakeNote } from './takeLog'
import type { RefObject } from 'react'

// The rate the file is written at, and it is the simulation's own: the signal
// path is a fixed-timestep 60Hz sim (`signal/modstate.ts` is `const DT = 1/60`,
// and the artifacts clock off the frame counter), so any other number would be
// a file whose timing disagrees with what produced it.
const FPS = { num: 60, den: 1 }

// What a live take needs of the engine: its rendered frames, how many it has
// rendered, and how its render loop is doing.
interface FrameSource {
  setFrameSink: (
    sink: FrameSink | null,
    size: { width: number; height: number },
  ) => void
  frameNo: () => number
  getStats: () => FrameStats
  renderHealth: () => RenderHealth
}

// How long a live take waits for a frame off the engine before it reads the
// canvas instead. The engine's first frame lands a frame or two after the
// take starts, and a take that has none by now is one the engine is not
// feeding: none attached yet, a copy the browser refuses, or a GPU that has
// stopped. Reading the canvas costs the page frames, which is better than a
// file with nothing in it.
const ENGINE_GRACE_MS = 1000

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

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Attach a take to an engine, and say why if that threw. Outside the hook for
// the same reason `letGo` is.
function hand(
  source: FrameSource,
  sink: FrameSink,
  size: { width: number; height: number },
) {
  let failure = ''
  try {
    source.setFrameSink(sink, size)
  } catch (e) {
    failure = messageOf(e)
  }
  return failure
}

// Outside the hook because React Compiler cannot optimise a try/catch holding
// an optional call, and gives up on the whole hook when it meets one.
function letGo(
  source: FrameSource | null,
  size: { width: number; height: number },
) {
  if (source === null) return
  // An engine replaced for a lost device may not answer any more.
  try {
    source.setFrameSink(null, size)
  } catch {
    // Nothing to let go of.
  }
}

const jot = (ref: RefObject<TakeNote | null>, patch: Partial<TakeNote>) => {
  if (ref.current === null) return
  ref.current = { ...ref.current, ...patch }
  noteTake(ref.current)
}

const endNote = (ref: RefObject<TakeNote | null>) => {
  if (ref.current === null) return
  ref.current = null
  clearTake()
}

// Save the rendered canvas as a PNG still or an MP4.
// Downstream of `present` — the same pixels the user sees — so nothing touches
// the signal path. Recording holds the window visible (rAF at full rate) by
// design.
//
// `engine` makes the take live: the engine copies each frame it renders off the
// GPU without blocking the page, and the recorder places it by when it was
// rendered, on the sound's clock when `audio` has a tap and the wall clock when
// not. A second of take is a second of file, frames held across any period the
// engine or the encoder missed. `channels` is the sound's, mono by default.
//
// `deliver` takes each finished file. It downloads by default; the camera page
// keeps the file instead, because a phone saves to its photo library through
// the share sheet.
//
// `clock` paces the take by the wall clock instead of by rendered frames,
// repeating or dropping frames so a second of take is a second of file. A
// camera is live, so a 120 Hz phone would otherwise write slow motion and one
// held to 30 Hz double speed, and sound from `audio` would drift off the
// picture. A clocked take holds a frame where the encoder has fallen behind,
// and its file is then not quite constant-framerate.
//
// `fps` overrides the sim's rate, which only makes sense for a clocked take.
export function useCapture(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  name: string,
  onError: (message: string) => void,
  deliver: (blob: Blob, name: string) => void = save,
  opts: {
    clock?: boolean
    fps?: { num: number; den: number }
    audio?: () => InputTap | null
    channels?: 1 | 2
    engine?: () => FrameSource | null
  } = {},
) {
  const fps = opts.fps ?? FPS
  const recRef = useRef<Recorder | null>(null)
  // A take between the click and its recorder, which a second toggle or an
  // unmount calls off.
  const startingRef = useRef<{ off: boolean } | null>(null)
  const rafRef = useRef(0)
  const noteRef = useRef<TakeNote | null>(null)
  // How a live take's frames are reaching it, for the take's note.
  const feedRef = useRef<() => Partial<TakeNote>>(() => ({}))
  const startRef = useRef(0)
  // The engine a live take is attached to, and how to let it go.
  const detachRef = useRef<(() => void) | null>(null)
  const [recording, setRecording] = useState(false)

  const detach = () => {
    detachRef.current?.()
    detachRef.current = null
  }

  const progress = (r: Recorder) => {
    const fallback = r.fallback()
    return {
      seconds: Math.round((performance.now() - startRef.current) / 1000),
      frames: r.frames(),
      held: r.held(),
      deepest: r.deepest(),
      encoded: r.encoded(),
      chunks: r.chunks(),
      bytes: r.bytes(),
      streamed: r.streamed(),
      coded: r.coded(),
      configs: r.configs(),
      canvas:
        canvasRef.current === null
          ? ''
          : `${canvasRef.current.width}x${canvasRef.current.height}`,
      ...(r.errorName() === '' ? {} : { error: r.errorName() }),
      ...(fallback === null ? {} : { fallback: fallback.step }),
      ...feedRef.current(),
    }
  }

  // The encoder and its rAF pump are browser objects that outlive React, so a
  // teardown mid-recording would leave both running forever. Aborted rather
  // than finished, unlike the `MediaRecorder` this replaces: that one could
  // flush a clip to disk on the way out, and a download started from an
  // unmounting tree is not a thing that reliably lands.
  //
  // A take still noted when the page goes away normally was not lost, so the
  // note goes with it.
  useEffect(() => {
    reportLostTake()
    // A take streamed to a file leaves that file behind, because nothing tells
    // the page when the download has finished reading it. Whatever an earlier
    // page left is this one's to clear, once no tab is recording.
    void takeLive().then(live => (live ? 0 : sweepTakes()))
    const onHide = () => {
      if (document.visibilityState === 'hidden') jot(noteRef, { hidden: true })
    }
    const onLeave = () => endNote(noteRef)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onLeave)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onLeave)
      cancelAnimationFrame(rafRef.current)
      if (startingRef.current !== null) startingRef.current.off = true
      startingRef.current = null
      detachRef.current?.()
      detachRef.current = null
      recRef.current?.abort()
      recRef.current = null
      endNote(noteRef)
    }
  }, [])

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
    detach()
    recRef.current = null
    setRecording(false)
    if (rec === null) return
    jot(noteRef, { stage: 'finishing', ...progress(rec) })
    let failure = ''
    try {
      deliver(await rec.finish(), fileName(name, 'mp4'))
    } catch (e) {
      failure = messageOf(e)
    }
    if (failure === '') {
      const fallback = rec.fallback()
      if (fallback !== null && noteRef.current !== null)
        reportTakeRetried(
          { ...noteRef.current, ...progress(rec) },
          fallback.error,
        )
    } else {
      reportTakeFailed(failure, noteRef.current)
      onError(`recording failed: ${failure}`)
    }
    endNote(noteRef)
  }

  const toggleRecord = () => {
    if (recRef.current !== null) {
      void stop()
      return
    }
    if (startingRef.current !== null) {
      startingRef.current.off = true
      startingRef.current = null
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
    const fromEngine = opts.engine !== undefined
    const attempt = { off: false }
    startingRef.current = attempt
    startRecording({
      width,
      height,
      fps,
      audio: opts.audio?.() ?? null,
      channels: opts.channels ?? 1,
      live: fromEngine,
    }).then(
      rec => {
        if (attempt.off) {
          rec.abort()
          return
        }
        startingRef.current = null
        recRef.current = rec
        setRecording(true)
        const start = performance.now()
        startRef.current = start
        noteRef.current = {
          page: location.pathname,
          width,
          height,
          fps: fps.num / fps.den,
          codec: rec.codec,
          hardware:
            rec.hardware === null ? 'unknown' : rec.hardware ? 'yes' : 'no',
          seconds: 0,
          frames: 0,
          held: 0,
          deepest: 0,
          encoded: 0,
          chunks: 0,
          bytes: 0,
          streamed: false,
          coded: '',
          canvas: `${width}x${height}`,
          configs: 0,
          readback: fromEngine ? 'engine' : 'canvas',
          clock: rec.clock,
          attached: 0,
          rendered: 0,
          placed: 0,
          ...(heldAdapter() === '' ? {} : { gpu: heldAdapter() }),
          stage: 'recording',
          hidden: false,
        }
        noteTake(noteRef.current)
        let noted = start
        // The engine a live take is attached to. A hot update or a lost device
        // replaces the engine mid-take, and the new one is attached on the next
        // frame; the take holds its last frame across the gap.
        let source: FrameSource | null = null
        let readback = noteRef.current.readback
        let attached = 0
        // Frames rendered by engines the take has let go of, and where the
        // current one's counter stood when it was attached.
        let rendered = 0
        let attachedAt = 0
        // The engine last attached, kept after it is let go so a report can
        // say how its loop was doing, and its render errors when attached.
        let watched: FrameSource | null = null
        let errorsAt = 0
        let engineFps = 0
        let readError = ''
        // Where a clocked take's frame count starts: the click, or the moment a
        // live take fell back to the canvas, and the frames it had by then.
        let clockFrom = start
        let clockBase = 0
        const sink: FrameSink = {
          frame: (f, at) => rec.place(f, at),
          fail: m => {
            if (readError === '') readError = m
          },
        }
        const size = { width, height }
        const renderedNow = () =>
          rendered + (source === null ? 0 : source.frameNo() - attachedAt)
        const loopNote = (engine: FrameSource) => {
          const health = engine.renderHealth()
          const renderErrors = health.errors - errorsAt
          return {
            engineFps,
            throttled: health.throttled,
            renderErrors,
            ...(renderErrors === 0 ? {} : { renderError: health.error }),
          }
        }
        feedRef.current = () => ({
          readback,
          attached,
          rendered: renderedNow(),
          placed: rec.placed(),
          ...(readError === '' ? {} : { readError }),
          ...(watched === null ? {} : loopNote(watched)),
        })
        const release = () => {
          rendered = renderedNow()
          letGo(source, size)
          source = null
        }
        detachRef.current = release
        const fallBack = () => {
          if (readback === 'engine') {
            release()
            readback = 'canvas'
            clockFrom = performance.now()
            clockBase = rec.frames()
            if (noteRef.current !== null) {
              reportTakeRescued({ ...noteRef.current, ...progress(rec) })
            }
          }
        }
        const attach = () => {
          const next = opts.engine?.() ?? null
          if (next !== source) {
            release()
            if (next !== null) {
              const failure = hand(next, sink, size)
              if (failure === '') {
                source = next
                watched = next
                attachedAt = next.frameNo()
                errorsAt = next.renderHealth().errors
                if (attached === 0) engineFps = Math.round(next.getStats().fps)
                attached += 1
              } else {
                if (readError === '') readError = `attach: ${failure}`
                fallBack()
              }
            }
          }
        }
        if (fromEngine) attach()
        const pump = () => {
          rafRef.current = requestAnimationFrame(pump)
          const live = canvasRef.current
          const r = recRef.current
          if (live === null || r === null) return
          // A failed encoder has closed and takes no more frames, and the
          // catch-up below would spin on it forever.
          if (r.error() !== '') {
            void stop()
            return
          }
          if (r.full()) {
            onError(
              r.streamed()
                ? 'recording stopped: storage is full'
                : 'recording stopped: the take reached its size limit',
            )
            void stop()
            return
          }
          if (readback === 'engine') {
            attach()
            if (
              r.encoded() === 0 &&
              performance.now() - start >= ENGINE_GRACE_MS
            ) {
              fallBack()
            }
          } else if (opts.clock === true || fromEngine) {
            const due =
              clockBase +
              Math.floor(
                ((performance.now() - clockFrom) / 1000) * (fps.num / fps.den),
              ) +
              1
            if (r.frames() < due) {
              if (r.busy()) r.hold()
              else r.frame(live)
            }
            while (r.frames() < due) r.hold()
          } else if (!r.busy()) {
            // One frame per rAF, and the timestamp comes off the count rather
            // than the clock (record.ts). A slow frame therefore stretches the
            // take in real time and not in the file, which is the trade this
            // whole path exists to make.
            r.frame(live)
          }
          if (performance.now() - noted >= 1000) {
            noted = performance.now()
            jot(noteRef, progress(r))
          }
        }
        rafRef.current = requestAnimationFrame(pump)
      },
      (e: unknown) => {
        if (attempt.off) return
        startingRef.current = null
        const message = e instanceof Error ? e.message : String(e)
        reportTakeFailed(message, null)
        onError(`could not start recording: ${message}`)
      },
    )
  }

  return { recording, toggleRecord, grabStill, grabThumb }
}

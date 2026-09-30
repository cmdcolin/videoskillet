import { useEffect, useRef, useState } from 'react'

import { DEFAULT_CONTROLS } from '../core/controls'
import { Engine } from '../core/gpu/pipeline'
import { smpteBars } from '../sources/pattern'
import { backingStoreSize } from '../ui/canvasSize'
import { RebuildPolicy } from '../ui/rebuildPolicy'
import { sounded } from './sound'
import { SLICE } from './tape'
import { steered } from './tilt'

import type { Controls, ModSlot } from '../core/controls'
import type { Fatal } from '../ui/FatalScreen'
import type { Camera, Layout } from './tape'
import type { Tilt } from './tilt'
import type { RefObject } from 'react'

// What the picture is made of: the camera, or bars before there is one, a
// second picture on B when there is one, and the look over them.
export interface Shown {
  video: HTMLVideoElement | null
  mirror: boolean
  second: HTMLVideoElement | null
  // The zoom past what the camera's own lens reached, applied to A.
  zoom: number
  // Whether a tall picture stands the set on its side rather than taking an
  // upright slice of it.
  sideways: boolean
}
export interface Board {
  controls: Controls
  mod: ModSlot[]
}

const tall = (video: HTMLVideoElement | null) =>
  video !== null && video.videoHeight > video.videoWidth

// A phone held upright hands over a tall picture. Cover-fitting it into a 4:3
// raster would cut away more than half its height, so the canvas shows an
// upright slice of the glass with the picture fitted into it, and the scan
// stays horizontal. Stood on its side instead, the set shows all of its glass,
// the way an arcade cabinet mounts its tube, and the scan runs down the
// picture.
export const layoutOf = (shown: Shown): Layout =>
  !tall(shown.video) ? 'whole' : shown.sideways ? 'turned' : 'slice'

const lay = (engine: Engine, layout: Layout) => {
  engine.setTubeTurned(layout === 'turned')
  engine.setViewSlice(layout === 'slice' ? SLICE : 1)
}

// Hands an engine the whole picture. The boot and the rebuild both go through
// here, so an engine replacing a lost one comes up on the same camera and look.
// A <video> belongs to the browser and plays straight through a device loss, so
// it only needs attaching again; the bars lived in a texture and are re-issued.
function dress(engine: Engine, shown: Shown, board: Board, sound: boolean) {
  engine.applyControls(sound ? sounded(board.controls) : board.controls)
  engine.setModSlots(board.mod)
  engine.setVideoSourceB(shown.second)
  engine.setSourceBEnabled(shown.second !== null)
  engine.setSourceMirror(shown.mirror)
  lay(engine, layoutOf(shown))
  engine.setSourceZoom(shown.zoom)
  if (shown.video === null) engine.setImageSource(smpteBars())
  else engine.setVideoSource(shown.video)
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

// The camera page's engine runs one canvas, a camera on A and a second picture
// on B. It keeps the two rules `useEngine` is built around: it never destroys a
// device (docs/adr/0004), and it replaces a lost one in place. It leaves out
// the instrument's links and its cue points.
// `sideways` is where the set stands to begin with, and `onLayout` hears each
// change of layout once it has reached the engine.
export function useCamEngine(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  opts: { sideways: boolean; onLayout: (layout: Layout) => void },
) {
  const engineRef = useRef<Engine | null>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [fatal, setFatal] = useState<Fatal | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [layout, setLayout] = useState<Layout>('whole')
  const shown = useRef<Shown>({
    video: null,
    mirror: false,
    second: null,
    zoom: 1,
    sideways: opts.sideways,
  })
  const laid = useRef<Layout>('whole')
  const board = useRef<Board>({ controls: DEFAULT_CONTROLS, mod: [] })
  const comparing = useRef(false)
  const heard = useRef(false)
  const onSet = (c: Controls) => (heard.current ? sounded(c) : c)

  const relay = () => {
    const next = layoutOf(shown.current)
    if (next === laid.current) return
    laid.current = next
    setLayout(next)
    if (engineRef.current !== null) lay(engineRef.current, next)
    opts.onLayout(next)
  }
  const turn = (video: HTMLVideoElement) => {
    if (shown.current.video === video) relay()
  }

  const standSideways = (sideways: boolean) => {
    shown.current = { ...shown.current, sideways }
    relay()
  }

  // A phone turned in the hand keeps the same camera and hands over frames the
  // other way up, which the <video> announces as a resize.
  const showVideo = (video: HTMLVideoElement, mirror: boolean) => {
    shown.current = { ...shown.current, video, mirror }
    engineRef.current?.setSourceMirror(mirror)
    engineRef.current?.setVideoSource(video)
    turn(video)
    video.addEventListener('resize', () => turn(video))
  }

  const showSecond = (second: HTMLVideoElement | null) => {
    shown.current = { ...shown.current, second }
    engineRef.current?.setVideoSourceB(second)
    engineRef.current?.setSourceBEnabled(second !== null)
  }

  const zoomA = (zoom: number) => {
    shown.current = { ...shown.current, zoom }
    engineRef.current?.setSourceZoom(zoom)
  }

  const layoutNow = () => layoutOf(shown.current)

  // The camera as it is on A, for recording a tape of it.
  const camera = (): Camera | null => {
    const { video, mirror } = shown.current
    return video === null ? null : { video, mirror }
  }

  const showBoard = (next: Board) => {
    board.current = next
    engineRef.current?.applyControls(onSet(next.controls))
    engineRef.current?.setModSlots(next.mod)
  }

  // The look's own board with the hand's steer on top, so a new look or a
  // level phone lands the board as tuned.
  const steer = (t: Tilt) => {
    if (comparing.current) return
    engineRef.current?.applyControls(
      steered(board.current.controls, t, layoutNow() === 'turned'),
    )
  }

  // The room's sound through the microphone, onto the set's supply. Rejects
  // when the phone refuses the microphone.
  const hear = async (on: boolean) => {
    const audio = engineRef.current?.audioState
    if (audio === undefined) return
    if (on) await audio.enableMic()
    else audio.disconnect()
    heard.current = on
    engineRef.current?.applyControls(onSet(board.current.controls))
  }

  // Hold to see the camera clean, the way a photo app shows the original.
  const compare = (on: boolean) => {
    comparing.current = on
    engineRef.current?.preview(on ? { ...DEFAULT_CONTROLS } : null)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return undefined
    const size = () => {
      const [w, h] = backingStoreSize(
        canvas.clientWidth,
        canvas.clientHeight,
        window.devicePixelRatio,
        1,
      )
      // Assigning the same size still reconfigures the swapchain.
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(canvas)

    // On the way out the engine stops its loop and lets go of the device.
    // Destroying a presenting device ends the tab's rendering step
    // (docs/adr/0004).
    let disposed = false
    const onPageHide = () => {
      disposed = true
      engineRef.current?.destroy()
    }
    window.addEventListener('pagehide', onPageHide)

    const losses = new RebuildPolicy()
    const create = (onFail: (e: unknown) => void, dead?: Engine) =>
      Engine.create(canvas, { audio: dead?.audioState }).then(created => {
        if (disposed) {
          created.destroy()
          return
        }
        dress(created, shown.current, board.current, heard.current)
        engineRef.current = created
        setEngine(created)
        window.vf = created
        created.onDeviceLost = () => replace(created)
        created.onHang = () => replace(created)
        created.onFrozen = f => setFrozen(f !== null)
        created.onGpuError = m => console.warn(`gpu: ${m}`)
      }, onFail)

    // The page is still intact when a device goes away, so the engine is
    // replaced on the same canvas and dressed with the same picture.
    const replace = (dead: Engine) => {
      if (disposed || engineRef.current !== dead) return
      if (losses.record(performance.now()) === 'give-up') {
        setFatal({
          title: 'WebGPU device lost',
          body: `The GPU device was replaced ${losses.limit} times and kept going away, so the page stopped trying.`,
          kind: 'lost',
        })
        return
      }
      setRebuilding(true)
      dead.destroy({ keepAudio: true })
      // The replacement takes over the audio graph, and with it a live mic.
      void create(
        e =>
          setFatal({
            title: 'WebGPU device lost',
            body: `The GPU device went away and could not be replaced: ${reason(e)}`,
            kind: 'lost',
          }),
        dead,
      ).finally(() => setRebuilding(false))
    }

    void create(e =>
      setFatal({
        title: 'WebGPU unavailable',
        body: reason(e),
        kind: 'unavailable',
      }),
    )

    return () => {
      disposed = true
      ro.disconnect()
      window.removeEventListener('pagehide', onPageHide)
      // A remount or a hot update, neither of them the device's fault: the
      // next engine adopts it.
      engineRef.current?.destroy({ keepDevice: true })
      engineRef.current = null
    }
  }, [canvasRef])

  return {
    engine,
    fatal,
    rebuilding,
    frozen,
    layout,
    showVideo,
    showSecond,
    zoomA,
    layoutNow,
    standSideways,
    camera,
    showBoard,
    hear,
    steer,
    compare,
  }
}

import { useEffect, useRef, useState } from 'react'

import { DEFAULT_CONTROLS } from '../core/controls'
import { Engine } from '../core/gpu/pipeline'
import { smpteBars } from '../sources/pattern'
import { backingStoreSize } from '../ui/canvasSize'
import { RebuildPolicy } from '../ui/rebuildPolicy'
import { steered } from './tilt'

import type { Controls, ModSlot } from '../core/controls'
import type { Fatal } from '../ui/FatalScreen'
import type { Tilt } from './tilt'
import type { RefObject } from 'react'

// What the picture is made of: the camera, or bars before there is one, and
// the look over it.
export interface Shown {
  video: HTMLVideoElement | null
  mirror: boolean
}
export interface Board {
  controls: Controls
  mod: ModSlot[]
}

// A phone held upright hands over a tall picture, and the set stands on its
// side to show all of it. Cover-fitting a tall picture into a 4:3 raster
// would cut away almost half its height.
const tall = (video: HTMLVideoElement | null) =>
  video !== null && video.videoHeight > video.videoWidth

// Hands an engine the whole picture. The boot and the rebuild both go through
// here, so an engine replacing a lost one comes up on the same camera and look.
// A <video> belongs to the browser and plays straight through a device loss, so
// it only needs attaching again; the bars lived in a texture and are re-issued.
function dress(engine: Engine, shown: Shown, board: Board) {
  engine.applyControls(board.controls)
  engine.setModSlots(board.mod)
  engine.setSourceBEnabled(false)
  engine.setSourceMirror(shown.mirror)
  engine.setTubeTurned(tall(shown.video))
  if (shown.video === null) engine.setImageSource(smpteBars())
  else engine.setVideoSource(shown.video)
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

// The camera page's engine runs one canvas and one source. It keeps the two
// rules `useEngine` is built around: it never destroys a device (docs/adr/0004),
// and it replaces a lost one in place. It leaves out what serves the
// instrument's second deck, its links and its clips.
export function useCamEngine(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const engineRef = useRef<Engine | null>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [fatal, setFatal] = useState<Fatal | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [turned, setTurned] = useState(false)
  const shown = useRef<Shown>({ video: null, mirror: false })
  const board = useRef<Board>({ controls: DEFAULT_CONTROLS, mod: [] })
  const comparing = useRef(false)

  const turn = (video: HTMLVideoElement) => {
    setTurned(tall(video))
    engineRef.current?.setTubeTurned(tall(video))
  }

  // A phone turned in the hand keeps the same camera and hands over frames the
  // other way up, which the <video> announces as a resize.
  const showVideo = (video: HTMLVideoElement, mirror: boolean) => {
    shown.current = { video, mirror }
    engineRef.current?.setSourceMirror(mirror)
    engineRef.current?.setVideoSource(video)
    turn(video)
    video.addEventListener('resize', () => {
      if (shown.current.video === video) turn(video)
    })
  }

  const showBoard = (next: Board) => {
    board.current = next
    engineRef.current?.applyControls(next.controls)
    engineRef.current?.setModSlots(next.mod)
  }

  // The look's own board with the hand's steer on top, so a new look or a
  // level phone lands the board as tuned.
  const steer = (t: Tilt) => {
    if (comparing.current) return
    engineRef.current?.applyControls(
      steered(board.current.controls, t, tall(shown.current.video)),
    )
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
    const create = (onFail: (e: unknown) => void) =>
      Engine.create(canvas).then(created => {
        if (disposed) {
          created.destroy()
          return
        }
        dress(created, shown.current, board.current)
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
      void create(e =>
        setFatal({
          title: 'WebGPU device lost',
          body: `The GPU device went away and could not be replaced: ${reason(e)}`,
          kind: 'lost',
        }),
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
    turned,
    showVideo,
    showBoard,
    steer,
    compare,
  }
}

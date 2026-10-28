import { useEffect, useRef, useState } from 'react'

import { DEFAULT_CONTROLS } from '../core/controls'
import { smpteBars, sweep } from '../sources/pattern'
import { backingStoreSize } from '../ui/canvasSize'
import { superviseEngine } from '../ui/engineSupervisor'
import { sounded } from './sound'
import { SLICE } from './tape'
import { steered } from './tilt'

import type { Controls, ModSlot } from '../core/controls'
import type { Engine } from '../core/gpu/pipeline'
import type { FrozenKind } from '../core/gpu/renderloop'
import type { GpuFault } from '../ui/engineSupervisor'
import type { Fatal } from '../ui/FatalScreen'
import type { Pattern } from './patterns'
import type { Camera, Layout } from './tape'
import type { Tilt } from './tilt'
import type { RefObject } from 'react'

const NOISE: Record<Exclude<Pattern, 'bars' | 'sweep'>, number> = {
  'tv static': 1,
  'vhs static': 2,
  synth: 3,
}

// What the picture is made of: the camera or a clip on A, a pattern there
// instead, or bars before there is either; a second picture or a pattern on B
// when there is one; and the look over them.
export interface Shown {
  video: HTMLVideoElement | null
  pattern: Pattern | null
  mirror: boolean
  second: HTMLVideoElement | Pattern | null
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
  putB(engine, shown.second)
  engine.setSourceMirror(shown.mirror)
  lay(engine, layoutOf(shown))
  engine.setSourceZoom(shown.zoom)
  if (shown.pattern !== null) putA(engine, shown.pattern)
  else if (shown.video === null) engine.setImageSource(smpteBars())
  else engine.setVideoSource(shown.video)
}

// A pattern lives in a texture or in the shader, so a rebuilt engine is handed
// it again the same way.
function putA(engine: Engine, pattern: Pattern) {
  if (pattern === 'bars') engine.setImageSource(smpteBars())
  else if (pattern === 'sweep') engine.setImageSource(sweep())
  else engine.setNoiseSource(NOISE[pattern])
}

function putB(engine: Engine, second: Shown['second']) {
  if (second === null || second instanceof HTMLVideoElement)
    engine.setVideoSourceB(second)
  else if (second === 'bars') engine.setImageSourceB(smpteBars())
  else if (second === 'sweep') engine.setImageSourceB(sweep())
  else engine.setNoiseSourceB(NOISE[second])
  engine.setSourceBEnabled(second !== null)
}

// The camera page's engine runs one canvas, a camera on A and a second picture
// on B. `superviseEngine` boots it and replaces it in place, as it does for
// `useEngine`. It leaves out the instrument's links and its cue points.
// `sideways` is where the set stands to begin with, and `onLayout` hears each
// change of layout once it has reached the engine.
export function useCamEngine(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  opts: {
    sideways: boolean
    firstBoard: () => Board
    firstB: Pattern | null
    onLayout: (layout: Layout) => void
  },
) {
  const engineRef = useRef<Engine | null>(null)
  const [engine, setEngine] = useState<Engine | null>(null)
  const [fatal, setFatal] = useState<Fatal | null>(null)
  const [rebuilding, setRebuilding] = useState<GpuFault | null>(null)
  const [frozen, setFrozen] = useState<FrozenKind | null>(null)
  const [layout, setLayout] = useState<Layout>('whole')
  const shown = useRef<Shown>({
    video: null,
    pattern: null,
    mirror: false,
    second: opts.firstB,
    zoom: 1,
    sideways: opts.sideways,
  })
  const laid = useRef<Layout>('whole')
  const [watched] = useState(() => new WeakSet<HTMLVideoElement>())
  const [first] = useState(opts.firstBoard)
  const board = useRef<Board>(first)
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
    shown.current = { ...shown.current, video, pattern: null, mirror }
    engineRef.current?.setSourceMirror(mirror)
    engineRef.current?.setVideoSource(video)
    turn(video)
    if (!watched.has(video)) {
      watched.add(video)
      video.addEventListener('resize', () => turn(video))
    }
  }

  const showPattern = (pattern: Pattern) => {
    shown.current = { ...shown.current, video: null, pattern, mirror: false }
    if (engineRef.current !== null) {
      engineRef.current.setSourceMirror(false)
      putA(engineRef.current, pattern)
    }
    relay()
  }

  const showSecond = (second: Shown['second']) => {
    shown.current = { ...shown.current, second }
    if (engineRef.current !== null) putB(engineRef.current, second)
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
  // when the phone refuses the microphone or the set has not started.
  const hear = async (on: boolean) => {
    const audio = engineRef.current?.audioState
    if (audio === undefined) {
      if (on) throw new Error('the set is still starting')
      return
    }
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

    const unsupervise = superviseEngine(canvas, {
      adopt: created => {
        dress(created, shown.current, board.current, heard.current)
        engineRef.current = created
        setEngine(created)
        window.vf = created
        created.onGpuError = m => console.warn(`gpu: ${m}`)
      },
      onRebuilding: setRebuilding,
      onFrozen: setFrozen,
      onFatal: setFatal,
    })

    return () => {
      ro.disconnect()
      unsupervise()
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
    showPattern,
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

import { startRecording } from '../ui/record'
import { cropRect } from './zoom'

// How long a tape runs before it loops, and the rate it is written at.
export const TAPE_SECONDS = 4
const FPS = 30
// B is staged at raster size, so a larger picture is only a larger encode.
const LONG_SIDE = 854

// How a picture lies on the set. `whole` fills the 4:3 glass, `turned` lies
// across a set on its side, and `slice` stands upright in the middle of an
// upright set, of which the canvas shows only that slice.
export type Layout = 'whole' | 'turned' | 'slice'

// The share of the glass's width a slice shows: a 3:4 picture down the middle
// of a 4:3 one.
export const SLICE = 3 / 4 / (4 / 3)

// `crop` is the zoom's crop of A, 1 for the whole frame.
export interface Camera {
  video: HTMLVideoElement
  mirror: boolean
  crop: number
}

// Sizes `canvas` for the picture's current frame and returns what lays each
// frame down the way compose.wgsl lays A. The engine turns, slices, mirrors and
// crops only A, so this lays B the same way by hand: mirrored if the camera
// faced its subject, turned to lie across a set on its side, fitted into the
// middle of the raster with black either side for a slice, and cropped by the
// zoom.
function lay(
  canvas: HTMLCanvasElement,
  g: CanvasRenderingContext2D,
  cam: Camera,
  layout: Layout,
): (crop: number) => void {
  const vw = cam.video.videoWidth
  const vh = cam.video.videoHeight
  g.resetTransform()
  if (layout === 'slice') {
    canvas.width = LONG_SIDE
    canvas.height = Math.round((LONG_SIDE * 3) / 4)
    const h = canvas.height
    const w = Math.round(LONG_SIDE * SLICE)
    const x0 = (LONG_SIDE - w) / 2
    if (cam.mirror) {
      g.translate(LONG_SIDE, 0)
      g.scale(-1, 1)
    }
    return crop => {
      const [sx, sy, sw, sh] = cropRect(vw, vh, crop)
      const s = Math.max(w / sw, h / sh)
      const dw = sw * s
      const dh = sh * s
      g.fillStyle = '#000'
      g.fillRect(0, 0, LONG_SIDE, h)
      g.save()
      g.beginPath()
      g.rect(x0, 0, w, h)
      g.clip()
      g.drawImage(
        cam.video,
        sx,
        sy,
        sw,
        sh,
        x0 + (w - dw) / 2,
        (h - dh) / 2,
        dw,
        dh,
      )
      g.restore()
    }
  }
  const turned = layout === 'turned'
  const scale = Math.min(1, LONG_SIDE / Math.max(vw, vh))
  const dw = Math.round(vw * scale)
  const dh = Math.round(vh * scale)
  canvas.width = turned ? dh : dw
  canvas.height = turned ? dw : dh
  // A quarter turn anticlockwise lays the camera's top edge down the canvas's
  // left, which is where compose puts it.
  if (turned) {
    g.translate(0, canvas.height)
    g.rotate(-Math.PI / 2)
  }
  if (cam.mirror) {
    g.translate(dw, 0)
    g.scale(-1, 1)
  }
  return crop => g.drawImage(cam.video, ...cropRect(vw, vh, crop), 0, 0, dw, dh)
}

const context = (canvas: HTMLCanvasElement) => {
  const g = canvas.getContext('2d')
  if (g === null) throw new Error('no 2D canvas for source B')
  return g
}

// The camera recorded to a tape for source B, the way a studio rolled a deck
// into a mixer's second input. `onSecond` hears how many whole seconds are
// left.
export async function recordTape(
  cam: Camera,
  layout: Layout,
  onSecond: (left: number) => void,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const g = context(canvas)
  const draw = lay(canvas, g, cam, layout)
  const rec = await startRecording({
    width: canvas.width,
    height: canvas.height,
    fps: { num: FPS, den: 1 },
  })
  const total = TAPE_SECONDS * FPS
  const start = performance.now()
  await new Promise<void>(done => {
    const tick = () => {
      const due = Math.min(
        total,
        Math.floor(((performance.now() - start) / 1000) * FPS) + 1,
      )
      if (rec.frames() < due) {
        if (rec.busy()) rec.hold()
        else {
          draw(cam.crop)
          rec.frame(canvas)
        }
      }
      while (rec.frames() < due) rec.hold()
      onSecond(Math.ceil(TAPE_SECONDS - rec.frames() / FPS))
      if (rec.frames() < total) requestAnimationFrame(tick)
      else done()
    }
    requestAnimationFrame(tick)
  })
  const failure = rec.error()
  if (failure !== '') {
    rec.abort()
    throw new Error(failure)
  }
  return rec.finish()
}

export interface Loop {
  url: string
  video: HTMLVideoElement
}

// A tape or a clip playing on a loop, muted, ready for the engine's B slot. A
// loop that will not play lets go of its URL.
export async function playLoop(media: Blob): Promise<Loop> {
  const url = URL.createObjectURL(media)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.loop = true
  video.src = url
  try {
    await video.play()
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  return { url, video }
}

// Stops a loop `playLoop` started and lets go of its `url`.
export function dropLoop({ video, url }: Loop) {
  video.pause()
  video.removeAttribute('src')
  video.load()
  URL.revokeObjectURL(url)
}

export interface Relay {
  video: HTMLVideoElement
  stop: () => void
}

// A live picture for source B, laid down each frame the way a tape is
// recorded, in whatever layout the set has now. A phone turned in the hand
// changes the camera's frame size and the set's layout, and the canvas is laid
// again to follow them. Handed a function, the relay asks it for the camera
// every frame, so it follows the camera on A through a flip. That relay runs
// on the display's frames, since a camera it has left stops calling back.
export async function relayCamera(
  source: Camera | (() => Camera | null),
  layout: () => Layout,
): Promise<Relay> {
  const canvas = document.createElement('canvas')
  const g = context(canvas)
  const camera = typeof source === 'function' ? source : () => source
  const clock =
    typeof source !== 'function' && 'requestVideoFrameCallback' in source.video
      ? source.video
      : null
  let laid: HTMLVideoElement | null = null
  let seen = ''
  let draw: ((crop: number) => void) | null = null
  let pending = 0
  const tick = () => {
    const cam = camera()
    if (cam !== null && cam.video.videoWidth > 0) {
      const now = `${cam.video.videoWidth}x${cam.video.videoHeight}:${cam.mirror}:${layout()}`
      if (now !== seen || cam.video !== laid) {
        seen = now
        laid = cam.video
        draw = lay(canvas, g, cam, layout())
      }
      draw?.(cam.crop)
    }
    pending =
      clock !== null
        ? clock.requestVideoFrameCallback(tick)
        : requestAnimationFrame(tick)
  }
  tick()
  const stream = canvas.captureStream(FPS)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  const stop = () => {
    if (clock !== null) clock.cancelVideoFrameCallback(pending)
    else cancelAnimationFrame(pending)
    for (const t of stream.getTracks()) t.stop()
    video.srcObject = null
  }
  try {
    await video.play()
  } catch (e) {
    stop()
    throw e
  }
  return { video, stop }
}

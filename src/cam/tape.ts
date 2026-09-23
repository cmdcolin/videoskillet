import { startRecording } from '../ui/record'

// How long a tape runs before it loops, and the rate it is written at.
export const TAPE_SECONDS = 4
const FPS = 30
// B is staged at raster size, so a larger picture is only a larger encode.
const LONG_SIDE = 854

export interface Camera {
  video: HTMLVideoElement
  mirror: boolean
}

// Sizes `canvas` for the camera's current frame and sets the transform that
// lays each frame down the way `pick` in compose.wgsl reads A. The engine turns
// and mirrors only A, so whatever goes to B from a camera is turned and
// mirrored here instead: mirrored if the camera faced its subject, and turned
// to lie across a set on its side when the frame is tall. That is a camera
// mounted sideways to match the set. The returned size is what drawImage
// takes.
function lay(
  canvas: HTMLCanvasElement,
  g: CanvasRenderingContext2D,
  cam: Camera,
): [number, number] {
  const vw = cam.video.videoWidth
  const vh = cam.video.videoHeight
  const turned = vh > vw
  const scale = Math.min(1, LONG_SIDE / Math.max(vw, vh))
  const dw = Math.round(vw * scale)
  const dh = Math.round(vh * scale)
  canvas.width = turned ? dh : dw
  canvas.height = turned ? dw : dh
  g.resetTransform()
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
  return [dw, dh]
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
  onSecond: (left: number) => void,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const g = context(canvas)
  const [dw, dh] = lay(canvas, g, cam)
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
      while (rec.frames() < due) {
        g.drawImage(cam.video, 0, 0, dw, dh)
        rec.frame(canvas)
      }
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

// The tape playing on a loop, ready for the engine's B slot.
export async function playTape(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.loop = true
  video.src = url
  await video.play()
  return video
}

export interface Relay {
  video: HTMLVideoElement
  stop: () => void
}

// A live camera for source B, laid down each frame the way a tape is recorded.
// A phone turned in the hand changes the camera's frame size, and the canvas is
// laid again to follow it.
export async function relayCamera(cam: Camera): Promise<Relay> {
  const canvas = document.createElement('canvas')
  const g = context(canvas)
  let size = lay(canvas, g, cam)
  let seen = `${cam.video.videoWidth}x${cam.video.videoHeight}`
  let raf = 0
  const tick = () => {
    const now = `${cam.video.videoWidth}x${cam.video.videoHeight}`
    if (now !== seen) {
      seen = now
      size = lay(canvas, g, cam)
    }
    g.drawImage(cam.video, 0, 0, size[0], size[1])
    raf = requestAnimationFrame(tick)
  }
  tick()
  const stream = canvas.captureStream(FPS)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  await video.play()
  return {
    video,
    stop: () => {
      cancelAnimationFrame(raf)
      for (const t of stream.getTracks()) t.stop()
      video.srcObject = null
    },
  }
}

import { startRecording } from '../ui/record'

// How long a tape runs before it loops, and the rate it is written at.
export const TAPE_SECONDS = 4
const FPS = 30
// B is staged at raster size, so a larger tape is only a larger encode.
const LONG_SIDE = 854

export interface Camera {
  video: HTMLVideoElement
  mirror: boolean
  turned: boolean
}

// The camera recorded to a tape for source B, the way a studio rolled a deck
// into a mixer's second input. The engine turns and mirrors only A, so the
// tape is written the way `pick` in compose.wgsl reads A: mirrored if the
// camera faced its subject, and turned to lie across a set on its side. The
// tape is then already the right way up on the raster, like a tape from a
// camera mounted sideways to match the set.
//
// `onSecond` hears how many whole seconds are left.
export async function recordTape(
  cam: Camera,
  onSecond: (left: number) => void,
): Promise<Blob> {
  const { video, mirror, turned } = cam
  const vw = video.videoWidth
  const vh = video.videoHeight
  const scale = Math.min(1, LONG_SIDE / Math.max(vw, vh))
  const dw = Math.round(vw * scale)
  const dh = Math.round(vh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = turned ? dh : dw
  canvas.height = turned ? dw : dh
  const g = canvas.getContext('2d')
  if (g === null) throw new Error('no 2D canvas for the tape')
  // A quarter turn anticlockwise lays the camera's top edge down the tape's
  // left, which is where compose puts it.
  if (turned) {
    g.translate(0, canvas.height)
    g.rotate(-Math.PI / 2)
  }
  if (mirror) {
    g.translate(dw, 0)
    g.scale(-1, 1)
  }

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
        g.drawImage(video, 0, 0, dw, dh)
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

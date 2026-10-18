import type { Controls } from '../core/controls'

// What one lap of the camera loop hands back of a large grey patch at each
// level, built the way the shaders build it: the gun's cutoff and gamma
// (decode), the bloom, halation and glow a flat field adds to itself
// (crt_face), then the camera's exposure, black cut and full well (compose),
// through the fader. The rest of the chain is taken as passing the level
// through. Lens blur, vignette, zoom and the pickup tube's lag move light about
// or across fields and leave a steady flat patch where it was, so they are left
// out, and so are the auto-iris and the comet cap.

export interface CameraLoop {
  mix: number
  gain: number
  black: number
  knee: number
  cutoff: number
  gamma: number
  bloom: number
  halation: number
  glow: number
}

export const cameraLoopOf = (c: Controls): CameraLoop => ({
  mix: c.fbMix,
  gain: c.fbGain,
  black: c.fbBlack,
  knee: c.fbKnee,
  cutoff: c.crtCutoff,
  gamma: c.crtGamma,
  bloom: c.crtBloom,
  halation: c.crtHalation,
  glow: c.crtGlow,
})

// The luma of crt_face's WARM tint, which halation and glow add in.
const WARM_Y = 0.299 + 0.587 * 0.62 + 0.114 * 0.38

const toLight = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((Math.max(c, 0) + 0.055) / 1.055) ** 2.4

const toDrive = (c: number) =>
  Math.min(
    Math.max(
      c <= 0.0031308 ? c * 12.92 : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055,
      0,
    ),
    1,
  )

const spill = (l: number, fb: number) => (fb * l * l) / (l * l + 0.1)

// The drive the camera hands the fader for a patch the encoder was given at
// `level`.
export function cameraLap(loop: CameraLoop, level: number): number {
  const lifted =
    Math.max(level - loop.cutoff, 0) / Math.max(1 - loop.cutoff, 1e-3)
  const light = toLight(lifted ** loop.gamma)
  let face = light + light * spill(light, 0.04 * loop.bloom)
  face += 0.08 * loop.halation * light * WARM_Y
  face += loop.glow * WARM_Y * (0.001 + 0.2 * face)
  const shot = toDrive(Math.min(face, 1)) * loop.gain
  const cut = Math.max(shot - loop.black, 0) / (1 - loop.black)
  const knee = 1 - 0.7 * Math.min(Math.max(loop.knee, 0), 1)
  const head = 1 - knee
  const over = Math.max(cut - knee, 0)
  return (
    loop.mix *
    (Math.min(cut, knee) + (head * over) / Math.max(head + over, 1e-6))
  )
}

// The gain of a lap at each level: above 1 that level grows, below it fades.
export const cameraLapGains = (loop: CameraLoop, levels: readonly number[]) =>
  levels.map(level => cameraLap(loop, level) / level)

// Levels from just above black to white. Black itself is left out, where a
// gain is a division by zero.
export const greyLevels = (points: number) =>
  Array.from({ length: points }, (_, i) => (i + 1) / points)

const READ_POINTS = 240

// The highest lap gain at any level and where it is, and the level a loop above
// unity settles at: the brightest place the gain falls back through 1, where a
// level that has grown stops growing. None when the gain never falls back
// through 1, which is a loop that walks to white.
export function cameraLapReading(loop: CameraLoop) {
  const levels = greyLevels(READ_POINTS)
  const gains = cameraLapGains(loop, levels)
  let at = 0
  gains.forEach((g, i) => {
    if (g > gains[at]!) at = i
  })
  let settle: number | null = null
  for (let i = gains.length - 1; i > 0 && settle === null; i--) {
    const above = gains[i - 1]!
    const below = gains[i]!
    if (above >= 1 && below < 1) {
      const step = levels[i]! - levels[i - 1]!
      settle = levels[i - 1]! + (step * (above - 1)) / (above - below)
    }
  }
  return { gain: gains[at]!, level: levels[at]!, settle }
}

export type CameraLapReading = ReturnType<typeof cameraLapReading>

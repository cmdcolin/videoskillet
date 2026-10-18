const LOW = 0.25
const HIGH = 0.75
const SPOT_SIGMA = 0.5
const MIN_APERTURE_PX = 0.25
const SPREAD_PER_BLOOM = 3
const GAP_SHARPNESS = 10

export interface Edge {
  spot: number
  svm: number
  svmWidth: number
  sharp: number
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi)

// Abramowitz and Stegun 7.1.26.
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return Math.sign(x) * (1 - poly * Math.exp(-x * x))
}

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  p1 +
  0.5 *
    t *
    (p2 -
      p0 +
      t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))

// What crt_face.wgsl writes at one sample of a step between samples 0 and 1: the
// gaussian spot (sigma half the spot width, in the shader's gather weights), then
// scan velocity modulation scaling the light by the luma either side of it.
function written(k: number, c: Edge): number {
  const sigma = SPOT_SIGMA * c.spot
  const blurred =
    sigma > 0
      ? LOW + (HIGH - LOW) * 0.5 * (1 + erf((k - 0.5) / (sigma * Math.SQRT2)))
      : k >= 1
        ? HIGH
        : LOW
  if (c.svm === 0) return blurred
  const ap = Math.max(c.svmWidth, MIN_APERTURE_PX)
  const luma = (x: number) => LOW + (HIGH - LOW) * clamp(x, 0, 1)
  return blurred * Math.max(1 + c.svm * (luma(k + ap) - luma(k - ap)), 0)
}

// present.wgsl's horizontal reconstruction of those samples: bilinear at 0, a
// clamped Catmull-Rom at 1.
export function edgeProfile(c: Edge, from: number, to: number, points: number) {
  return Array.from({ length: points }, (_, i) => {
    const x = from + ((to - from) * i) / (points - 1)
    const k = Math.floor(x)
    const t = x - k
    const [p0, p1, p2, p3] = [k - 1, k, k + 1, k + 2].map(s => written(s, c))
    const linear = p1! + (p2! - p1!) * t
    const cubic = clamp(catmull(p0!, p1!, p2!, p3!, t), 0, 1)
    return linear + c.sharp * (cubic - linear)
  })
}

// present.wgsl's gap between scan lines at one beam current: the spot is
// space-charge limited, so a bright line fattens and its gap closes.
export function lineProfile(
  scanBeam: number,
  bloom: number,
  luma: number,
  points: number,
) {
  const spot = 1 + SPREAD_PER_BLOOM * bloom * luma
  return Array.from({ length: points }, (_, i) => {
    const fr = -0.5 + i / (points - 1)
    const gap = 1 - Math.exp((-fr * fr * GAP_SHARPNESS) / spot)
    return 1 - scanBeam * gap
  })
}

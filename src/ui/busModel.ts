export interface Bus {
  aGain: number
  bGain: number
  bRing: number
  busClip: number
  genlock: boolean
}

const WHITE_IRE = 100
const RING_SCALE = 0.01

const rail = (
  v: number,
  hi: number,
  hiSoft: number,
  lo: number,
  loSoft: number,
) => {
  if (v > hi) {
    const t = (v - hi) / hiSoft
    return hi + (hiSoft * t) / (1 + t)
  }
  if (v < lo) {
    const t = (lo - v) / loSoft
    return lo - (loSoft * t) / (1 + t)
  }
  return v
}

// mix_b.wgsl's summing amplifier: it runs out of headroom as busClip rises, and
// its gain falls away toward the rail instead of stopping dead.
export const clipBus = (v: number, busClip: number): number =>
  busClip > 0 ? rail(v, 220 - 115 * busClip, 30, -120 + 75 * busClip, 15) : v

export const sumBus = (a: number, b: number, bus: Bus): number =>
  clipBus(
    bus.aGain * a + bus.bGain * b + bus.bRing * a * b * RING_SCALE,
    bus.busClip,
  )

// Peak white of two white pictures as B's fader moves. The clean dissolve
// replaces A with B, so white stays white; the dirty sum adds them.
export function whiteAtFader(bus: Bus, points: number, span: number): number[] {
  return Array.from({ length: points }, (_, i) => {
    const bGain = -span + (2 * span * i) / (points - 1)
    if (bus.genlock) return WHITE_IRE
    return sumBus(WHITE_IRE, WHITE_IRE, { ...bus, bGain })
  })
}

export const overloaded = (bus: Bus): boolean =>
  !bus.genlock && sumBus(WHITE_IRE, WHITE_IRE, bus) < sumBusUnclipped(bus)

const sumBusUnclipped = (bus: Bus) =>
  bus.aGain * WHITE_IRE +
  bus.bGain * WHITE_IRE +
  bus.bRing * WHITE_IRE * WHITE_IRE * RING_SCALE

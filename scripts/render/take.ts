// A take of one look over SMPTE bars from a fixed seed, on the app's own engine
// bundle. `golden.ts` and `determinism.ts` both render through this, so the two
// checks see the same picture for the same case.

import './runtime.ts'
import type { Controls } from '../../src/core/controls.ts'

const {
  ACTIVE_HEIGHT,
  ACTIVE_WIDTH,
  DEFAULT_CONTROLS,
  EMPTY_SLOT,
  Engine,
  PRESET_BY_NAME,
  presetControls,
  smpteBarsPixels,
  toEngineSlots,
} = await import('./build/engine.js')

export { ACTIVE_HEIGHT, ACTIVE_WIDTH, PRESET_BY_NAME }

export interface Case {
  name: string
  preset?: string
  set?: Partial<Controls>
  noise?: number
  caption?: string
  // The preset's own routings in the modulation bay, at full motion.
  motion?: boolean
  // A cutout on deck B: `cutoutPixels`, a green disc on transparency.
  cutout?: boolean
}

// A cutout with every kind of alpha the keyer meets: a green disc, which a
// chroma key would cut and the alpha key keeps, with a soft edge, and below it
// a white band at half alpha, on a transparent black field as the app's
// canvas staging leaves it.
export const cutoutPixels = (): Uint8Array => {
  const out = new Uint8Array(ACTIVE_WIDTH * ACTIVE_HEIGHT * 4)
  const cx = ACTIVE_WIDTH * 0.45
  const cy = ACTIVE_HEIGHT * 0.42
  const r = ACTIVE_HEIGHT * 0.28
  const ramp = 12
  for (let y = 0; y < ACTIVE_HEIGHT; y++) {
    for (let x = 0; x < ACTIVE_WIDTH; x++) {
      const i = (y * ACTIVE_WIDTH + x) * 4
      const d = Math.hypot(x - cx, y - cy)
      const disc = Math.min(Math.max((r - d) / ramp, 0), 1)
      const band = y > ACTIVE_HEIGHT * 0.78 && y < ACTIVE_HEIGHT * 0.9 ? 0.5 : 0
      const alpha = Math.max(disc, band)
      const white = alpha > 0 ? 255 : 0
      out[i] = disc > 0 ? 40 : white
      out[i + 1] = disc > 0 ? 200 : white
      out[i + 2] = disc > 0 ? 60 : white
      out[i + 3] = Math.round(alpha * 255)
    }
  }
  return out
}

const SEED = 1

// Retyped at the boundary because the bundle is JavaScript: TypeScript infers
// `bpm` from its `= null` default and decides the parameter is `null`. The real
// signature is `modSlots.ts`'s, which takes the tempo or nothing.
const slotsFor = toEngineSlots as unknown as (
  slots: readonly unknown[],
  master: number,
  bpm: number | null,
) => never[]

// The modulation bay for a list of routings, each switched on, the way
// `useModSlots` builds it.
export const bayFor = (
  routings: readonly object[],
  master = 1,
  bpm: number | null = null,
) =>
  slotsFor(
    routings.map(r => ({ ...EMPTY_SLOT, ...r, on: true })),
    master,
    bpm,
  )

// Boots one engine and returns a function that renders a case on it, reading
// the frame back after each step count in `at`.
export async function openStage() {
  const canvas = new OffscreenCanvas(ACTIVE_WIDTH, ACTIVE_HEIGHT)
  const engine = await Engine.create(canvas as never)
  engine.pauseLoop()
  const bars = new Uint8Array(smpteBarsPixels().buffer.slice(0))
  const cutout = cutoutPixels()
  const clear = new Uint8Array(ACTIVE_WIDTH * ACTIVE_HEIGHT * 4)

  return async (c: Case, at: readonly number[]) => {
    const def =
      c.preset === undefined ? undefined : PRESET_BY_NAME.get(c.preset)
    if (c.preset !== undefined && def === undefined) {
      throw new Error(`no preset named ${c.preset}`)
    }
    const base =
      def === undefined ? { ...DEFAULT_CONTROLS } : presetControls(def.patch)
    engine.setImagePixels(bars, ACTIVE_WIDTH, ACTIVE_HEIGHT)
    engine.setImagePixelsB(c.cutout === true ? cutout : clear)
    engine.setNoiseSource(c.noise ?? 0)
    engine.setCaption(c.caption ?? '')
    engine.setModSlots(c.motion === true ? bayFor(def?.mod ?? []) : [])
    engine.startTake({ fps: 60, seed: SEED })
    engine.applyControls({ ...base, ...c.set })
    const frames: Uint8Array<ArrayBuffer>[] = []
    const last = Math.max(...at)
    for (let i = 1; i <= last; i++) {
      engine.step()
      if (at.includes(i)) frames.push(await engine.readFrame())
    }
    return frames
  }
}

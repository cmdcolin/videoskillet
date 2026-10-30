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
}

const SEED = 1

// Retyped at the boundary for the reason `render.ts` gives: the bundle is
// JavaScript, and TypeScript reads the `= null` default as the parameter type.
const slotsFor = toEngineSlots as unknown as (
  slots: readonly unknown[],
  master: number,
  bpm: number | null,
) => never[]

const bayFor = (routings: readonly object[]) =>
  slotsFor(
    routings.map(r => ({ ...EMPTY_SLOT, ...r, on: true })),
    1,
    null,
  )

// Boots one engine and returns a function that renders a case on it, reading
// the frame back after each step count in `at`.
export async function openStage() {
  const canvas = new OffscreenCanvas(ACTIVE_WIDTH, ACTIVE_HEIGHT)
  const engine = await Engine.create(canvas as never)
  engine.pauseLoop()
  const bars = new Uint8Array(smpteBarsPixels().buffer.slice(0))

  return async (c: Case, at: readonly number[]) => {
    const def =
      c.preset === undefined ? undefined : PRESET_BY_NAME.get(c.preset)
    if (c.preset !== undefined && def === undefined) {
      throw new Error(`no preset named ${c.preset}`)
    }
    const base =
      def === undefined ? { ...DEFAULT_CONTROLS } : presetControls(def.patch)
    engine.setImagePixels(bars, ACTIVE_WIDTH, ACTIVE_HEIGHT)
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

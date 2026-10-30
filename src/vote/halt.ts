import type { FrozenKind } from '../core/gpu/renderloop'
import type { GpuFault } from '../ui/engineSupervisor'
import type { Fatal } from '../ui/FatalScreen'

// One canvas's engine as its supervisor last reported it.
export interface Side<E> {
  engine: E | null
  rebuilding: GpuFault | null
  frozen: FrozenKind | null
  fatal: Fatal | null
}

export const BOOTING: Side<never> = {
  engine: null,
  rebuilding: null,
  frozen: null,
  fatal: null,
}

// Why the canvases are not showing a live picture. While there is one, nothing
// on the page may record a judgement.
export type Halt =
  | { kind: 'fatal'; fatal: Fatal }
  | { kind: 'rebuilding'; fault: GpuFault }
  | { kind: 'frozen'; frozen: FrozenKind }

// Every halt across the sides, worst first.
export function haltsOf<E>(sides: readonly Side<E>[]): Halt[] {
  return [
    ...sides.flatMap(s =>
      s.fatal === null ? [] : [{ kind: 'fatal' as const, fatal: s.fatal }],
    ),
    ...sides.flatMap(s =>
      s.rebuilding === null
        ? []
        : [{ kind: 'rebuilding' as const, fault: s.rebuilding }],
    ),
    ...sides.flatMap(s =>
      s.frozen === null ? [] : [{ kind: 'frozen' as const, frozen: s.frozen }],
    ),
  ]
}

// Every engine, in canvas order, once all of them are presenting.
export function liveEngines<E>(sides: readonly Side<E>[]): E[] | null {
  const engines = sides.flatMap(s => (s.engine === null ? [] : [s.engine]))
  return haltsOf(sides).length === 0 && engines.length === sides.length
    ? engines
    : null
}

const HELD = 'Nothing is recorded until the picture is back.'

const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)

export function haltText(halt: Halt) {
  return halt.kind === 'fatal'
    ? halt.fatal.kind === 'unavailable'
      ? `WebGPU did not start. ${sentence(halt.fatal.body)} On Linux this page wants Firefox Nightly.`
      : `${sentence(halt.fatal.title)} ${sentence(halt.fatal.body)}`
    : halt.kind === 'rebuilding'
      ? `${halt.fault === 'hung' ? 'The GPU stopped responding' : 'The GPU device was lost'}, and a fresh one is starting. ${HELD}`
      : halt.frozen === 'cold'
        ? `This tab has not been given an animation frame since it loaded, and reloading lands in the same place. Open the page in a new tab. ${HELD}`
        : `The browser stopped painting this tab. ${HELD}`
}

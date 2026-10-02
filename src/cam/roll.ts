import { randomIndex } from '../core/rng'
import { MUTATE_AMOUNTS, mutate, spike, SPIKE_TARGETS } from '../ui/mutate'
import { PRESETS, needsSourceB, presetControls } from '../ui/presets'
import { rollPool, subtleLoop } from './looks'

import type { Controls } from '../core/controls'
import type { Rand } from '../core/rng'
import type { SliderDef } from '../ui/controls'
import type { Layers, Look, Shelf } from './looks'

export const ROLLS = ['look', 'stack', 'nudge', 'throw'] as const
export type Roll = (typeof ROLLS)[number]

export const DRAW_FROM = ['this tab', 'all tabs'] as const
export type DrawFrom = (typeof DRAW_FROM)[number]

export const WILDNESS = ['gentle', 'normal', 'wild'] as const
export type Wildness = (typeof WILDNESS)[number]

export interface RollSettings {
  from: DrawFrom
  wildness: Wildness
}

export const DEFAULT_SETTINGS: RollSettings = {
  from: 'this tab',
  wildness: 'normal',
}

export const ROLL_LABEL: Record<Roll, string> = {
  look: 'new look',
  stack: 'stack',
  nudge: 'nudge',
  throw: 'throw',
}

export const ROLL_ABOUT: Record<Roll, string> = {
  look: 'One look, dropped in whole.',
  stack: 'A look with others mixed in on top at random weights.',
  nudge: 'Every knob of the look moves a little.',
  throw: 'A few knobs of the look go a long way.',
}

const parse = <T extends string>(
  list: readonly T[],
  v: unknown,
  fallback: T,
): T => list.find(x => x === v) ?? fallback

// Stored settings back from `unknown`, with any field it does not recognise at
// its default.
export function parseSettings(v: unknown): RollSettings {
  const o = typeof v === 'object' && v !== null ? v : {}
  const get = (k: string): unknown => (k in o ? Reflect.get(o, k) : undefined)
  return {
    from: parse(DRAW_FROM, get('from'), DEFAULT_SETTINGS.from),
    wildness: parse(WILDNESS, get('wildness'), DEFAULT_SETTINGS.wildness),
  }
}

// Every look the camera can run without a second picture, from every family.
// Feedback loops keep to the subtle ones, as the loops tab does.
const EVERY_LOOK: readonly string[] = PRESETS.filter(
  p =>
    !needsSourceB(p) &&
    (p.group !== 'Feedback loops' || subtleLoop(presetControls(p.patch))),
).map(p => p.name)

const EVERY_LOOK_WITH_B: readonly string[] = PRESETS.filter(
  p => p.group !== 'Feedback loops' || subtleLoop(presetControls(p.patch)),
).map(p => p.name)

// What a roll draws its looks from: the tab's own families, or the whole set.
// The whole set takes in the looks that need a second picture only while B has
// one.
export function drawPool(
  shelf: Shelf,
  from: DrawFrom,
  withB: boolean,
): readonly string[] {
  if (from === 'this tab') return rollPool(shelf)
  return withB ? EVERY_LOOK_WITH_B : EVERY_LOOK
}

const LAYER_COUNT: Record<Wildness, number> = {
  gentle: 1,
  normal: 2,
  wild: 3,
}

const LAYER_WEIGHT = { min: 0.25, max: 0.75, step: 0.05 }

// A look at full strength with `count` more stacked on it at weights between
// a quarter and three quarters. A look is never drawn twice, and `current` is
// never the one that comes up.
export function rollStack(
  current: Look | null,
  pool: readonly string[],
  wildness: Wildness,
  rand: Rand = Math.random,
): { look: Look; layers: Layers } {
  const rest = pool.filter(name => name !== current?.name)
  const order = [...rest]
  const count = Math.min(LAYER_COUNT[wildness] + 1, order.length)
  for (let i = 0; i < count; i++) {
    const j = i + randomIndex(order.length - i, rand)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const [name, ...more] = order.slice(0, count)
  const span = (LAYER_WEIGHT.max - LAYER_WEIGHT.min) / LAYER_WEIGHT.step
  return {
    look: { name, strength: 1, rolled: true },
    layers: Object.fromEntries(
      more.map(layer => [
        layer,
        LAYER_WEIGHT.min + Math.round(rand() * span) * LAYER_WEIGHT.step,
      ]),
    ),
  }
}

// The knobs a nudge or a throw moves, as the tweaks the scene keeps: every
// control the roll changed, laid over the tweaks already there.
export function rollTweaks(
  board: Controls,
  tweaks: Partial<Controls>,
  knobs: readonly SliderDef[],
  kind: 'nudge' | 'throw',
  wildness: Wildness,
  rand: Rand = Math.random,
): Partial<Controls> {
  const next =
    kind === 'nudge'
      ? mutate(board, knobs, MUTATE_AMOUNTS[wildness], rand)
      : spike(board, knobs, SPIKE_TARGETS[wildness], rand)
  const changed = Object.fromEntries(
    knobs
      .filter(s => next[s.key] !== board[s.key])
      .map(s => [s.key, next[s.key]]),
  )
  return { ...tweaks, ...changed }
}

import { randomIndex } from '../core/rng'
import { MUTATE_AMOUNTS, mutate, spike, SPIKE_TARGETS } from '../ui/mutate'

import type { Controls } from '../core/controls'
import type { Rand } from '../core/rng'
import type { SliderDef } from '../ui/controls'
import type { Layers, Look } from './looks'

export const ROLLS = ['look', 'stack', 'nudge', 'throw'] as const
export type Roll = (typeof ROLLS)[number]

export type Wildness = 'gentle' | 'normal' | 'wild'

// What one press of the random chip does. With no look up there is nothing to
// stack on or nudge, so the press drops a new look in.
export function pickRoll(hasLook: boolean, rand: Rand = Math.random): Roll {
  return hasLook ? ROLLS[randomIndex(ROLLS.length, rand)] : 'look'
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

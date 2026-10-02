import { randomIndex } from '../core/rng'
import { MUTATE_AMOUNTS, mutate, spike, SPIKE_TARGETS } from '../ui/mutate'
import { PRESETS, needsSourceB, presetControls } from '../ui/presets'
import { rollPool, subtleLoop } from './looks'

import type { Controls } from '../core/controls'
import type { Rand } from '../core/rng'
import type { SliderDef } from '../ui/controls'
import type { Layers, Look, Shelf } from './looks'

export const DICE_KINDS = ['look', 'stack', 'nudge', 'throw'] as const
export type DiceKind = (typeof DICE_KINDS)[number]

export const DICE_REACHES = ['tab', 'every tab'] as const
export type DiceReach = (typeof DICE_REACHES)[number]

export const DICE_AMOUNTS = ['gentle', 'normal', 'wild'] as const
export type DiceAmount = (typeof DICE_AMOUNTS)[number]

export interface Dice {
  kind: DiceKind
  reach: DiceReach
  amount: DiceAmount
}

export const DEFAULT_DICE: Dice = {
  kind: 'look',
  reach: 'tab',
  amount: 'normal',
}

const KIND_ABOUT: Record<DiceKind, string> = {
  look: 'One look, dropped in whole.',
  stack: 'A look with others mixed in on top at random weights.',
  nudge: 'Every knob of the look moves a little.',
  throw: 'A few knobs of the look go a long way.',
}

const AMOUNT_ABOUT: Record<Exclude<DiceKind, 'look'>, string> = {
  stack: 'Gentle adds one look, normal two, wild three.',
  nudge: 'Gentle moves each knob 4% of its travel, normal 12%, wild 30%.',
  throw: 'Gentle throws one knob, normal two, wild four.',
}

export const diceAbout = (dice: Dice): string =>
  dice.kind === 'look'
    ? KIND_ABOUT.look
    : `${KIND_ABOUT[dice.kind]} ${AMOUNT_ABOUT[dice.kind]}`

export const usesReach = (kind: DiceKind) => kind === 'look' || kind === 'stack'
export const usesAmount = (kind: DiceKind) => kind !== 'look'

const parse = <T extends string>(
  list: readonly T[],
  v: unknown,
  fallback: T,
): T => list.find(x => x === v) ?? fallback

// A stored dice back from `unknown`, with any field it does not recognise at
// its default.
export function parseDice(v: unknown): Dice {
  const o = typeof v === 'object' && v !== null ? v : {}
  const get = (k: string): unknown => (k in o ? Reflect.get(o, k) : undefined)
  return {
    kind: parse(DICE_KINDS, get('kind'), DEFAULT_DICE.kind),
    reach: parse(DICE_REACHES, get('reach'), DEFAULT_DICE.reach),
    amount: parse(DICE_AMOUNTS, get('amount'), DEFAULT_DICE.amount),
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
export function dicePool(
  shelf: Shelf,
  reach: DiceReach,
  withB: boolean,
): readonly string[] {
  if (reach === 'tab') return rollPool(shelf)
  return withB ? EVERY_LOOK_WITH_B : EVERY_LOOK
}

const LAYER_COUNT: Record<DiceAmount, number> = {
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
  amount: DiceAmount,
  rand: Rand = Math.random,
): { look: Look; layers: Layers } {
  const rest = pool.filter(name => name !== current?.name)
  const order = [...rest]
  const count = Math.min(LAYER_COUNT[amount] + 1, order.length)
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
  amount: DiceAmount,
  rand: Rand = Math.random,
): Partial<Controls> {
  const next =
    kind === 'nudge'
      ? mutate(board, knobs, MUTATE_AMOUNTS[amount], rand)
      : spike(board, knobs, SPIKE_TARGETS[amount], rand)
  const changed = Object.fromEntries(
    knobs
      .filter(s => next[s.key] !== board[s.key])
      .map(s => [s.key, next[s.key]]),
  )
  return { ...tweaks, ...changed }
}

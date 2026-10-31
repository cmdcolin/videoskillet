import { pickOne } from '../core/rng'
import { TRANSITIONS } from '../ui/transitions'
import { OPENERS, SHELVES, rollLook, rollPool } from './looks'
import { rollStack } from './roll'

import type { Controls } from '../core/controls'
import type { Rand } from '../core/rng'
import type { Transition } from '../ui/transitions'
import type { Layers, Look } from './looks'

// Every look the camera page's dice reaches on any tab, with the openers.
export const COSTUME_POOL: readonly string[] = [
  ...new Set([...OPENERS, ...SHELVES.flatMap(rollPool)]),
]

// A change of acceleration between two motion samples, in m/s², that counts as
// a boop. A knock on the phone or its mount is a sharp spike, and walking or
// turning the head changes the reading slowly.
export const BOOP_JOLT = 8

// How long a boop is ignored after the last one landed, past its fault.
export const BOOP_REST_MS = 300

// The bass onset, 0..1 against the biggest onset of the last few seconds, that
// counts as a boop, and how long the sound waits before it may boop again.
export const SOUND_BOOP_HIT = 0.99
export const SOUND_REST_MS = 6000

export interface Accel {
  x: number
  y: number
  z: number
}

export const joltOf = (a: Accel, b: Accel) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

// The threshold a link asks for with `boop=`, or the default.
export function boopThreshold(search: string) {
  const n = Number(new URLSearchParams(search).get('boop'))
  return Number.isFinite(n) && n > 0 ? n : BOOP_JOLT
}

export const wantsCostume = (search: string) =>
  new URLSearchParams(search).has('costume')

// What one boop does: a fault from the deck, and a look that lands under it,
// half the time with two more stacked on it.
export function rollBoop(
  current: Look | null,
  rand: Rand = Math.random,
): { fault: Transition; look: Look; layers: Layers } {
  const fault = pickOne(TRANSITIONS, rand) ?? TRANSITIONS[0]!
  const stacked = rand() < 0.5
  return stacked
    ? { fault, ...rollStack(current, COSTUME_POOL, 'normal', rand) }
    : { fault, look: rollLook(current, COSTUME_POOL), layers: {} }
}

// The room's sound wired into the set the way bass smack wires it: each kick
// knocks vertical hold loose and pulls the supply down, and a loud passage
// tears the picture sideways. A look that already works these harder keeps its
// own settings.
export const roused = (c: Controls): Controls => ({
  ...c,
  audioRoll: Math.max(c.audioRoll, 6),
  audioTear: Math.max(c.audioTear, 200),
  audioLoad: Math.max(c.audioLoad, 2.2),
  audioSagUs: Math.max(c.audioSagUs, 32),
  hvRing: Math.max(c.hvRing, 0.5),
})

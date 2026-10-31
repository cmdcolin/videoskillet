import { pickOne } from '../core/rng'
import { PRESET_BY_NAME } from '../ui/presets'
import { TRANSITIONS } from '../ui/transitions'
import { OPENERS, SHELVES, rollLook, rollPool } from './looks'
import { rollStack } from './roll'

import type { Controls } from '../core/controls'
import type { Rand } from '../core/rng'
import type { Transition } from '../ui/transitions'
import type { Layers, Look } from './looks'

export const LEFT_OUT_GROUPS: ReadonlySet<string> = new Set(['Phosphor / CRT'])

const keeps = (name: string) => {
  const def = PRESET_BY_NAME.get(name)
  return def !== undefined && !LEFT_OUT_GROUPS.has(def.group)
}

// Every look the camera page's dice reaches on any tab, with the openers,
// leaving out the tube's phosphor and CRT looks.
export const COSTUME_POOL: readonly string[] = [
  ...new Set([...OPENERS, ...SHELVES.flatMap(rollPool)]),
].filter(keeps)

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

// What the chyron says while nobody is talking.
export const DEFAULT_SAY = 'TAKE ME TO YOUR LEADER'

// The longest the picture holds one look with no boop, in seconds. Each wait is
// drawn between AUTO_SHORTEST of this and all of it.
export const AUTO_S = 40
const AUTO_SHORTEST = 0.4

export interface CostumeSettings {
  // `boop=`: the knock threshold, m/s².
  threshold: number
  // `say=`: the chyron's words while it is quiet.
  say: string
  // `auto=`: the longest wait for a boop by itself, in seconds; 0 switches it
  // off.
  autoS: number
}

const positive = (raw: string | null, fallback: number) => {
  const n = Number(raw)
  return raw !== null && raw !== '' && Number.isFinite(n) && n >= 0
    ? n
    : fallback
}

export function costumeSettings(search: string): CostumeSettings {
  const q = new URLSearchParams(search)
  const say = (q.get('say') ?? '').trim()
  const threshold = positive(q.get('boop'), BOOP_JOLT)
  return {
    threshold: threshold > 0 ? threshold : BOOP_JOLT,
    say: say === '' ? DEFAULT_SAY : say.toUpperCase(),
    autoS: positive(q.get('auto'), AUTO_S),
  }
}

export const autoGapMs = (autoS: number, rand: Rand = Math.random) =>
  autoS * 1000 * (AUTO_SHORTEST + rand() * (1 - AUTO_SHORTEST))

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

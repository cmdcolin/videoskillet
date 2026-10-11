import { CONTROL_KEYS, DEFAULT_CONTROLS } from '../core/controls'
import { packControls } from '../ui/packed'
import { PRESET_BY_NAME } from '../ui/presets'
import { modParam, parseSessionParams, parseSet } from '../ui/urlParams'
import { MIX_MODES, mixesItself } from './looks'
import { PATTERNS } from './patterns'

import type { Controls } from '../core/controls'
import type { Layers, Look, Mix } from './looks'
import type { Pattern } from './patterns'
import type { Base } from './scene'

// What a link puts up: a look with its stack and its knobs, or a whole board in
// the app's own link format, and the pattern on B with the mixer's setting.
export interface CamLink {
  base: Base | null
  look: Look | null
  layers: Layers
  tweaks: Partial<Controls>
  mix: Mix | null
  b: Pattern | null
}

const BOARD_KEYS = ['p', 'set', 'preset']
const LINKED = 'linked look'

const weight = (raw: string | null): number => {
  const n = Number(raw ?? 1)
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : 1
}

// `search` is the link's parameters, from either half of the address.
export function readLink(search: string): CamLink | null {
  const q = new URLSearchParams(search)
  const b = PATTERNS.find(p => p === q.get('srcb')) ?? null
  const [mode, fader = null] = (q.get('mix') ?? '').split(':')
  const mixMode = MIX_MODES.find(m => m === mode)
  const mix =
    b === null || mixMode === undefined
      ? null
      : { mode: mixMode, fader: weight(fader) }
  const usable = (name: string) =>
    PRESET_BY_NAME.has(name) && (b !== null || !mixesItself(name))
  const named = q.get('look')
  if (named !== null || q.has('tweak')) {
    const layers: Record<string, number> = {}
    for (const pair of (q.get('stack') ?? '').split(',')) {
      const [name = '', w = null] = pair.split(':')
      if (usable(name) && name !== named) layers[name] = weight(w)
    }
    return {
      base: null,
      look:
        named !== null && usable(named)
          ? { name: named, strength: weight(q.get('w')), rolled: false }
          : null,
      layers,
      tweaks: parseSet(q.get('tweak') ?? ''),
      mix,
      b,
    }
  }
  if (BOARD_KEYS.some(k => q.has(k))) {
    const params = parseSessionParams(search)
    if (params.damaged) return null
    return {
      base: {
        name: q.get('name') ?? LINKED,
        controls: { ...DEFAULT_CONTROLS, ...params.controls },
        mod: params.mod ?? [],
      },
      look: null,
      layers: {},
      tweaks: {},
      mix,
      b,
    }
  }
  return null
}

const short = (v: number): string => String(+v.toFixed(6))

// The link's parameters for what is up, read back by `readLink`. Empty for the
// camera as it comes.
export function writeLink(
  scene: Omit<CamLink, 'b'>,
  b: Pattern | null,
): URLSearchParams {
  const q = new URLSearchParams()
  const { base, look, layers, tweaks, mix } = scene
  if (look === null && base !== null) {
    q.set('p', packControls({ ...base.controls, ...tweaks }))
    q.set('mod', modParam(base.mod))
    q.set('name', base.name)
  } else {
    if (look !== null) q.set('look', look.name)
    if (look !== null && look.strength !== 1) q.set('w', short(look.strength))
    const stack = Object.entries(layers).filter(([, w]) => w > 0)
    if (stack.length > 0)
      q.set('stack', stack.map(([n, w]) => `${n}:${short(w)}`).join(','))
    const set = CONTROL_KEYS.filter(k => tweaks[k] !== undefined).map(
      k => `${k}:${short(tweaks[k] ?? 0)}`,
    )
    if (set.length > 0) q.set('tweak', set.join(','))
  }
  if (b !== null && q.size > 0) {
    q.set('srcb', b)
    if (mix !== null) q.set('mix', `${mix.mode}:${short(mix.fader)}`)
  }
  return q
}

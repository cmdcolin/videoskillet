import { useRef, useState } from 'react'

import { lookKnobs, rollLook } from './looks'
import { pickRoll, rollStack, rollTweaks } from './roll'
import { CLEAN, boardOf, mixerOwned, without } from './scene'
import { banked, changesStep, restored } from './undo'

import type { ControlKey } from '../core/controls'
import type { Rand } from '../core/rng'
import type { Look, Mix } from './looks'
import type { Scene } from './scene'
import type { Step } from './undo'
import type { Board } from './useCamEngine'

// Where a scene goes once it changes. The board lands on the engine laid out
// for the part of the glass on show, and A holds a still while the chroma
// keyer is on.
export interface SceneOut {
  showBoard: (board: Board) => void
  slice: () => number
  holdA: (on: boolean) => void
}

// The camera page's scene and its undo history, with every change the page
// makes to it. The ref is what handlers read, since two can land before a
// render.
export function useScene(
  first: () => Scene,
  out: SceneOut,
  rand: Rand = Math.random,
) {
  const [scene, setScene] = useState(first)
  const ref = useRef(scene)
  const [past, setPast] = useState<readonly Step[]>([])
  const lastChange = useRef(0)

  const now = () => ref.current

  // The chroma keyer's fill fades its copies into a still of the camera, so A
  // holds a frame for as long as the keyer is on.
  const show = (next: Partial<Scene>) => {
    const keyed = ref.current.keyHue !== null
    const s = { ...ref.current, ...next }
    ref.current = s
    setScene(s)
    out.showBoard(boardOf(s, out.slice()))
    if (keyed !== (s.keyHue !== null)) out.holdA(!keyed)
  }

  const paint = (next: Partial<Scene>) => {
    const before = ref.current
    show(next)
    if (changesStep(before, ref.current)) {
      const at = performance.now()
      const sinceLast = at - lastChange.current
      lastChange.current = at
      setPast(p => banked(p, before, sinceLast))
    }
  }

  // Puts the last step back and hands it over, or undefined when there is
  // none.
  const undo = () => {
    const step = past.at(-1)
    if (step !== undefined) {
      lastChange.current = 0
      setPast(past.slice(0, -1))
      show(restored(ref.current, step))
    }
    return step
  }

  // A tap's aim and the knobs moved off a look last while that look stays up,
  // through a change of strength. A new look goes under whatever is stacked on
  // the old one; normal takes the stack off too.
  const land = (next: Look | null) => {
    const cur = ref.current
    const same =
      next !== null && cur.look !== null && next.name === cur.look.name
    paint(
      next === null
        ? CLEAN
        : {
            base: null,
            look: next,
            layers: without(cur.layers, next.name),
            hue: same ? cur.hue : null,
            tweaks: same ? cur.tweaks : {},
          },
    )
  }

  const pick = (name: string) =>
    paint({ ...CLEAN, look: { name, strength: 1, rolled: false } })

  // A chip dragged up mixes its preset in partway: as the look when nothing
  // is up, as the look's strength when it is the look, and stacked on the look
  // otherwise.
  const weigh = (name: string, w: number) => {
    const cur = ref.current
    if (cur.look === null) {
      paint({ ...CLEAN, look: { name, strength: w, rolled: false } })
    } else if (cur.look.name === name) {
      paint({ look: { ...cur.look, strength: w } })
    } else {
      const rest = without(cur.layers, name)
      paint({ layers: w > 0 ? { ...rest, [name]: w } : rest })
    }
  }

  // The tune sheet keeps a layer it drags to zero, so its row stays put.
  const layer = (name: string, w: number) =>
    paint({ layers: { ...ref.current.layers, [name]: w } })

  const drop = (name: string) =>
    paint({ layers: without(ref.current.layers, name) })

  const roll = (pool: readonly string[]) => {
    const cur = ref.current
    const kind = pickRoll(cur.look !== null, rand)
    if (kind === 'look') {
      land(rollLook(cur.look, pool, rand))
    } else if (kind === 'stack') {
      paint({
        ...rollStack(cur.look, pool, 'normal', rand),
        base: null,
        tweaks: {},
        hue: null,
      })
    } else {
      paint({
        tweaks: rollTweaks(
          boardOf(cur, out.slice()).controls,
          cur.tweaks,
          lookKnobs(cur.look, cur.layers),
          kind,
          'normal',
          rand,
        ),
      })
    }
  }

  const turnKnob = (key: ControlKey, value: number) =>
    paint({ tweaks: { ...ref.current.tweaks, [key]: value } })

  // Lets go of the knobs `keep` does not keep.
  const resetKnobs = (keep: (key: string) => boolean) =>
    paint({
      tweaks: Object.fromEntries(
        Object.entries(ref.current.tweaks).filter(([k]) => keep(k)),
      ),
    })

  // The mixer's own modes take the mixer back from a look that set it, and
  // from the chroma keyer.
  const mixWith = (mix: Mix | null) =>
    paint(
      mixerOwned(ref.current)
        ? { ...CLEAN, mix, keyHue: null }
        : { mix, keyHue: null },
    )

  // Throws the fader to the other end, while the mixer is the page's own.
  const throwFader = () => {
    const s = ref.current
    if (s.mix !== null && !mixerOwned(s)) {
      paint({ mix: { ...s.mix, fader: s.mix.fader < 0.5 ? 1 : 0 } })
    }
  }

  return {
    scene,
    now,
    canUndo: past.length > 0,
    paint,
    undo,
    land,
    pick,
    weigh,
    layer,
    drop,
    roll,
    turnKnob,
    resetKnobs,
    mixWith,
    throwFader,
  }
}

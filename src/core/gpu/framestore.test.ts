import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../controls'
import { FrameStore, keyFillOf } from './framestore'

import type { Controls } from '../controls'

const keyed = (patch: Partial<Controls>): Controls => ({
  ...DEFAULT_CONTROLS,
  bGenlock: 1,
  bGain: 1,
  bKey: 1,
  ...patch,
})

const run = (
  store: FrameStore,
  c: Controls,
  frames: number,
  from = 0,
  fresh: (f: number) => boolean = () => false,
): boolean[] =>
  Array.from(
    { length: frames },
    (_, i) => store.step(c, true, from + i, fresh(from + i)).records,
  )

describe('keyFillOf', () => {
  it('names the fill only while the genlocked keyer cuts', () => {
    expect(keyFillOf(keyed({ bKeyFill: 3 }), true)).toBe('freeze')
    expect(keyFillOf(keyed({ bKeyFill: 2 }), true)).toBe('loop')
    expect(keyFillOf(keyed({ bKeyFill: 2, bKey: 0 }), true)).toBeNull()
    expect(keyFillOf(keyed({ bKeyFill: 2, bGenlock: 0 }), true)).toBeNull()
    expect(keyFillOf(keyed({ bKeyFill: 2 }), false)).toBeNull()
  })
})

describe('FrameStore', () => {
  it('stays idle with the loop fader down and no loop fill', () => {
    expect(run(new FrameStore(), keyed({ bKeyFill: 0 }), 4)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })

  it('records every frame for a loop-bus fill with the fader at 0', () => {
    const c = keyed({ bKeyFill: 2, cfbMix: 0 })
    expect(run(new FrameStore(), c, 4)).toEqual([true, true, true, true])
  })

  it('keeps the strobe period for a loop-bus fill', () => {
    const c = keyed({ bKeyFill: 2, cfbHold: 2 })
    expect(run(new FrameStore(), c, 6)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
    ])
  })

  it('grabs one frame on selecting freeze and then holds it', () => {
    const store = new FrameStore()
    const freeze = keyed({ bKeyFill: 3, cfbMix: 0.6 })
    expect(run(store, keyed({ bKeyFill: 2 }), 2)).toEqual([true, true])
    expect(run(store, freeze, 4, 2)).toEqual([true, false, false, false])
    expect(run(store, keyed({ bKeyFill: 2 }), 1, 6)).toEqual([true])
    expect(run(store, freeze, 2, 7)).toEqual([true, false])
  })

  it('grabs again when a source shows a new picture during freeze', () => {
    const c = keyed({ bKeyFill: 3 })
    expect(run(new FrameStore(), c, 5, 0, f => f === 3)).toEqual([
      true,
      false,
      false,
      true,
      false,
    ])
  })

  it('shows the fill selected before on the frame freeze grabs', () => {
    const store = new FrameStore()
    const fills = (c: Controls, n: number, fresh = false) =>
      Array.from({ length: n }, () => store.step(c, true, 0, fresh).fill)
    expect(fills(keyed({ bKeyFill: 3 }), 2)).toEqual([0, 3])
    expect(fills(keyed({ bKeyFill: 2 }), 1)).toEqual([2])
    expect(fills(keyed({ bKeyFill: 3 }), 2)).toEqual([2, 3])
    expect(fills(keyed({ bKeyFill: 3 }), 1, true)).toEqual([0])
  })
})

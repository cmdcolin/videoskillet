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
): boolean[] =>
  Array.from(
    { length: frames },
    (_, i) => store.step(c, true, from + i).records,
  )

const settled = () => new FrameStore(false)

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
    expect(run(settled(), c, 6)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
    ])
  })

  it('grabs one frame on selecting freeze and then holds it', () => {
    const store = settled()
    const freeze = keyed({ bKeyFill: 3, cfbMix: 0.6 })
    expect(run(store, keyed({ bKeyFill: 2 }), 2)).toEqual([true, true])
    expect(run(store, freeze, 4, 2)).toEqual([true, false, false, false])
    expect(run(store, keyed({ bKeyFill: 2 }), 1, 6)).toEqual([true])
    expect(run(store, freeze, 2, 7)).toEqual([true, false])
  })

  it('tracks program A under freeze while the link loads', () => {
    const store = new FrameStore()
    const c = keyed({ bKeyFill: 3 })
    const frames = Array.from({ length: 3 }, () => store.step(c, true, 0))
    expect(frames).toEqual(
      Array.from({ length: 3 }, () => ({
        records: true,
        fill: 0,
        flip: false,
        cgBus: 0,
        cgFlip: false,
      })),
    )
  })

  it('tracks program A under a loop-bus fill while the link loads', () => {
    const store = new FrameStore()
    const c = keyed({ bKeyFill: 2, cfbHold: 2 })
    expect(Array.from({ length: 3 }, (_, i) => store.step(c, true, i))).toEqual(
      [
        { records: true, fill: 0, flip: false, cgBus: 0, cgFlip: false },
        { records: false, fill: 0, flip: false, cgBus: 0, cgFlip: false },
        { records: false, fill: 0, flip: false, cgBus: 0, cgFlip: false },
      ],
    )
    store.settle()
    run(store, c, 60, 3)
    expect(store.step(c, true, 64)).toEqual({
      records: false,
      fill: 2,
      flip: false,
      cgBus: 0,
      cgFlip: false,
    })
  })

  it('starts holding once the link has settled and no slot is busy', () => {
    const store = new FrameStore()
    const c = keyed({ bKeyFill: 3 })
    store.step(c, true, 0)
    store.settle()
    expect(store.step(c, true, 0, true).records).toBe(true)
    expect(run(store, c, 59).every(r => r)).toBe(true)
    expect(run(store, c, 3)).toEqual([false, false, false])
  })

  it('keeps a pending settle through a reset', () => {
    const store = new FrameStore()
    store.settle()
    run(store, keyed({ bKeyFill: 2 }), 30)
    const reset = store.restart()
    run(reset, keyed({ bKeyFill: 2 }), 60)
    expect(reset.loading).toBe(false)
  })

  it('carries a settled store through a reset', () => {
    const store = new FrameStore()
    store.settle()
    run(store, keyed({ bKeyFill: 3 }), 60)
    expect(new FrameStore(store.loading).loading).toBe(false)
  })

  it('flips the store on frames of the other phase from its last write', () => {
    const flips = (patch: Partial<Controls>) => {
      const store = settled()
      const c = keyed({ bKeyFill: 2, ...patch })
      return Array.from({ length: 7 }, (_, i) => store.step(c, true, i).flip)
    }
    expect(flips({ cfbHold: 3, bKeyFillFraming: 1 })).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ])
    expect(flips({ cfbHold: 4, bKeyFillFraming: 1 })).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      true,
    ])
    expect(flips({ cfbHold: 3 }).some(f => f)).toBe(false)
    expect(flips({ bKeyFill: 0, bKeyFillFraming: 1 }).some(f => f)).toBe(false)
  })

  it('shows the fill selected before on the frame freeze grabs', () => {
    const store = settled()
    const fills = (c: Controls, n: number) =>
      Array.from({ length: n }, () => store.step(c, true, 0).fill)
    expect(fills(keyed({ bKeyFill: 3 }), 2)).toEqual([0, 3])
    expect(fills(keyed({ bKeyFill: 2 }), 1)).toEqual([2])
    expect(fills(keyed({ bKeyFill: 3 }), 2)).toEqual([2, 3])
  })

  it('records for a chyron filled from the loop bus, colour framed', () => {
    const c = { ...DEFAULT_CONTROLS, cgMix: 1, cgFillFrom: 1 }
    const store = settled()
    const frames = Array.from({ length: 3 }, (_, i) => store.step(c, true, i))
    expect(frames.map(f => f.records)).toEqual([true, true, true])
    expect(frames.map(f => f.cgBus)).toEqual([2, 2, 2])
    expect(frames.map(f => f.cgFlip)).toEqual([false, true, true])
  })

  it('leaves the chyron on program while the link loads', () => {
    const c = { ...DEFAULT_CONTROLS, cgMix: 1, cgFillFrom: 1 }
    expect(new FrameStore().step(c, true, 0).cgBus).toBe(1)
  })

  it('leaves the chyron on its own characters with the fill on them', () => {
    const c = { ...DEFAULT_CONTROLS, cgMix: 1 }
    const step = settled().step(c, true, 0)
    expect(step.records).toBe(false)
    expect(step.cgBus).toBe(0)
  })
})

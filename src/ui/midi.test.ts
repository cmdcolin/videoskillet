import { afterEach, describe, expect, it, vi } from 'vitest'

import { wasSignedIn } from './cloud'
import { ALL_SLIDERS, sliderFor } from './controls'
import {
  ACTIONS,
  AUTOMAP_TARGETS,
  MOTION,
  actionLabel,
  controlOf,
  createMidi,
  cueDeckOf,
  fireSlotOf,
  fireTarget,
  hasCaught,
  jumpDeckOf,
  noteAction,
  parseAction,
  parseTarget,
  presetOf,
  presetTarget,
  readNote,
  spanFor,
  targetLabel,
} from './midi'
import { N_SLOTS } from './modSlots'

// A 0..1 control, so a knob step is 1/127 and the pickup window is 1/64.
const def = sliderFor('fbMix')

describe('hasCaught', () => {
  it('accepts the first message when nothing is on screen to catch', () => {
    expect(hasCaught(def, undefined, undefined, 0.9)).toBe(true)
  })

  it('accepts a knob that opens close to the on-screen value', () => {
    expect(hasCaught(def, 0.5, undefined, 0.51)).toBe(true)
  })

  it('rejects a knob that opens away from it', () => {
    expect(hasCaught(def, 0.5, undefined, 0.7)).toBe(false)
  })

  it('rejects movement that stays on one side', () => {
    expect(hasCaught(def, 0.5, 0.8, 0.7)).toBe(false)
    expect(hasCaught(def, 0.5, 0.2, 0.3)).toBe(false)
  })

  it('catches once the knob sweeps through, from either direction', () => {
    expect(hasCaught(def, 0.5, 0.8, 0.3)).toBe(true)
    expect(hasCaught(def, 0.5, 0.2, 0.7)).toBe(true)
  })

  it('catches when the knob lands exactly on the value', () => {
    expect(hasCaught(def, 0.5, 0.8, 0.5)).toBe(true)
  })
})

// A target is a string because it keys the stored map, so taking one apart is
// the one place a stale or hand-edited storage key can turn into a binding that
// drives the wrong thing — or into a crash at the call site that indexes it.
describe('bind targets', () => {
  it('tells the three kinds apart', () => {
    expect(controlOf('fbMix')).toBe('fbMix')
    expect(controlOf(MOTION)).toBe(null)
    expect(controlOf(presetTarget('vhs'))).toBe(null)

    expect(presetOf(presetTarget('vhs'))).toBe('vhs')
    expect(presetOf('fbMix')).toBe(null)
    expect(presetOf(MOTION)).toBe(null)
  })

  it('round-trips every kind through storage', () => {
    for (const t of ['fbMix', MOTION, presetTarget('rainbowStorm')])
      expect(parseTarget(t)).toBe(t)
  })

  it('drops a key that no longer names anything', () => {
    // A control renamed between versions, a preset retitled or dropped, and
    // near-misses of the two prefixes.
    expect(parseTarget('fbMixx')).toBe(null)
    expect(parseTarget('motionamount')).toBe(null)
    expect(parseTarget('presets')).toBe(null)
    expect(parseTarget('preset:')).toBe(null)
    expect(parseTarget(presetTarget('a look nobody shipped'))).toBe(null)
  })

  it('keeps a preset name whatever is in it', () => {
    // Names come from the table, not from a parser, so a space (or a colon, if
    // one ever landed in a name) survives rather than being read as structure.
    expect(presetOf(presetTarget('a: b'))).toBe('a: b')
    expect(parseTarget(presetTarget('rainbowStorm'))).toBe(
      presetTarget('rainbowStorm'),
    )
  })

  it('gives a control its own span and everything else a unit fader', () => {
    expect(spanFor('fbMix')).toEqual(sliderFor('fbMix'))
    expect(spanFor(MOTION)).toEqual({ min: 0, max: 1, step: 0.01 })
    expect(spanFor(presetTarget('vhs'))).toEqual({ min: 0, max: 1, step: 0.01 })
  })

  it('names each kind for the panel', () => {
    expect(targetLabel('fbMix')).toBe(sliderFor('fbMix').label)
    expect(targetLabel(MOTION)).toBe('motion amount')
    expect(targetLabel(presetTarget('vhs'))).toBe('vhs · preset')
  })
})

// The other family. An action is an edge rather than a value, so none of the
// span/takeover machinery above applies to one — what has to hold instead is
// that a stored id can always be taken back apart into the right verb, since a
// pad that fired the wrong deck's cue mid-set is not a bug you can debug live.
describe('note actions', () => {
  it('tells the four kinds apart', () => {
    expect(fireSlotOf(fireTarget(3))).toBe(3)
    // The whole bay is not a slot: it narrows to none of the three, which is
    // what useMidi's dispatch reads as "all of them".
    expect(fireSlotOf('fire')).toBe(null)
    expect(cueDeckOf('fire')).toBe(null)
    expect(jumpDeckOf('fire')).toBe(null)

    expect(cueDeckOf('cue:b')).toBe('b')
    expect(cueDeckOf('jump:b')).toBe(null)
    expect(jumpDeckOf('jump:a')).toBe('a')
    expect(jumpDeckOf('cue:a')).toBe(null)
    expect(fireSlotOf('cue:a')).toBe(null)
  })

  it('round-trips every action through storage', () => {
    for (const a of ACTIONS) expect(parseAction(a.target)).toBe(a.target)
  })

  it('drops a key that no longer names an action', () => {
    // A hand-edited entry, a bay that shrank, and near-misses of each prefix.
    expect(parseAction('fired')).toBe(null)
    expect(parseAction('fire:0')).toBe(null)
    expect(parseAction(fireTarget(N_SLOTS + 1))).toBe(null)
    expect(parseAction('fire:1.5')).toBe(null)
    expect(parseAction('cue:c')).toBe(null)
    expect(parseAction('jump:')).toBe(null)
  })

  it('offers one action per bay slot, and the whole bay', () => {
    // BAY_SLOTS is written in midi.ts rather than imported, because modSlots
    // reads SYNC_DIVISIONS out of midi and the import cannot go both ways. This
    // is what keeps the copy honest — the same arrangement STOCK_HOLD and
    // VIEW_KEYS have in controls.test.ts.
    const slots = ACTIONS.flatMap(a => {
      const n = fireSlotOf(a.target)
      return n === null ? [] : [n]
    })
    expect(slots).toEqual(Array.from({ length: N_SLOTS }, (_, i) => i + 1))
    expect(fireSlotOf(fireTarget(N_SLOTS + 1))).toBe(null)
  })

  it('names every action for the picker', () => {
    for (const a of ACTIONS) expect(actionLabel(a.target)).toBe(a.label)
    expect(new Set(ACTIONS.map(a => a.label)).size).toBe(ACTIONS.length)
  })
})

// The one condition that changes what every pad on the device does.
describe('readNote', () => {
  it('reads a Note On with its channel and velocity', () => {
    expect(readNote([0x93, 36, 127])).toEqual({
      on: true,
      channel: 3,
      note: 36,
      velocity: 1,
    })
  })

  it('reads a Note Off in both spellings', () => {
    expect(readNote([0x83, 36, 64])?.on).toBe(false)
    expect(readNote([0x93, 36, 0])?.on).toBe(false)
  })

  it('answers nothing for a knob or a clock tick', () => {
    expect(readNote([0xb0, 1, 64])).toBeNull()
    expect(readNote([0xf8])).toBeNull()
  })
})

describe('what a struck note fires', () => {
  it('fires the whole bay while nothing is bound', () => {
    expect(noteAction(undefined, false)).toBe('fire')
  })

  it('lifts the blanket as soon as one pad is bound', () => {
    expect(noteAction(undefined, true)).toBe(null)
  })

  it('runs the bound action either way', () => {
    // Including while the blanket would still be up, which cannot happen — a
    // bound note implies something is bound — but is the reading that would
    // silently swap the verb for `fire` if the fallback were written the other
    // way round.
    expect(noteAction('cue:b', true)).toBe('cue:b')
    expect(noteAction('cue:b', false)).toBe('cue:b')
  })
})

describe('the auto-map spine', () => {
  it('leads with the motion amount', () => {
    expect(AUTOMAP_TARGETS[0]).toBe(MOTION)
  })

  it('reaches every control exactly once', () => {
    const controls = AUTOMAP_TARGETS.flatMap(t => {
      const key = controlOf(t)
      return key === null ? [] : [key]
    })
    expect(new Set(controls).size).toBe(controls.length)
    expect(new Set(controls)).toEqual(new Set(ALL_SLIDERS.map(s => s.key)))
  })
})

// A browser with storage switched off — Safari's "block all cookies", a
// partitioned third-party frame — throws SecurityError from the `localStorage`
// getter rather than merely answering null. Both readers below run from a
// `useEffect` body, where a throw is raised during commit and takes the whole
// tree down, so neither may touch the global directly (see ui/storage.ts).
describe('a browser with storage switched off', () => {
  const hostile = () => {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError')
      },
    })
    return () => {
      if (had === undefined)
        delete (globalThis as { localStorage?: unknown }).localStorage
      else Object.defineProperty(globalThis, 'localStorage', had)
    }
  }

  it('still builds the MIDI manager', () => {
    const restore = hostile()
    try {
      expect(() =>
        createMidi({
          onControl: () => {},
          onStatus: () => {},
          onBindings: () => {},
          onArmed: () => {},
          onPickup: () => {},
          onAction: () => {},
          onActionEnd: () => {},
          onNotes: () => {},
          onArmedNote: () => {},
          onLearn: () => {},
          onTempo: () => {},
        }),
      ).not.toThrow()
    } finally {
      restore()
    }
  })

  it('still answers the signed-in hint', () => {
    const restore = hostile()
    try {
      expect(wasSignedIn()).toBe(false)
    } finally {
      restore()
    }
  })
})

describe('a manager destroyed before its grant arrives', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('wires nothing up when the grant lands', async () => {
    let grant: (m: unknown) => void = () => {}
    vi.stubGlobal('navigator', {
      requestMIDIAccess: () =>
        new Promise(r => {
          grant = r
        }),
    })
    const statuses: string[] = []
    const midi = createMidi({
      onControl: () => {},
      onStatus: s => statuses.push(s),
      onBindings: () => {},
      onArmed: () => {},
      onPickup: () => {},
      onAction: () => {},
      onActionEnd: () => {},
      onNotes: () => {},
      onArmedNote: () => {},
      onLearn: () => {},
      onTempo: () => {},
    })
    midi.enable()
    midi.destroy()
    const input: { onmidimessage: unknown } = { onmidimessage: null }
    const listen = vi.fn()
    grant({ inputs: new Map([['in', input]]), addEventListener: listen })
    await new Promise(r => setTimeout(r, 0))
    expect(input.onmidimessage).toBe(null)
    expect(listen).not.toHaveBeenCalled()
    expect(statuses).toEqual(['requesting'])
  })
})

describe('the MIDI clock', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // A main thread that stalls delivers the queued ticks in a burst, all handled
  // at one `performance.now()`. The tempo has to come off when each tick
  // arrived, which is the event's own stamp.
  it('reads tempo off the ticks’ own stamps, not when they were handled', async () => {
    const input: { onmidimessage: ((e: unknown) => void) | null } = {
      onmidimessage: null,
    }
    vi.stubGlobal('navigator', {
      requestMIDIAccess: () =>
        Promise.resolve({
          inputs: new Map([['in', input]]),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
    })
    vi.stubGlobal('performance', { now: () => 5000 })
    const tempos: (number | null)[] = []
    const midi = createMidi({
      onControl: () => {},
      onStatus: () => {},
      onBindings: () => {},
      onArmed: () => {},
      onPickup: () => {},
      onAction: () => {},
      onActionEnd: () => {},
      onNotes: () => {},
      onArmedNote: () => {},
      onLearn: () => {},
      onTempo: bpm => tempos.push(bpm),
    })
    midi.enable()
    await new Promise(r => setTimeout(r, 0))
    const perPulse = 60000 / (120 * 24)
    for (let i = 0; i < 12; i++) {
      input.onmidimessage?.({
        data: Uint8Array.from([0xf8]),
        timeStamp: 1000 + i * perPulse,
      })
    }
    midi.destroy()
    expect(tempos).toEqual([120])
  })
})

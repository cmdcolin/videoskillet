import { describe, expect, it } from 'vitest'

import {
  SHIPPED_B_MODES,
  SHIPPED_MODES,
  SOURCE_B_MODES,
  SOURCE_DESC,
  SOURCE_KIND,
  SOURCE_KIND_LABEL,
  SOURCE_KIND_ORDER,
  SOURCE_MODES,
  sourceOptions,
} from './modes'
import { MODE_ORIGIN, POOL_MODE_FOR, POOL_MODES } from './pools'

import type { SourceBMode, SourceKind, SourceMode } from './modes'

describe('source pickers', () => {
  // The kinds are a Record, so a mode with no kind cannot compile. What this
  // holds is the other half: a kind nobody put in the order would drop every
  // option filed under it out of the picker entirely, silently.
  it('offers every kind in a stated order', () => {
    const kinds = new Set<SourceKind>(Object.values(SOURCE_KIND))
    for (const kind of kinds) expect(SOURCE_KIND_ORDER).toContain(kind)
    expect(new Set(SOURCE_KIND_ORDER).size).toBe(SOURCE_KIND_ORDER.length)
  })

  it('names every kind it labels', () => {
    for (const kind of SOURCE_KIND_ORDER)
      expect(Object.hasOwn(SOURCE_KIND_LABEL, kind)).toBe(true)
  })

  // Banding reorders the list, so this is the check that it only reorders: every
  // mode offered still reaches the picker, exactly once, with the label it had.
  it.each([
    ['A', SOURCE_MODES],
    ['B', SOURCE_B_MODES],
  ])(
    'keeps every %s mode exactly once, relabelled by nobody',
    (_slot, modes) => {
      const options = sourceOptions(modes)
      expect(options.map(o => o.value).toSorted()).toEqual(
        [...modes].toSorted(),
      )
      for (const o of options) expect(o.label).toBe(SOURCE_DESC[o.value])
    },
  )

  // A band is a run of consecutive options: SelectRow builds its <optgroup>s by
  // walking the array and starting a new one whenever the heading changes, so a
  // kind whose options were split across the list would render as two headings
  // with the same name.
  it('keeps each band contiguous', () => {
    for (const modes of [SOURCE_MODES, SOURCE_B_MODES]) {
      const groups = sourceOptions(modes).map(o => o.group)
      const runs = groups.filter((g, i) => i === 0 || g !== groups[i - 1])
      expect(new Set(runs).size).toBe(runs.length)
    }
  })

  // The production build drops YouTube, and B has no webcam. Neither may leave a
  // heading standing over nothing — an empty <optgroup> is a dead row in the list.
  it('drops a band the caller has nothing left in', () => {
    // No cast: `sourceOptions` is generic over `readonly T[]`, so the filtered
    // array satisfies it as it stands. The cast that used to be here asserted a
    // 14-element tuple from a filter that returns fewer by construction, which
    // is what the test is about — TypeScript called it "may be a mistake" and
    // nothing was listening, because test files were excluded from the build.
    const noLive = SOURCE_MODES.filter(m => SOURCE_KIND[m] !== 'live')
    const groups = sourceOptions(noLive).map(o => o.group)
    expect(groups).not.toContain(SOURCE_KIND_LABEL.live)
    // ...and the bands that survive are unaffected.
    expect(groups).toContain(SOURCE_KIND_LABEL.pattern)
  })

  // Both decks offer both live inputs. B's live band used to hold the screen
  // share alone, and nothing about the signal path was making it so — the camera
  // was A's from the first commit and stayed that way because the picker, the
  // device state and the deinterlace had all been written to one deck. Pinned in
  // both directions, since "B has a camera too" is exactly the kind of fact a
  // deck-specific path added later would take back without anything noticing.
  it('offers both decks the same live band', () => {
    const live = (modes: readonly (SourceMode | SourceBMode)[]) =>
      sourceOptions(modes)
        .filter(o => o.group === SOURCE_KIND_LABEL.live)
        .map(o => o.value)
    expect(live(SOURCE_B_MODES)).toEqual(['webcam', 'screen'])
    expect(live(SOURCE_MODES)).toEqual(live(SOURCE_B_MODES))
  })

  it('puts B’s off switch above every band, unheaded', () => {
    const options = sourceOptions(SOURCE_B_MODES)
    expect(options[0].value).toBe('none')
    expect(options[0].group).toBe(null)
    expect(options.filter(o => o.group === null)).toHaveLength(1)
  })
})

// The two pool tables have to stay inverses. Nothing in the type system says so
// — both are plain records over closed unions, and each is exhaustive on its own
// — so a third pool added to one and forgotten in the other typechecks perfectly
// and rolls the wrong archive at runtime.
describe('the pool tables', () => {
  it('pair every mode with an origin and back again', () => {
    for (const mode of POOL_MODES) {
      expect(POOL_MODE_FOR[MODE_ORIGIN[mode]]).toBe(mode)
    }
  })

  it('cover every origin exactly once', () => {
    const origins = POOL_MODES.map(m => MODE_ORIGIN[m])
    expect(new Set(origins).size).toBe(POOL_MODES.length)
    expect(Object.keys(POOL_MODE_FOR).toSorted()).toEqual(origins.toSorted())
  })
})

// The shipped lists feed docs/EFFECTS.md (scripts/docgen.mjs), so a mode
// added to a picker and forgotten here would ship a page that under-describes
// the app — the same class of drift the generated page exists to end. The
// webcam assertion is the one the hand-written page actually got wrong: it said
// either deck takes one.
describe('the shipped mode lists', () => {
  it('are the full lists minus the dev-only YouTube bridge', () => {
    expect(SHIPPED_MODES).toEqual(SOURCE_MODES.filter(m => m !== 'youtube'))
    expect(SHIPPED_B_MODES).toEqual(SOURCE_B_MODES.filter(m => m !== 'youtube'))
  })

  // Widened to string before the diff: the two lists are closed unions with no
  // member in common at the type level, so `includes` on either rejects the
  // other's entries outright — which is the answer to a question nobody asked
  // here, since the point is to compare them as data.
  it('differ by the off switch on B, and nothing else', () => {
    const a: string[] = [...SHIPPED_MODES]
    const b: string[] = [...SHIPPED_B_MODES]

    expect(a.filter(m => !b.includes(m))).toEqual([])
    expect(b.filter(m => !a.includes(m))).toEqual(['none'])
  })

  it('describe every mode they offer, since the page prints the description', () => {
    for (const mode of SHIPPED_MODES) {
      expect(SOURCE_DESC[mode]).toBeTruthy()
    }
  })
})

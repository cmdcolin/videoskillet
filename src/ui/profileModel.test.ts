import { describe, expect, it } from 'vitest'

import {
  PROFILE_NAME_MAX,
  PROFILE_SLOTS,
  cleanProfileName,
  markOpened,
  profileAtSlot,
  readCurrent,
  readProfiles,
  removeProfile,
  suggestProfileName,
  upsertProfile,
} from './profileModel'

const p = (name: string, query = 'set=') => ({ name, query })

describe('profile names', () => {
  it('collapses the whitespace a paste brings with it', () => {
    expect(cleanProfileName('  worn   tape\n')).toBe('worn tape')
  })

  it('caps the length rather than refusing a long one', () => {
    const long = cleanProfileName('x'.repeat(200))
    expect(long).toHaveLength(PROFILE_NAME_MAX)
  })

  it('reads a name of nothing but spaces as no name', () => {
    expect(cleanProfileName('   ')).toBe('')
  })
})

describe('profile store', () => {
  it('drops stored entries of the wrong shape rather than throwing', () => {
    expect(
      readProfiles([
        p('keep'),
        null,
        'nope',
        { name: 'no query' },
        { name: 7, query: 'set=' },
        { name: '  ', query: 'set=' },
      ]),
    ).toEqual([p('keep')])
  })

  it('appends a new look and overwrites an existing name in place', () => {
    const looks = [p('a'), p('b'), p('c')]
    expect(upsertProfile(looks, 'd', 'set=x').map(l => l.name)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
    const over = upsertProfile(looks, 'b', 'set=x')
    expect(over.map(l => l.name)).toEqual(['a', 'b', 'c'])
    expect(over[1].query).toBe('set=x')
  })

  it('matches an overwrite against the cleaned name', () => {
    expect(upsertProfile([p('worn tape')], ' worn  tape ', 'set=x')).toEqual([
      p('worn tape', 'set=x'),
    ])
  })

  it('declines to save under no name at all', () => {
    expect(upsertProfile([p('a')], '  ', 'set=x')).toEqual([p('a')])
  })

  it('removes by name', () => {
    expect(removeProfile([p('a'), p('b')], 'a')).toEqual([p('b')])
  })
})

describe('profile metadata', () => {
  it('mints an id on the first stamped save and keeps it on an overwrite', () => {
    const first = upsertProfile([], 'a', 'set=1', 1000)
    expect(first[0].id).toMatch(/^[a-z0-9]+$/)
    expect(first[0].savedAt).toBe(1000)
    const again = upsertProfile(first, 'a', 'set=2', 2000)
    expect(again[0].id).toBe(first[0].id)
    expect(again[0].savedAt).toBe(2000)
  })

  it('gives two profiles ids of their own', () => {
    const two = upsertProfile(upsertProfile([], 'a', 'q', 1), 'b', 'q', 2)
    expect(two[0].id).not.toBe(two[1].id)
  })

  it('stamps nothing when the caller has no clock', () => {
    expect(upsertProfile([], 'a', 'set=1')[0]).toEqual(p('a', 'set=1'))
  })

  it('carries openedAt through an overwrite', () => {
    const opened = markOpened(upsertProfile([], 'a', 'set=1', 1000), 'a', 1500)
    expect(upsertProfile(opened, 'a', 'set=2', 2000)[0].openedAt).toBe(1500)
  })

  it('marks only the profile that was opened', () => {
    const two = [p('a'), p('b')]
    const after = markOpened(two, 'b', 99)
    expect(after[0].openedAt).toBeUndefined()
    expect(after[1].openedAt).toBe(99)
  })

  it('keeps the metadata a stored entry carries and drops the rest', () => {
    expect(
      readProfiles([
        { name: 'a', query: 'q', id: 'x1', savedAt: 5, openedAt: 6 },
        { name: 'b', query: 'q', id: 7, savedAt: 'soon', openedAt: null },
      ]),
    ).toEqual([
      { name: 'a', query: 'q', id: 'x1', savedAt: 5, openedAt: 6 },
      p('b', 'q'),
    ])
  })
})

describe('the current session', () => {
  it('reads a session with both fields', () => {
    expect(readCurrent({ query: 'set=1', at: 9 })).toEqual({
      query: 'set=1',
      at: 9,
    })
  })

  it('reads anything else as no session', () => {
    expect(readCurrent(null)).toBeNull()
    expect(readCurrent('set=1')).toBeNull()
    expect(readCurrent({ query: 'set=1' })).toBeNull()
    expect(readCurrent({ query: 7, at: 9 })).toBeNull()
    expect(readCurrent({ query: 'set=1', at: Number.NaN })).toBeNull()
  })
})

describe('name suggestions', () => {
  it('offers the board’s own name while it is free', () => {
    expect(suggestProfileName([p('vhs')], 'betamax')).toBe('betamax')
  })

  it('counts up only once the name is taken', () => {
    expect(suggestProfileName([p('vhs')], 'vhs')).toBe('vhs 2')
    expect(suggestProfileName([p('vhs'), p('vhs 2')], 'vhs')).toBe('vhs 3')
  })

  it('falls back to a plain word for a board with no name', () => {
    expect(suggestProfileName([], '')).toBe('my look')
    expect(suggestProfileName([p('my look')], '')).toBe('my look 2')
  })
})

describe('number-key slots', () => {
  const many = Array.from({ length: 12 }, (_, i) => p(`look ${i + 1}`))

  it('reads the slot off the position in the list, 1-based', () => {
    expect(profileAtSlot(many, 1)).toEqual(p('look 1'))
    expect(profileAtSlot(many, 9)).toEqual(p('look 9'))
  })

  it('stops at the ninth, because there is no tenth digit', () => {
    expect(profileAtSlot(many, PROFILE_SLOTS + 1)).toBeUndefined()
  })

  it('has nothing on a slot the library has not reached', () => {
    expect(profileAtSlot([p('a')], 2)).toBeUndefined()
    expect(profileAtSlot([], 1)).toBeUndefined()
  })

  it('refuses a slot below the first, so key 0 finds nothing', () => {
    expect(profileAtSlot(many, 0)).toBeUndefined()
  })

  // The drift the guide promises: position is the binding, so a delete moves
  // every profile under it up one key. A re-save must not, which is what
  // upsertProfile's in-place overwrite is for.
  it('shifts bindings up on a delete and holds them across a re-save', () => {
    const three = [p('a'), p('b'), p('c')]
    expect(profileAtSlot(removeProfile(three, 'b'), 2)).toEqual(p('c'))
    const resaved = upsertProfile(three, 'a', 'set=hHold%3A0.4')
    expect(profileAtSlot(resaved, 1)?.query).toBe('set=hHold%3A0.4')
    expect(profileAtSlot(resaved, 2)).toEqual(p('b'))
  })
})

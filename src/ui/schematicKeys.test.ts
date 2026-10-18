import { describe, expect, it } from 'vitest'

import { GROUPS } from './controls'
import { SCHEMATICS } from './schematicKeys'

describe.each(SCHEMATICS)('schematic for $group', schematic => {
  const boxed: string[] = Object.values(schematic.opens).flat()

  it('registers a group that exists', () => {
    expect(GROUPS.map(g => g.name)).toContain(schematic.group)
  })

  it('opens every registered key from some box and no other', () => {
    expect(new Set(boxed)).toEqual(new Set(schematic.keys))
  })

  it('opens each key from one box only', () => {
    const twice = boxed.filter((key, i) => boxed.indexOf(key) !== i)
    expect(twice).toEqual([])
  })

  it('registers only keys of its own group', () => {
    const group = GROUPS.find(g => g.name === schematic.group)
    const own = new Set<string>(group?.sliders.map(s => s.key))
    expect(schematic.keys.filter(key => !own.has(key))).toEqual([])
  })
})

it('registers each schematic group once', () => {
  const names = SCHEMATICS.map(s => s.group)
  expect(new Set(names).size).toBe(names.length)
})

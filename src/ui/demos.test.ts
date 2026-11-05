import { describe, expect, it } from 'vitest'

import demos from '../../demos.json'
import { DEMOS } from './demos'

import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'

describe('the demos dialog', () => {
  it('has a still on disk for every demo', () => {
    for (const d of DEMOS)
      expect(
        existsSync(join('public', 'demos', basename(d.still))),
        d.name,
      ).toBe(true)
  })

  it('lists every gallery demo, the showcase ones first', () => {
    const gallery = demos.filter(d => d.gallery)
    expect(DEMOS.length).toBe(gallery.length)
    const showcase = gallery.filter(d => d.showcase).map(d => d.name)
    expect(DEMOS.slice(0, showcase.length).map(d => d.name)).toEqual(showcase)
  })
})

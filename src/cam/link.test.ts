import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import { readLink, writeLink } from './link'
import { MIX_SHELF } from './looks'

import type { CamLink } from './link'

import { readFileSync } from 'node:fs'

const BLANK = { base: null, look: null, layers: {}, tweaks: {}, mix: null }
const roundTrip = (link: CamLink) =>
  readLink(`?${writeLink(link, link.b).toString()}`)

describe('a camera link', () => {
  it('carries a look with its strength, its stack, its knobs and B', () => {
    const link: CamLink = {
      ...BLANK,
      look: { name: 'pictureSearch', strength: 0.6, rolled: false },
      layers: { trackingBand: 0.42 },
      tweaks: { fbMix: 0.3 },
      mix: { mode: 'wipe', fader: 0.25 },
      b: 'tv static',
    }
    expect(roundTrip(link)).toEqual(link)
  })

  it('opens a rolled look as the named look it is', () => {
    const got = roundTrip({
      ...BLANK,
      look: { name: 'runaway', strength: 1, rolled: true },
      b: null,
    })
    expect(got?.look).toEqual({ name: 'runaway', strength: 1, rolled: false })
  })

  it('is empty for the camera as it comes', () => {
    expect(writeLink(BLANK, 'bars').size).toBe(0)
    expect(readLink('')).toBeNull()
  })

  it('drops a name that is no preset, and a mix look while B is empty', () => {
    const mixLook = MIX_SHELF.looks[0]
    const got = readLink(`?look=noSuchLook&stack=${mixLook}:0.5,runaway:2`)
    expect(got?.look).toBeNull()
    expect(got?.layers).toEqual({ runaway: 1 })
    expect(readLink(`?look=${mixLook}&srcb=bars`)?.look?.name).toBe(mixLook)
  })

  it('opens every gallery demo as a board, with its pattern on B', () => {
    const demos: { name: string; query: string; gallery: boolean }[] =
      JSON.parse(readFileSync('demos.json', 'utf8'))
    for (const demo of demos.filter(d => d.gallery)) {
      const got = readLink(`?${demo.query.slice(1)}&name=x`)
      expect(got?.base, demo.name).not.toBeNull()
      expect(got?.base?.name).toBe('x')
    }
    const chaos = demos.find(d => d.name.startsWith('Chaos'))
    expect(readLink(chaos?.query ?? '')?.b).toBe('tv static')
  })

  it('carries a linked board and the knobs moved on it', () => {
    const link: CamLink = {
      ...BLANK,
      base: {
        name: 'Laser duck',
        controls: { ...DEFAULT_CONTROLS, fbMix: 0.5 },
        mod: [],
      },
      tweaks: { fbGain: 0.9 },
      b: null,
    }
    const got = roundTrip(link)
    expect(got?.base?.name).toBe('Laser duck')
    expect(got?.base?.controls.fbMix).toBe(0.5)
    expect(got?.base?.controls.fbGain).toBe(0.9)
  })

  it('ignores a packed board whose seal does not match', () => {
    const p = writeLink(
      {
        ...BLANK,
        base: {
          name: 'x',
          controls: { ...DEFAULT_CONTROLS, fbMix: 0.5 },
          mod: [],
        },
      },
      null,
    ).get('p')
    expect(readLink(`?p=${p?.slice(0, -2)}`)).toBeNull()
  })
})

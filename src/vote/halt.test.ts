import { describe, expect, it } from 'vitest'

import { BOOTING, haltText, haltsOf, liveEngines } from './halt'

import type { Fatal } from '../ui/FatalScreen'
import type { Side } from './halt'

const up = (engine: string): Side<string> => ({ ...BOOTING, engine })

const lost: Fatal = {
  title: 'WebGPU device lost',
  body: 'The GPU device was replaced 3 times and kept going away',
  kind: 'lost',
}

describe('haltsOf', () => {
  it('is empty while every side is healthy, booted or not', () => {
    expect(haltsOf([up('a'), BOOTING])).toEqual([])
  })

  it('puts a fatal side before a rebuild and a rebuild before a freeze', () => {
    expect(
      haltsOf([
        { ...up('a'), frozen: 'stalled' },
        { ...up('b'), rebuilding: 'lost' },
        { ...BOOTING, fatal: lost },
      ]),
    ).toEqual([
      { kind: 'fatal', fatal: lost },
      { kind: 'rebuilding', fault: 'lost' },
      { kind: 'frozen', frozen: 'stalled' },
    ])
  })
})

describe('liveEngines', () => {
  it('is every engine in canvas order once all are up', () => {
    expect(liveEngines([up('a'), up('b')])).toEqual(['a', 'b'])
  })

  it('is null while any side is still booting', () => {
    expect(liveEngines([up('a'), BOOTING])).toBeNull()
  })

  it('is null while any side is rebuilding, frozen or fatal', () => {
    expect(
      liveEngines([up('a'), { ...up('b'), rebuilding: 'hung' }]),
    ).toBeNull()
    expect(liveEngines([up('a'), { ...up('b'), frozen: 'cold' }])).toBeNull()
    expect(liveEngines([up('a'), { ...up('b'), fatal: lost }])).toBeNull()
  })
})

describe('haltText', () => {
  it('says the picture is held while a device is being replaced', () => {
    expect(haltText({ kind: 'rebuilding', fault: 'hung' })).toMatch(
      /^The GPU stopped responding.*Nothing is recorded/,
    )
    expect(haltText({ kind: 'rebuilding', fault: 'lost' })).toMatch(
      /^The GPU device was lost/,
    )
  })

  it('ends each part of a fatal message with one full stop', () => {
    expect(haltText({ kind: 'fatal', fatal: lost })).toBe(
      'WebGPU device lost. The GPU device was replaced 3 times and kept going away.',
    )
    expect(
      haltText({
        kind: 'fatal',
        fatal: { title: 't', body: 'No adapter.', kind: 'unavailable' },
      }),
    ).toBe(
      'WebGPU did not start. No adapter. On Linux this page wants Firefox Nightly.',
    )
  })
})

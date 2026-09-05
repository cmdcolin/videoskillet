import { describe, expect, it } from 'vitest'

import { SLIDER_BY_KEY } from './controls'
import { score, splitTail, tailTarget } from './paletteQuery'

import type { SliderDef } from './controls'

const slider = (key: string): SliderDef => {
  const def = SLIDER_BY_KEY.get(key as never)
  if (def === undefined) throw new Error(`no slider ${key}`)
  return def
}

describe('splitTail', () => {
  it('leaves a one-word query whole', () => {
    expect(splitTail('vhs')).toEqual({ head: 'vhs', tail: '' })
  })

  it('takes the last word off', () => {
    expect(splitTail('head switch 9')).toEqual({
      head: 'head switch',
      tail: '9',
    })
  })

  it('reads a trailing space as an empty tail', () => {
    expect(splitTail('noise ')).toEqual({ head: 'noise', tail: '' })
  })
})

describe('tailTarget', () => {
  const noise = slider('noiseIre')
  const mix = slider('synthMix')

  it('says nothing without a tail', () => {
    expect(tailTarget(noise, '')).toBe(null)
  })

  it('reads a number onto the step grid', () => {
    expect(tailTarget(noise, '9')).toBe(9)
    expect(tailTarget(noise, '1.5')).toBe(1.5)
  })

  it('reads a negative one', () => {
    const delay = slider('capYcDelayNs')
    expect(tailTarget(delay, '-40')).toBe(-40)
  })

  // The same thing dragging past the end does, rather than a refusal the row
  // would have to explain.
  it('clamps an out-of-range ask to the end of the track', () => {
    expect(tailTarget(noise, '9999')).toBe(noise.max)
    expect(tailTarget(noise, '-9999')).toBe(noise.min)
  })

  it('ignores a word on a continuous control', () => {
    expect(tailTarget(noise, 'lots')).toBe(null)
  })

  it('picks a mode by the start of its name', () => {
    expect(mix.choices).toEqual(['osc A', 'sum', 'ring mod', 'comparator'])
    expect(tailTarget(mix, 'ring')).toBe(2)
    expect(tailTarget(mix, 'comparator')).toBe(3)
  })

  it('still takes a mode by number', () => {
    expect(tailTarget(mix, '3')).toBe(3)
  })

  it('says nothing for a mode it does not have', () => {
    expect(tailTarget(mix, 'chorus')).toBe(null)
  })
})

describe('score', () => {
  // The whole reason this moved out of the component. Two controls answer to
  // "noise"; before an exact name won outright, the tie fell to whichever the
  // group walk reached first, and `noise 12` set the bandwidth of the noise
  // generator while reporting the number it had been asked for.
  it('puts an exact name above a longer one that starts with it', () => {
    expect(score('noise', 'noise', '')).toBeGreaterThan(
      score('noise', 'noise bandwidth', ''),
    )
  })

  it('ranks an earlier hit in a name above a later one', () => {
    expect(score('switch', 'switch noise', '')).toBeGreaterThan(
      score('switch', 'head switch', ''),
    )
  })

  it('puts any name hit above any prose hit', () => {
    expect(score('vhs', 'a name with vhs late in it', '')).toBeGreaterThan(
      score('vhs', 'nothing', 'vhs right at the front of the prose'),
    )
  })

  it('reports a miss as negative', () => {
    expect(score('nothing at all', 'noise', 'tape')).toBeLessThan(0)
  })
})

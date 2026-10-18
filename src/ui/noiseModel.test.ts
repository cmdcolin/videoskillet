import { describe, expect, it } from 'vitest'

import { LINES } from '../core/signal/constants'
import {
  arcMarks,
  colourBandGain,
  floorGain,
  ignitionMarks,
  strikeSlab,
} from './noiseModel'

describe('floorGain', () => {
  it('holds the RF floor at DC and nulls it at the top of the band', () => {
    expect(floorGain(0, 0)).toBeCloseTo(1.633, 2)
    expect(floorGain(0, 7.159e6)).toBeLessThan(0.01)
  })

  it('nulls the FM floor at DC and rises toward the top of the band', () => {
    expect(floorGain(1, 0)).toBeLessThan(0.01)
    expect(floorGain(1, 3.58e6)).toBeGreaterThan(floorGain(1, 1e6))
  })
})

describe('colourBandGain', () => {
  it('puts more of the FM floor into the colour band than the RF floor', () => {
    expect(colourBandGain(1)).toBeGreaterThan(colourBandGain(0))
  })
})

describe('ignitionMarks', () => {
  it('draws nothing with the train off', () => {
    expect(ignitionMarks(0)).toEqual([])
  })

  it('fires about once per 7.9 lines at 2000 Hz', () => {
    const marks = ignitionMarks(2000)
    expect(marks.length).toBeGreaterThan(60)
    expect(marks.length).toBeLessThan(75)
  })
})

describe('arcMarks', () => {
  it('draws nothing at zero a frame', () => {
    expect(arcMarks(0, 0)).toEqual([])
  })

  it('stays on the raster', () => {
    for (const m of arcMarks(24, 1)) {
      expect(m.row).toBeGreaterThanOrEqual(0)
      expect(m.row).toBeLessThan(LINES)
      expect(m.x1).toBeGreaterThanOrEqual(m.x0)
    }
  })

  it('moves the arcs when the dimmer lock closes', () => {
    expect(arcMarks(24, 1)).not.toEqual(arcMarks(24, 0))
  })
})

describe('strikeSlab', () => {
  it('appears only when strikes are on', () => {
    expect(strikeSlab(0)).toBeNull()
    expect(strikeSlab(1)?.rows).toBeGreaterThanOrEqual(6)
  })
})

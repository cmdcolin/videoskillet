import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTROLS } from '../core/controls'
import {
  cameraLap,
  cameraLapGains,
  cameraLapReading,
  cameraLoopOf,
  type CameraLoop,
} from './cameraLap'

const bare: CameraLoop = {
  mix: 0.8,
  gain: 1.2,
  black: 0,
  knee: 0,
  cutoff: 0,
  gamma: 1,
  bloom: 0,
  halation: 0,
  glow: 0,
}

describe('camera loop gain per lap', () => {
  it('is the fader times the exposure on a bare tube and a hard clip', () => {
    expect(cameraLapGains(bare, [0.1, 0.4, 0.8])).toEqual([
      expect.closeTo(0.96, 6),
      expect.closeTo(0.96, 6),
      expect.closeTo(0.96, 6),
    ])
  })

  it('clips at full well with the knee at 0', () => {
    expect(cameraLap(bare, 0.9)).toBeCloseTo(0.8, 6)
  })

  it('passes nothing below the beam cutoff', () => {
    expect(cameraLap({ ...bare, cutoff: 0.4 }, 0.3)).toBe(0)
  })

  it('gives bright levels more gain than dim ones under gun gamma', () => {
    const [dim, bright] = cameraLapGains({ ...bare, gamma: 2 }, [0.2, 0.8])
    expect(bright! / dim!).toBeCloseTo(4, 1)
  })

  it('rolls highlights into a shoulder that never reaches clip', () => {
    const soft = { ...bare, gain: 3, knee: 1 }
    expect(cameraLap(soft, 0.9)).toBeLessThan(0.8)
    expect(cameraLap(soft, 0.9)).toBeGreaterThan(cameraLap(soft, 0.5))
  })

  it('brings the stock face and camera just under unity at mid grey', () => {
    const stock = { ...cameraLoopOf(DEFAULT_CONTROLS), mix: 1 }
    const [g] = cameraLapGains(stock, [0.5])
    expect(g).toBeGreaterThan(0.95)
    expect(g).toBeLessThan(1)
  })

  it('settles a loop above unity where the shoulder brings it back to 1', () => {
    const building = { ...cameraLoopOf(DEFAULT_CONTROLS), mix: 0.8, gain: 1.6 }
    const read = cameraLapReading(building)
    expect(read.gain).toBeGreaterThan(1.2)
    expect(read.settle).toBeGreaterThan(0.65)
    expect(read.settle).toBeLessThan(0.9)
    expect(cameraLap(building, read.settle!) / read.settle!).toBeCloseTo(1, 2)
  })

  it('finds no settling level for a hard clip with the fader full up', () => {
    expect(cameraLapReading({ ...bare, mix: 1, gain: 1.5 }).settle).toBeNull()
  })

  it('reads the gamma-heavy look as under unity everywhere', () => {
    const steep = {
      ...cameraLoopOf(DEFAULT_CONTROLS),
      mix: 0.8,
      gain: 1.5,
      gamma: 1.6,
    }
    expect(cameraLapReading(steep).gain).toBeLessThan(1)
  })
})

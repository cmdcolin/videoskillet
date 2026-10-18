import { describe, expect, it } from 'vitest'

import { cameraLoopSays, loopTripSays, mixerLoopSays } from './loopReading'

// The reading exists because the two sliders cannot say this apart: a fader at
// 0.6 and a trim at 1.07 both read as "up" and multiply to 0.66, which is a
// three-frame smear. Every camera-loop preset in the library was once authored
// against that.
describe('what a round trip says', () => {
  it('calls a loop well under unity a decay, and counts the frames', () => {
    expect(loopTripSays(0.66)).toBe('decays in about 3 frames')
    expect(loopTripSays(0.5)).toBe('decays in about 2 frames')
  })

  it('separates trails that hold from structure that builds', () => {
    expect(loopTripSays(0.9)).toContain('trails hold')
    expect(loopTripSays(1.0)).toContain('at the edge')
  })

  it('calls a loop above unity building', () => {
    expect(loopTripSays(1.13)).toBe('building')
  })
})

// The mixer loop's trim runs to -3, and two presets ship the far side of zero.
// Read as a signed number, -1.14 is well under unity and reads as a decay; it
// is a loop above unity that comes back upside down.
describe('a trim the far side of zero', () => {
  it('reads the magnitude and names the inversion', () => {
    expect(loopTripSays(-1.14)).toBe('building, inverting')
    expect(loopTripSays(-0.4)).toContain('decays')
    expect(loopTripSays(-0.4)).toContain('inverting')
  })
})

// The resonance lifts the mixer loop's gain in one band, and the loop builds
// there while the broadband round trip still reads as under unity.
describe('the mixer loop reads its peak', () => {
  it('reads a flat loop as its round trip', () => {
    expect(mixerLoopSays(0.78, { gain: 0.78, mhz: 0 })).toBe(loopTripSays(0.78))
  })

  it('reads a resonance above unity as building, and says where', () => {
    const says = mixerLoopSays(0.78, { gain: 1.4, mhz: 2 })
    expect(says).toBe('peak 1.40× at 2.0 MHz · building')
    expect(says).not.toContain('does not build')
  })

  it('keeps the inversion', () => {
    expect(mixerLoopSays(-0.78, { gain: 1.4, mhz: 2 })).toContain('inverting')
  })
})

// The camera loop's gain depends on the level, so it reads the peak across
// levels, and a loop above unity names the level it settles at.
describe('the camera loop reads its peak', () => {
  const settling = { gain: 1.27, level: 0.45, settle: 0.72 }

  it('reads a curve under unity by its peak', () => {
    expect(
      cameraLoopSays(1.2, { gain: 0.96, level: 0.75, settle: null }, 1.05),
    ).toBe(
      'peak 0.96× at 75% grey · just under — trails hold, structure does not build',
    )
  })

  it('says where an expanding loop settles, and that it fills the screen', () => {
    expect(cameraLoopSays(1.28, settling, 1.05)).toBe(
      'peak 1.27× at 45% grey · building, and expanding — the screen settles at a bright grey (72%)',
    )
  })

  it('says a collapsing loop settles in its core', () => {
    expect(cameraLoopSays(1.28, settling, 0.95)).toContain(
      'the core settles at a bright grey',
    )
  })

  // The measured asymmetry: with nothing to stop it, an expanding loop spreads
  // what it gains over the whole raster and pins it white, while a collapsing
  // one holds a picture well past unity.
  it('warns of white only where nothing stops an expanding loop', () => {
    const runaway = { gain: 1.13, level: 1, settle: null }
    expect(cameraLoopSays(1.13, runaway, 1.02)).toBe(
      'building, and expanding — this walks to white',
    )
    expect(cameraLoopSays(1.13, runaway, 0.95)).toBe('building')
  })
})

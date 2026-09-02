import { describe, expect, it } from 'vitest'

import { loopTripSays } from './loopReading'

// The reading exists because the two sliders cannot say this apart: a fader at
// 0.6 and a trim at 1.07 both read as "up" and multiply to 0.66, which is a
// three-frame smear. Every camera-loop preset in the library was once authored
// against that.
describe('what a round trip says', () => {
  it('calls a loop well under unity a decay, and counts the frames', () => {
    expect(loopTripSays(0.66, 1.02)).toBe('decays in about 3 frames')
    expect(loopTripSays(0.5, 1.02)).toBe('decays in about 2 frames')
  })

  it('separates trails that hold from structure that builds', () => {
    expect(loopTripSays(0.9, 1.02)).toContain('trails hold')
    expect(loopTripSays(1.0, 1.02)).toContain('at the edge')
  })

  // The measured asymmetry: above unity an expanding loop spreads what it gains
  // over the whole raster and pins it white, while a collapsing one holds a
  // picture well past it. Only the camera loop has a transport, so only it is
  // asked about zoom.
  it('warns above unity only where the transport expands', () => {
    expect(loopTripSays(1.13, 0.95)).toBe('building')
    expect(loopTripSays(1.13, 1.02)).toContain('walks to white')
    expect(loopTripSays(1.13, undefined)).toBe('building')
  })
})

// The mixer loop's trim runs to -3, and two presets ship the far side of zero.
// Read as a signed number, -1.14 is well under unity and reads as a decay; it
// is a loop above unity that comes back upside down.
describe('a trim the far side of zero', () => {
  it('reads the magnitude and names the inversion', () => {
    expect(loopTripSays(-1.14, undefined)).toBe('building, inverting')
    expect(loopTripSays(-0.4, undefined)).toContain('decays')
    expect(loopTripSays(-0.4, undefined)).toContain('inverting')
  })
})

import { describe, expect, it } from 'vitest'

import { audioClock, wallClock } from './takeClock'

// An audio context whose `currentTime` the main thread sees refreshed every
// `refresh` ms, as Firefox delivers it: the true time at the last refresh.
function staleContext(refresh: number, latency = 0) {
  let wall = 0
  const ctx = {
    currentTime: 0,
    outputLatency: latency,
    baseLatency: 0,
  }
  return {
    ctx,
    read: () => wall,
    advance: (ms: number) => {
      wall += ms
      ctx.currentTime = (Math.floor(wall / refresh) * refresh) / 1000
    },
  }
}

describe('audioClock', () => {
  it('places frames without the jitter of a stale currentTime', () => {
    const s = staleContext(13.5)
    const clock = audioClock(s.ctx, s.read)
    const errors: number[] = []
    for (let i = 0; i < 3000; i++) {
      s.advance(2)
      clock.sample()
      if (i > 600 && i % 7 === 0)
        errors.push(clock.at(s.read()) * 1000 - s.read())
    }
    const lo = Math.min(...errors)
    const hi = Math.max(...errors)
    // A fixed lag of about half a refresh, and almost no spread around it.
    expect(hi - lo).toBeLessThan(1)
    expect(-lo).toBeGreaterThan(5)
    expect(-hi).toBeLessThan(8)
  })

  it('subtracts the output latency', () => {
    const quiet = staleContext(1)
    const late = staleContext(1, 0.04)
    const a = audioClock(quiet.ctx, quiet.read)
    const b = audioClock(late.ctx, late.read)
    for (let i = 0; i < 600; i++) {
      quiet.advance(2)
      late.advance(2)
      a.sample()
      b.sample()
    }
    expect((a.at(1200) - b.at(1200)) * 1000).toBeCloseTo(40, 6)
  })

  it('answers before its first reading', () => {
    const s = staleContext(10)
    s.advance(500)
    expect(audioClock(s.ctx, s.read).at(500)).toBeCloseTo(0.5, 6)
  })
})

describe('wallClock', () => {
  it('is performance.now in seconds', () => {
    expect(wallClock().at(1500)).toBe(1.5)
  })
})

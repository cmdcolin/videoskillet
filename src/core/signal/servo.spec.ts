import { describe, expect, it } from 'vitest'

import { TrackingServo } from './servo'

const mid = () => 0.5
const still = { target: 0.85, amt: 0.3, hunt: 0, kick: 0.6 }

describe('TrackingServo', () => {
  it('parks the band exactly where the hand put it with hunt off', () => {
    const s = new TrackingServo(mid)
    s.kick(1)
    for (let i = 0; i < 30; i++) {
      const out = s.update(still)
      expect(out.pos).toBe(0.85)
      expect(out.amt).toBe(0.3)
      expect(out.flagUs).toBe(0)
    }
  })

  it('settles onto the target and the band fades once it is there', () => {
    const s = new TrackingServo(mid)
    let out = s.update({ ...still, hunt: 0.5 })
    for (let i = 0; i < 600; i++) out = s.update({ ...still, hunt: 0.5 })
    expect(Math.abs(out.pos - 0.85)).toBeLessThan(0.05)
    expect(out.amt).toBeLessThan(0.35)
  })

  it('sweeps away from the target on a kick, overshoots, and comes back', () => {
    const s = new TrackingServo(mid)
    const loose = { ...still, hunt: 1, kick: 1 }
    for (let i = 0; i < 120; i++) s.update(loose)
    s.kick(1)
    const path: number[] = []
    for (let i = 0; i < 240; i++) path.push(s.update(loose).pos)
    const far = Math.max(...path.map(p => Math.abs(p - 0.85)))
    expect(far).toBeGreaterThan(0.2)
    const crossings = path.filter(
      (p, i) => i > 0 && Math.sign(p - 0.85) !== Math.sign(path[i - 1] - 0.85),
    ).length
    expect(crossings).toBeGreaterThan(1)
    expect(Math.abs(path[path.length - 1] - 0.85)).toBeLessThan(far)
  })

  it('raises the mistrack severity while moving and flags the seam under tension', () => {
    const s = new TrackingServo(mid)
    for (let i = 0; i < 120; i++) s.update({ ...still, hunt: 1, amt: 0 })
    const rest = s.update({ ...still, hunt: 1, amt: 0 })
    s.kick(1)
    const hit = s.update({ ...still, hunt: 1, amt: 0 })
    expect(hit.amt).toBeGreaterThan(rest.amt)
    expect(hit.flagUs).toBeGreaterThan(0)
    let later = hit
    for (let i = 0; i < 120; i++)
      later = s.update({ ...still, hunt: 1, amt: 0 })
    expect(later.flagUs).toBeLessThan(hit.flagUs)
  })

  it('never lets the band leave the picture', () => {
    const s = new TrackingServo(mid)
    for (let i = 0; i < 300; i++) {
      s.kick(1)
      const { pos } = s.update({ ...still, hunt: 1, kick: 1 })
      expect(pos).toBeGreaterThanOrEqual(0)
      expect(pos).toBeLessThanOrEqual(1)
    }
  })
})

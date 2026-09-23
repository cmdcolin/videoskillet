import type { Controls } from '../core/controls'

// How far a kick pulls the high-voltage supply down, and how freely the supply
// rings back up afterwards.
const SAG_US = 14
const RING = 0.4

// The room's sound on the set. A cheap set runs its audio amplifier off the same
// supply as the scan, so a kick loads that supply like a flash of beam current:
// the picture shrinks on the hit and rings back. A look that already works the
// supply harder keeps its own settings.
export const sounded = (c: Controls): Controls => ({
  ...c,
  audioSagUs: Math.max(c.audioSagUs, SAG_US),
  hvRing: Math.max(c.hvRing, RING),
})

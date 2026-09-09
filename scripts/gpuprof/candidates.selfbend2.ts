// Second pass. What the first one settled, before anything below:
//
// **`hvRing` stops mattering inside a loop.** 0.9 against the shipped 0.55
// renders as the same ribbon field — the two strips are hard to tell apart. The
// tank's own time constant decides how much of the picture above a line is in
// its displacement, but after a dozen laps the loop is already feeding the tank
// a filtered version of what the tank did last time, so the recirculation sets
// the memory and the dial does not. A variation of that knob is not a second
// preset. (`hvRing` still earns its keep outside a loop, where the excitation
// is the source and not the tank's own output.)
//
// **The tight end is quiet.** `hvRing` 0.06 traces each line's own brightness
// almost literally, which is the relief map it promised, and it renders `sd`
// 20.4 against 39.1 for the shipped tuning: a dark field with a soft band in
// it. Correct, and not a look.
//
// Four arms failed on level rather than on idea, and two of those ideas are
// worth a retune. The other two — differential phase per lap, and the FM fold
// feeding itself — both blew to mean ~102 and rendered as the same washed frame
// with rainbow edges, which is the loop dominating a mechanism that is about
// level rather than about displacement. Dropped: they are not in this vein.

import type { Controls } from '../../src/core/controls'
import type { LooseRouting } from './render'

export interface Candidate {
  name: string
  blurb: string
  patch: Partial<Controls>
  mod?: readonly LooseRouting[]
}

const RIG = {
  fbMix: 0.9,
  fbGain: 1.28,
  fbZoom: 0.965,
  fbVign: 0.08,
  fbBlack: 0.015,
  fbKnee: 0.75,
} as const

export const candidates: Candidate[] = [
  {
    name: 'the tank and the varactor',
    blurb:
      'Retuned off mean 3.0 — a black frame. Two displacements that both walk content off the raster, at gains that between them left nothing on it. Both backed off.',
    patch: {
      ...RIG,
      fbGain: 1.18,
      hvSagUs: 26,
      hvRing: 0.5,
      abl: 0.15,
      cfbMix: 0.55,
      cfbGain: 1.02,
      cfbDelayUs: 0.6,
      cfbServoUs: 16,
      cfbGenlock: 1,
    },
    mod: [{ target: 'cfbServoUs', source: 'sine', rateHz: 0.05, depth: 0.2 }],
  },
  {
    name: 'the halo keyed to the beam',
    blurb:
      'Retuned off mean 152 — a white field. A scatter radius that grows with drive is a positive loop of its own, and it does not need the camera loop at 1.15 as well.',
    patch: {
      ...RIG,
      fbGain: 1.1,
      fbBlack: 0.03,
      fbKnee: 0.85,
      crtHalation: 0.9,
      crtHaloKey: 2.5,
      crtBloom: 0.4,
    },
    mod: [
      { target: 'crtHaloKey', source: 'smooth', rateHz: 0.05, depth: 0.15 },
    ],
  },
  {
    name: 'the picture bending under itself',
    blurb:
      'The same supply, with the round trip held under unity so the loop decays as fast as it builds. The bend is as deep as the shipped preset and the subject is still legible under it, so what you watch is a recognisable picture warping by its own brightness rather than a field the picture used to be in.',
    patch: {
      ...RIG,
      fbMix: 0.8,
      fbGain: 1.2,
      fbVign: 0.14,
      fbBlack: 0.03,
      hvSagUs: 50,
      hvRing: 0.5,
      abl: 0.2,
    },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'the iris and the tank',
    blurb:
      "Two content-driven quantities coupled the long way round: the auto-iris meters the loop's brightness and stops down, which changes the beam current, which is what the tank is bending the scan by. The iris is underdamped, so it never arrives at an exposure and the bend never arrives at a shape.",
    patch: {
      ...RIG,
      fbGain: 1.22,
      hvSagUs: 42,
      hvRing: 0.5,
      fbIris: 0.9,
      abl: 0.2,
    },
    mod: [{ target: 'fbIris', source: 'smooth', rateHz: 0.05, depth: 0.1 }],
  },

  // carried forward unchanged from the first pass
  {
    name: 'the supply wired backwards',
    blurb: 'First pass, unchanged.',
    patch: { ...RIG, hvSagUs: -55, hvRing: 0.5, abl: 0.15 },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'velocity modulation, wide',
    blurb: 'First pass, unchanged.',
    patch: { ...RIG, crtSvm: 1.1, crtSvmWidth: 9, fbGain: 1.22 },
    mod: [{ target: 'crtSvm', source: 'sine', rateHz: 0.05, depth: 0.12 }],
  },
  {
    name: 'beamBendsItsOwnScan, as shipped',
    blurb: 'For comparison.',
    patch: { ...RIG, hvSagUs: 45, hvRing: 0.55, abl: 0.2 },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
]

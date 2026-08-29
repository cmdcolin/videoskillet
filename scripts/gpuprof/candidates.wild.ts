// Past the redline on purpose. The previous three rounds proposed one mechanism
// at a polite setting each and the verdict on all of them was "very subtle" —
// which was fair. These stack, run loops above unity, and carry the modulation
// the harness can finally drive, because the looks worth keeping here are the
// ones that go somewhere on their own and do not stop.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     candidates --spec=scripts/gpuprof/candidates.wild.ts --video
//
// The idea underneath most of them: ring modulation *inside* a feedback loop.
// One multiplication is a recolour; a multiplication the loop takes round and
// multiplies again is products of products, compounding a generation at a time,
// and it does not converge the way a summing loop does.
//
// **Which loop matters, and it is not the obvious one.** `bRing` multiplies two
// whole composite signals, sync tips and all, and the product is already near
// peak white before any loop sees it. A *camera* loop photographs the decoded
// picture, so it is handed a clipped white frame and walls out however low its
// gain — 0.92 with a black cut and a knee is still a white field. The *mixer*
// loop is in the composite domain, where the same product is just another
// waveform to crossfade against, and it holds structure. Ring into the mixer
// loop; never into the camera loop.

import type { Controls } from '../../src/core/controls'
import type { Routing } from './render'

export interface Candidate {
  name: string
  blurb: string
  patch: Partial<Controls>
  mod?: readonly Routing[]
}

export const candidates: Candidate[] = [
  {
    name: 'ring in the loop',
    blurb:
      'The two decks multiplied, and the product sent round the mixer loop to be multiplied again against what comes back. Every lap is a product of products — the composite loop, not the camera, because a camera loop is handed the decoded frame and this one arrives at it already white.',
    patch: {
      bGain: 0.3,
      bRing: 0.85,
      bDetuneHz: 1400,
      cfbMix: 0.8,
      cfbGain: 0.9,
      cfbDelayUs: 0.3,
      cfbRing: 0.5,
      chromaGain: 1.5,
      phosphor: 0.7,
    },
    mod: [{ target: 'bDetuneHz', source: 'smooth', rateHz: 0.09, depth: 0.25 }],
  },
  {
    name: 'ring spiral',
    blurb:
      'The same compounding, wound: three degrees of rotation a lap, so the products spiral outward while they breed instead of stacking on the spot.',
    patch: {
      bGain: 0.3,
      bRing: 0.85,
      bDetuneHz: 900,
      cfbMix: 0.72,
      cfbGain: 0.95,
      cfbDelayUs: 0.35,
      cfbRing: 0.55,
      cfbLines: 1,
      fbMix: 0.45,
      fbGain: 0.98,
      fbZoom: 1.015,
      fbRotateDeg: 3.5,
      chromaGain: 1.4,
      phosphor: 0.65,
    },
    mod: [{ target: 'fbRotateDeg', source: 'sine', rateHz: 0.04, depth: 0.4 }],
  },
  {
    name: 'both rings',
    blurb:
      'Both multipliers and both loops at once — the decks rung together, the mixer loop rung against the program, and a camera loop above unity photographing the result of both.',
    patch: {
      bGain: 0.3,
      bRing: 0.8,
      bDetuneHz: 1800,
      cfbMix: 0.6,
      cfbGain: 0.95,
      cfbDelayUs: 0.3,
      cfbRing: 0.6,
      fbMix: 0.6,
      fbGain: 0.98,
      fbZoom: 1.02,
      chromaGain: 1.4,
      phosphor: 0.6,
    },
    mod: [{ target: 'fbGain', source: 'smooth', rateHz: 0.07, depth: 0.06 }],
  },
  {
    name: 'runaway',
    blurb:
      'A camera loop with the gain walked by an LFO that takes it well past unity and back. It blooms to white, the beam limiter pulls it down, and it climbs again — the servo and the loop arguing, on a cycle nothing on screen set.',
    patch: {
      fbMix: 0.8,
      fbGain: 1.2,
      fbZoom: 1.03,
      fbIris: 0.7,
      abl: 0.8,
      chromaGain: 1.2,
      phosphor: 0.75,
    },
    mod: [{ target: 'fbGain', source: 'sine', rateHz: 0.08, depth: 0.12 }],
  },
  {
    name: 'sync in the loop',
    blurb:
      'The picture already coming apart before the loop gets it: the vertical hold is marginal, so the loop photographs a rolling frame and folds the roll into what it feeds back.',
    patch: {
      fbMix: 0.75,
      fbGain: 1.08,
      fbZoom: 1.02,
      vHold: 0.06,
      vFreqHz: 59.86,
      hHold: 0.4,
      chromaGain: 1.3,
      phosphor: 0.7,
    },
    mod: [{ target: 'vFreqHz', source: 'smooth', rateHz: 0.06, depth: 0.02 }],
  },
  {
    name: 'lorenz loop',
    blurb:
      'The loop delay driven by a Lorenz attractor rather than an oscillator: the echo spacing never repeats, so the structure the loop builds never lands twice in the same place.',
    patch: {
      cfbMix: 0.82,
      cfbGain: 1.02,
      cfbDelayUs: 2,
      cfbLines: 1,
      chromaGain: 1.4,
      phosphor: 0.6,
    },
    mod: [{ target: 'cfbDelayUs', source: 'lorenz', rateHz: 0.5, depth: 0.06 }],
  },
  {
    name: 'yoke and loop',
    blurb:
      'Deflection driven past what the supply can hold, inside a camera loop: the geometry fault is photographed and re-bent every lap, so the bend compounds instead of sitting still.',
    patch: {
      hvSagUs: 60,
      hvRing: 0.8,
      bendUs: -40,
      bendShape: 3,
      bendPeriod: 30,
      fbMix: 0.7,
      fbGain: 1.08,
      fbZoom: 1.01,
      chromaGain: 1.2,
      phosphor: 0.7,
    },
    mod: [{ target: 'bendUs', source: 'triangle', rateHz: 0.12, depth: 0.25 }],
  },
  {
    name: 'strobe bloom',
    blurb:
      'The beam cut for most of each cycle and let through in flashes, inside a loop above unity. The loop photographs the dark frames too, so it pumps at the strobe rate instead of running steady.',
    patch: {
      strobeHz: 6,
      strobeMs: 40,
      fbMix: 0.78,
      fbGain: 1.16,
      fbZoom: 1.025,
      phosphor: 0.92,
      chromaGain: 1.3,
    },
    mod: [{ target: 'strobeHz', source: 'hold', rateHz: 0.4, depth: 0.3 }],
  },
  {
    name: 'synth in the loop',
    blurb:
      'The oscillator translating brightness into the colour band, then a loop that re-photographs the colour it just invented and hands it back as brightness to be translated again.',
    patch: {
      synthOver: 0.5,
      synthAHz: 3579545,
      synthColor: 0.9,
      synthLevel: 1,
      // Mid travel, not the 0 it defaults to. The colorizer phase runs 0..360
      // and the routing below is bipolar, so based at the floor it spends the
      // clip clamped and the picture holds one hue — which is exactly what the
      // first render of this candidate showed and got diagnosed as a blown-out
      // field. `Runner.run` now warns when a routing pins against an end.
      synthHueDeg: 180,
      fbMix: 0.72,
      fbGain: 1.1,
      fbZoom: 1.018,
      fbRotateDeg: -2,
      chromaGain: 1.4,
      phosphor: 0.7,
    },
    // Depth 0.5 around a base of 180, which is the whole 0..360 and not a
    // degree more: bipolar swing means depth is measured each way, so depth 1
    // here would spend half the run clamped even based at mid travel.
    mod: [
      { target: 'synthHueDeg', source: 'triangle', rateHz: 0.12, depth: 0.5 },
    ],
  },
  {
    name: 'everything',
    blurb:
      'The board with no restraint on it: both rings, both loops above unity, sync marginal, deflection past the redline, and four things moving at once.',
    patch: {
      bGain: 0.3,
      bRing: 0.75,
      bDetuneHz: 1500,
      cfbMix: 0.62,
      cfbGain: 0.96,
      cfbDelayUs: 0.4,
      cfbRing: 0.6,
      fbMix: 0.6,
      fbGain: 1.02,
      fbZoom: 1.025,
      fbRotateDeg: 2.5,
      vHold: 0.05,
      hvSagUs: 40,
      abl: 0.7,
      chromaGain: 1.5,
      phosphor: 0.8,
    },
    mod: [
      { target: 'fbGain', source: 'smooth', rateHz: 0.08, depth: 0.06 },
      { target: 'bDetuneHz', source: 'sine', rateHz: 0.05, depth: 0.3 },
    ],
  },
]

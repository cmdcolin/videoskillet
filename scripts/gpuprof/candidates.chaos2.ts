// Round two, off what round one measured (candidates.chaos.ts).
//
// The nine arms that put a *channel* fault inside the mixer loop all came back
// grey — csd 4.9 to 13 against 28 to 49 for the camera-loop arms beside them,
// and the frames are the fine mesh and the soft grey bands round one of the
// feedback screening already cut on sight. That is consistent with what
// docs/CURATION.md found about `cfbRing` on the program: the mixer loop's own
// card is where its colour comes from, and it has been mined. A tape fault
// dropped into the same loop is additive damage that the loop averages.
//
// The camera loop is the half that was not mined, and the reason is structural:
// its round trip is a whole encode/decode generation, so every decoder and
// screen fault applies once per lap. This round is that family, plus the one
// distinction round one did not test — the transport.
//
// **An affine transport gives a tunnel; a picture-dependent one gives shapes.**
// Zoom, rotation and shift are the only geometry the camera loop has ever been
// asked for here, and all three are affine: a generation lands scaled and
// turned, so the fixed point is a tunnel or a spiral and nothing else is
// reachable. The beam supply, the yoke and the SVM coil all bend the scan by an
// amount the *picture* sets, so the loop's own content decides the warp and the
// warped content decides the next one.

import type { Controls } from '../../src/core/controls'
import type { LooseRouting } from './render'

export interface Candidate {
  name: string
  blurb: string
  patch: Partial<Controls>
  mod?: readonly LooseRouting[]
}

export const candidates: Candidate[] = [
  // ---- non-affine transports: the picture decides where the picture goes ----
  {
    name: 'the beam bends its own scan',
    blurb:
      'Beam-current sag inside an optical loop. Bright picture drags the scan sideways, the camera photographs the bent frame, and its brightness bends the next lap somewhere else. The displacement field is the picture, which is what an affine transport can never be.',
    patch: {
      hvSagUs: 30,
      hvRing: 0.5,
      abl: 0.5,
      fbMix: 0.88,
      fbGain: 1.2,
      fbZoom: 0.96,
      fbVign: 0.3,
      fbBlack: 0.04,
      chromaGain: 1.3,
      crtSat: 1.2,
    },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'a bow in the glass',
    blurb:
      'A bowed scan inside the loop, so each generation lands bowed on top of a generation that was already bowed. The curvature adds where a zoom would only have multiplied, and the tunnel bends into a horn.',
    patch: {
      bendUs: 20,
      bendShape: 2,
      bendPeriod: 60,
      fbMix: 0.88,
      fbGain: 1.2,
      fbZoom: 0.97,
      fbRotateDeg: 1.2,
      fbVign: 0.3,
      chromaGain: 1.3,
    },
    mod: [{ target: 'bendUs', source: 'sine', rateHz: 0.04, depth: 0.1 }],
  },
  {
    name: 'velocity modulation compounding',
    blurb:
      'The SVM coil speeding the beam up at every luminance step, inside the loop. A pulled edge is a new edge for the next lap to pull, so the ridges breed off each other.',
    patch: {
      crtSvm: 2.5,
      crtSvmWidth: 3,
      fbMix: 0.88,
      fbGain: 1.2,
      fbZoom: 0.96,
      fbVign: 0.3,
      chromaGain: 1.2,
    },
    mod: [{ target: 'crtSvm', source: 'sine', rateHz: 0.05, depth: 0.15 }],
  },

  // ---- decoder faults, applied once a generation ----
  {
    name: 'colour walking off its edges',
    blurb:
      'The chroma path running late against luma, inside the loop. Every lap moves the colour another 700 ns to the right of the shape it belongs to, so a subject grows a comet of its own colour, ordered by how many generations back each part of it was.',
    patch: {
      ycDelayNs: 700,
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.96,
      fbVign: 0.3,
      chromaGain: 1.5,
      crtSat: 1.2,
    },
    mod: [
      { target: 'ycDelayNs', source: 'triangle', rateHz: 0.03, depth: 0.12 },
    ],
  },
  {
    name: 'the trap wired to the wrong pin',
    blurb:
      'Chroma bled into the luma channel inside the loop, so the colour a lap made is brightness on the next lap, and the encoder turns that brightness back into colour. Cross-colour with nothing to stop it.',
    patch: {
      svideoBleed: 0.6,
      encChromaMHz: 2,
      chromaCoarse: 2,
      fbMix: 0.9,
      fbGain: 1.14,
      fbZoom: 0.97,
      chromaGain: 1.6,
      crtSat: 1.2,
    },
  },
  {
    name: 'the crystal winding',
    blurb:
      'The demodulator on a crystal a fraction off the burst, inside the loop. Hue ramps along every line and further down every line after it, and the next lap ramps what the last one wrote, so the barber pole winds a turn tighter every generation.',
    patch: {
      scDetuneKHz: 0.8,
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.96,
      fbRotateDeg: 1.5,
      chromaGain: 1.6,
      crtSat: 1.2,
    },
    mod: [
      { target: 'scDetuneKHz', source: 'smooth', rateHz: 0.04, depth: 0.01 },
    ],
  },
  {
    name: 'the plane shearing',
    blurb:
      'The two demodulators off quadrature, inside the loop, so the plane the colour lands on is sheared once per generation. Hues that were opposite stop being opposite, and the pair that would have cancelled reinforce instead, lap after lap.',
    patch: {
      demodAxisDeg: 55,
      matrixClip: 1,
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.955,
      fbVign: 0.3,
      chromaGain: 1.6,
    },
    mod: [
      { target: 'demodAxisDeg', source: 'sine', rateHz: 0.03, depth: 0.12 },
    ],
  },

  // ---- retunes of round one, and of a preset that measured weak ----
  {
    name: 'tint in the loop, subject kept',
    blurb:
      'Round one at a lower fader and a higher gain: the same round trip, but a quarter of every frame is live picture, so the subject stays in front of the wheel instead of being eaten by it.',
    patch: {
      tintDeg: 26,
      fbMix: 0.78,
      fbGain: 1.36,
      fbZoom: 0.955,
      fbVign: 0.35,
      fbBlack: 0.05,
      fbKnee: 0.7,
      chromaGain: 1.4,
      crtSat: 1.2,
      noiseIre: 1.2,
    },
    mod: [{ target: 'tintDeg', source: 'smooth', rateHz: 0.05, depth: 0.08 }],
  },
  {
    name: 'encoder backwards, calmer',
    blurb:
      'The alternating-polarity tunnel with the round trip brought back to unity, which is where the rings stop washing to white and keep their edges.',
    patch: {
      invert: 1,
      fbMix: 0.88,
      fbGain: 1.14,
      fbZoom: 0.94,
      fbVign: 0.45,
      fbBlack: 0.04,
      fbKnee: 0.6,
      chromaGain: 1.4,
    },
    mod: [{ target: 'fbZoom', source: 'sine', rateHz: 0.03, depth: 0.006 }],
  },
  {
    name: 'hunting servos, collapsing',
    blurb:
      "The shipped preset's two servos with its transport fixed: it runs a round trip of 0.66 and an expanding zoom, which is a three-frame smear rather than a loop. Collapsing and past unity, the pumping has something to pump.",
    patch: {
      abl: 0.85,
      fbIris: 0.9,
      fbMix: 0.85,
      fbGain: 1.25,
      fbZoom: 0.96,
      agc: 0.6,
      hvSagUs: 4,
      hvRing: 0.45,
      crtBloom: 0.3,
      chromaGain: 1.2,
    },
  },

  // ---- round one's keepers, unchanged, as the bar to clear ----
  {
    name: 'a magnet on the glass',
    blurb: 'Round one, for comparison.',
    patch: {
      crtPurity: 1.6,
      crtPurityX: 0.36,
      crtPurityY: 0.42,
      crtPuritySize: 0.35,
      fbMix: 0.88,
      fbGain: 1.2,
      fbZoom: 0.96,
      fbRotateDeg: 3,
      chromaGain: 1.3,
    },
    mod: [{ target: 'fbRotateDeg', source: 'sine', rateHz: 0.03, depth: 0.02 }],
  },
  {
    name: 'guns drifting apart',
    blurb: 'Round one, for comparison.',
    patch: {
      fbMix: 0.88,
      fbGain: 1.2,
      fbZoom: 0.96,
      fbVign: 0.3,
      fbBlack: 0.04,
      crtConverge: 5,
      chromaGain: 1.2,
      crtSat: 1.3,
    },
    mod: [{ target: 'crtConverge', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'the hand on the chassis',
    blurb: 'Round one, for comparison.',
    patch: {
      clipHz: 1.2,
      clipPoint: 3,
      clipBite: 0.95,
      clipDwellMs: 140,
      clipChatter: 0.5,
      fbMix: 0.9,
      fbGain: 1.18,
      fbZoom: 0.95,
      fbVign: 0.35,
      fbBlack: 0.04,
      chromaGain: 1.2,
    },
  },
]

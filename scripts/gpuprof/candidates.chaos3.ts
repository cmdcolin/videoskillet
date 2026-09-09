// Round three. Two corrections off round two, and the transport spread out.
//
// **The non-affine arms rendered black.** `the beam bends its own scan` came
// back mean 13 and `a bow in the glass` mean 18, both against 45-81 for the
// arms beside them. Neither is a dark look: a bend pushes content off the edge
// of the raster and it does not come back, so the loop loses light every lap on
// top of whatever the vignette and the beam limiter are already taking. The
// mechanism is the most interesting geometry in this family and it was being
// judged with the lights off. These run it with the vignette nearly out, the
// black cut low and the limiter off the drive.
//
// **Everything converged on one picture.** Seven arms rendered as a saturated
// radial starburst, because seven arms ran the same transport — a collapse at
// zoom 0.955-0.97 with no shift and little rotation. The mechanism differed and
// the fixed point did not. So this round varies the transport deliberately:
// rotation-dominant, shift-dominant (a fixed point that is not the middle of
// the screen), bowed, and one held under unity so the live picture stays on
// top of what the loop is building.
//
// Eight of these shipped. What a fourth pass changed on the way, and what it
// cut, is in docs/CURATION.md › The camera loop is a whole generation: `sag`
// took more gain, `invert` took a rotation (without one it converges to
// concentric rings and a four-second strip that barely changes), `bow` went as
// a shape away from `flag`, and the magnet went as a second spiral.

import type { Controls } from '../../src/core/controls'
import type { LooseRouting } from './render'

export interface Candidate {
  name: string
  blurb: string
  patch: Partial<Controls>
  mod?: readonly LooseRouting[]
}

export const candidates: Candidate[] = [
  {
    name: 'bow, lit',
    blurb: 'The bowed scan with the light left in.',
    patch: {
      bendUs: 26,
      bendShape: 2,
      bendPeriod: 90,
      fbMix: 0.9,
      fbGain: 1.22,
      fbZoom: 0.965,
      fbRotateDeg: 0.8,
      fbVign: 0.12,
      fbBlack: 0.02,
      fbKnee: 0.65,
      chromaGain: 1.4,
      crtSat: 1.2,
    },
    mod: [{ target: 'bendUs', source: 'sine', rateHz: 0.04, depth: 0.1 }],
  },
  {
    name: 'sag, lit',
    blurb: 'The beam bending its own scan, with the limiter off the drive.',
    patch: {
      hvSagUs: 45,
      hvRing: 0.55,
      abl: 0.2,
      fbMix: 0.9,
      fbGain: 1.24,
      fbZoom: 0.965,
      fbVign: 0.12,
      fbBlack: 0.02,
      fbKnee: 0.7,
      chromaGain: 1.4,
      crtSat: 1.2,
    },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'flag, lit',
    blurb:
      'The other bend shape: a flag decaying down from the top of the picture, so the top of every generation is displaced further than the bottom and the stack skews.',
    patch: {
      bendUs: 34,
      bendShape: 0,
      bendPeriod: 120,
      fbMix: 0.9,
      fbGain: 1.22,
      fbZoom: 0.965,
      fbVign: 0.12,
      fbBlack: 0.02,
      fbKnee: 0.65,
      chromaGain: 1.4,
    },
    mod: [{ target: 'bendUs', source: 'sine', rateHz: 0.04, depth: 0.1 }],
  },
  {
    name: 'off the axis',
    blurb:
      'The camera aimed off the middle of the screen, so the fixed point of the transport is in a corner and the picture pours into it instead of down a tunnel.',
    patch: {
      fbShiftX: 0.07,
      fbShiftY: 0.045,
      fbMix: 0.9,
      fbGain: 1.18,
      fbZoom: 0.95,
      fbRotateDeg: 2,
      fbVign: 0.25,
      fbBlack: 0.03,
      tintDeg: 18,
      chromaGain: 1.4,
    },
    mod: [{ target: 'fbShiftX', source: 'sine', rateHz: 0.04, depth: 0.03 }],
  },
  {
    name: 'the comet winding',
    blurb:
      'Colour running late against luma, in a transport that is mostly rotation, so the comet of displaced colour winds round the subject rather than radiating from it.',
    patch: {
      ycDelayNs: 700,
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.985,
      fbRotateDeg: 6,
      fbVign: 0.3,
      fbBlack: 0.03,
      chromaGain: 1.5,
      crtSat: 1.2,
    },
    mod: [
      { target: 'ycDelayNs', source: 'triangle', rateHz: 0.03, depth: 0.12 },
    ],
  },
  {
    name: 'subject on top',
    blurb:
      'The same wheel with the round trip just under unity, so the structure decays as fast as it builds and the live picture stays in front of it.',
    patch: {
      tintDeg: 30,
      fbMix: 0.8,
      fbGain: 1.2,
      fbZoom: 0.96,
      fbRotateDeg: 1.5,
      fbVign: 0.2,
      fbBlack: 0.03,
      fbKnee: 0.7,
      chromaGain: 1.4,
      crtSat: 1.2,
    },
    mod: [{ target: 'tintDeg', source: 'smooth', rateHz: 0.05, depth: 0.08 }],
  },
  {
    name: 'the killer cannot decide',
    blurb:
      'The mixer loop crossfading part of the burst, and a colour killer with a threshold high enough to care. Burst amplitude wanders with what the loop is carrying, so colour switches off and on in bands, and which bands is decided by what the loop was doing a generation ago rather than by anything in the picture.',
    patch: {
      killThresh: 12,
      accLagLines: 40,
      cfbMix: 0.9,
      cfbGain: 1.05,
      cfbDelayUs: 1.2,
      cfbLines: 2,
      cfbGenlock: 0.85,
      chromaGain: 1.8,
      noiseIre: 1.5,
    },
    mod: [
      { target: 'killThresh', source: 'smooth', rateHz: 0.05, depth: 0.06 },
    ],
  },

  // carried forward unchanged, as the bar
  {
    name: 'a magnet on the glass',
    blurb: 'Round one.',
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
    name: 'encoder backwards, calmer',
    blurb: 'Round two.',
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
    name: 'the crystal winding',
    blurb: 'Round two.',
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
    blurb: 'Round two.',
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
  {
    name: 'the hand on the chassis',
    blurb: 'Round one.',
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

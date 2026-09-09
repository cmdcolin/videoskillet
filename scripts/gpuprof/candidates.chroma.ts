// The eight camera-loop looks with their chroma trims taken out.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     candidates --spec=scripts/gpuprof/candidates.chroma.ts
//
// Why they needed it. `decode` and `crt_face` are both *inside* the camera
// loop's round trip, so `chromaGain` and `crtSat` are applied once per
// generation rather than once: 1.6 over five laps is a chroma gain of ten, and
// everything the loop builds walks to the primaries and sits there. In the
// mixer loop the same two knobs run once, outside the lap, which is why
// `ringLoop`, `theWrongClock` and `colourInTheDark` carry 1.2 to 2.2 safely and
// why copying that house style onto a camera loop is wrong. The library's own
// optical loops already knew: `spiral`, `tunnelOut`, `zoomBloom`, `fbBloom` and
// `woundSpiral` set no `chromaGain` at all, and 1.3 is the highest anywhere.
//
// The screening compounded it. These were ranked on `csd`, mean distance from
// grey — which is the quantity the error inflates, so the arms with the worst
// case of it sorted to the top and were then tuned further toward it. `csd`
// exists to stop a colour look being cut for reading flat on a luma-only `sd`
// (docs/CURATION.md). It is a rescue, not a score.
//
// Every arm below is the shipped patch with `chromaGain`, `crtSat` and
// `matrixClip` removed and nothing else touched, so what is left is the colour
// each mechanism actually makes. Two ablations at the end carry one trim back
// for comparison.

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
    name: 'sheared, stock chroma',
    blurb: 'demodAxisDeg 55. Was chromaGain 1.6 + matrixClip 1.',
    patch: {
      demodAxisDeg: 55,
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.955,
      fbVign: 0.3,
    },
    mod: [
      { target: 'demodAxisDeg', source: 'sine', rateHz: 0.03, depth: 0.12 },
    ],
  },
  {
    name: 'colour walking, stock chroma',
    blurb: 'ycDelayNs 700. Was chromaGain 1.5 + crtSat 1.2.',
    patch: {
      ycDelayNs: 700,
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.985,
      fbRotateDeg: 6,
      fbVign: 0.3,
      fbBlack: 0.03,
    },
    mod: [
      { target: 'ycDelayNs', source: 'triangle', rateHz: 0.03, depth: 0.12 },
    ],
  },
  {
    name: 'the wheel, stock chroma',
    blurb:
      'tintDeg 30, round trip under unity. Was chromaGain 1.4 + crtSat 1.2.',
    patch: {
      tintDeg: 30,
      fbMix: 0.8,
      fbGain: 1.2,
      fbZoom: 0.96,
      fbRotateDeg: 1.5,
      fbVign: 0.2,
      fbBlack: 0.03,
      fbKnee: 0.7,
    },
    mod: [{ target: 'tintDeg', source: 'smooth', rateHz: 0.05, depth: 0.08 }],
  },
  {
    name: 'the hand, stock chroma',
    blurb: 'The paperclip. Was chromaGain 1.2.',
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
    },
  },
  {
    name: 'the flag, stock chroma',
    blurb: 'bendUs 34 on the flag shape. Was chromaGain 1.4.',
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
    },
    mod: [{ target: 'bendUs', source: 'sine', rateHz: 0.04, depth: 0.1 }],
  },
  {
    name: 'the crystal, stock chroma',
    blurb: 'scDetuneKHz 0.8. Was chromaGain 1.6 + crtSat 1.2.',
    patch: {
      scDetuneKHz: 0.8,
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.96,
      fbRotateDeg: 1.5,
    },
    mod: [
      { target: 'scDetuneKHz', source: 'smooth', rateHz: 0.04, depth: 0.01 },
    ],
  },
  {
    name: 'the sag, stock chroma',
    blurb: 'hvSagUs 45. Was chromaGain 1.4 + crtSat 1.2.',
    patch: {
      hvSagUs: 45,
      hvRing: 0.55,
      abl: 0.2,
      fbMix: 0.9,
      fbGain: 1.28,
      fbZoom: 0.965,
      fbVign: 0.08,
      fbBlack: 0.015,
      fbKnee: 0.75,
    },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'the encoder, stock chroma',
    blurb: 'invert 1. Was chromaGain 1.4.',
    patch: {
      invert: 1,
      fbMix: 0.88,
      fbGain: 1.14,
      fbZoom: 0.945,
      fbRotateDeg: 2.4,
      fbVign: 0.4,
      fbBlack: 0.05,
      fbKnee: 0.6,
    },
    mod: [{ target: 'fbRotateDeg', source: 'sine', rateHz: 0.03, depth: 0.02 }],
  },

  // ---- ablations: one trim carried back, to see what each was buying ----
  {
    name: 'sheared + matrixClip only',
    blurb: 'The rails without the gain, to separate the two.',
    patch: {
      demodAxisDeg: 55,
      matrixClip: 1,
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.955,
      fbVign: 0.3,
    },
    mod: [
      { target: 'demodAxisDeg', source: 'sine', rateHz: 0.03, depth: 0.12 },
    ],
  },
  {
    name: 'the crystal + chromaGain 1.15',
    blurb:
      'The smallest per-lap gain worth trying, against the same look at stock.',
    patch: {
      scDetuneKHz: 0.8,
      chromaGain: 1.15,
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.96,
      fbRotateDeg: 1.5,
    },
    mod: [
      { target: 'scDetuneKHz', source: 'smooth', rateHz: 0.04, depth: 0.01 },
    ],
  },
  {
    name: 'sheared, as shipped',
    blurb: 'The current preset, for reference.',
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
]

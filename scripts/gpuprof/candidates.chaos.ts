// Under-used mechanisms put inside a loop. Screening round: which of them
// gives a feedback look large coherent structure that evolves, rather than
// texture (docs/CURATION.md › Chaotic is not the same as wild).
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     candidates --spec=scripts/gpuprof/candidates.chaos.ts
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/looplock.ts \
//     --spec=scripts/gpuprof/candidates.chaos.ts
//
// The premise is a coverage count rather than a hunch: sixty controls appear in
// no preset at all and eighty in exactly one, and the two loops wrap different
// halves of the rack. The camera loop's round trip is a whole encode/decode
// generation — compose, encoder, channel, decoder, tube face, back into
// compose — so every decoder and screen fault is *inside* it and applies once
// per lap. The mixer loop's round trip is the channel block and the outboard
// enhancer, so every tape and RF fault is inside that one. Neither of those two
// families has been crossed with the loops; what has been is the loop's own
// card, which by now is thoroughly explored.
//
// What this round is not: another resonator, blur, grain or stutter. Round two
// cut all four on sight and kept geometry that accumulates and colour made by
// arithmetic.

import type { Controls } from '../../src/core/controls'
import type { LooseRouting } from './render'

export interface Candidate {
  name: string
  blurb: string
  patch: Partial<Controls>
  mod?: readonly LooseRouting[]
}

export const candidates: Candidate[] = [
  // ---- inside the camera loop: one encode/decode generation per lap ----
  {
    name: 'tint in the loop',
    blurb:
      "The set's own tint knob, inside an optical loop. Each lap decodes the picture with the reference rotated another 26 degrees, so a ring of the tunnel says how many generations old it is by what colour it is.",
    patch: {
      fbMix: 0.9,
      fbGain: 1.16,
      fbZoom: 0.955,
      fbVign: 0.4,
      fbBlack: 0.04,
      fbKnee: 0.6,
      tintDeg: 26,
      chromaGain: 1.5,
      crtSat: 1.2,
      noiseIre: 1.2,
    },
    mod: [{ target: 'tintDeg', source: 'smooth', rateHz: 0.05, depth: 0.08 }],
  },
  {
    name: 'generation loss',
    blurb:
      'The same loop with the transport at 1:1 — no zoom, no rotation, no shift — so nothing accumulates except the encode/decode round trip itself. Dot crawl bakes into luma, re-encodes as chroma and crawls again.',
    patch: {
      fbMix: 0.94,
      fbGain: 1.06,
      fbZoom: 1,
      fbFocus: 0.15,
      fbBlack: 0.02,
      fbKnee: 0.5,
      encChromaMHz: 2.2,
      chromaCoarse: 3,
      chromaGain: 1.6,
      lumaPeak: 0.7,
      noiseIre: 1,
    },
    mod: [{ target: 'fbGain', source: 'smooth', rateHz: 0.05, depth: 0.02 }],
  },
  {
    name: 'guns drifting apart',
    blurb:
      'Misconvergence inside the loop: every lap lands the red and blue guns a little further off the green at the edge, and the collapse stacks the errors into shells.',
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
    name: 'encoder backwards',
    blurb:
      'The encoder inverting active video, inside the loop. Every lap is the negative of the one under it, so the tunnel alternates polarity ring by ring while the sync tip rides through untouched.',
    patch: {
      invert: 1,
      fbMix: 0.9,
      fbGain: 1.18,
      fbZoom: 0.94,
      fbVign: 0.4,
      fbBlack: 0.03,
      fbKnee: 0.55,
      chromaGain: 1.3,
    },
    mod: [{ target: 'fbZoom', source: 'sine', rateHz: 0.03, depth: 0.006 }],
  },
  {
    name: 'the yoke closing',
    blurb:
      'Vertical deflection short of full scan, inside the loop. The lap shrinks faster down the frame than across it, so the picture drains into a band instead of a tunnel.',
    patch: {
      vSize: 0.9,
      fbMix: 0.9,
      fbGain: 1.2,
      fbZoom: 0.99,
      fbVign: 0.35,
      fbBlack: 0.04,
      chromaGain: 1.2,
    },
    mod: [{ target: 'vSize', source: 'sine', rateHz: 0.04, depth: 0.02 }],
  },
  {
    name: 'a magnet on the glass',
    blurb:
      'A magnetised patch of mask, which is fixed to the tube while the loop turns what is under it. The stain tints a different part of the picture every lap and the transport winds the tinted part away from it.',
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
    name: 'the corrector in the loop',
    blurb:
      "A VIR set trimming its hue off line 19, inside a loop, with enough channel damage that line 19 is not worth trusting. The corrector's integrators swing the whole picture and the loop photographs the swing at every age.",
    patch: {
      vir: 1,
      virLag: 18,
      noiseIre: 4,
      tbJitterNs: 250,
      dropoutRate: 40,
      dropoutLenUs: 6,
      fbMix: 0.88,
      fbGain: 1.2,
      fbZoom: 0.97,
      fbVign: 0.3,
      chromaGain: 1.3,
      agc: 0.5,
    },
    mod: [
      { target: 'dropoutRate', source: 'smooth', rateHz: 0.06, depth: 0.1 },
    ],
  },
  {
    name: 'the hand on the chassis',
    blurb:
      "A paperclip on the chroma demodulator's reference network, a contact or so a second, over a loop that is otherwise a clean collapse. It rests photographic, detonates hue for a tenth of a second, and the loop keeps what the bite made for seconds afterwards.",
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

  // ---- inside the mixer loop: the channel block, once per lap ----
  {
    name: 'stick-slip in the store',
    blurb:
      "Sticky-shed shear, captured. The tape's own relaxation oscillator throws a band of the frame sideways, the store keeps it, and the next lap shears the shear.",
    patch: {
      tbStickNs: 5000,
      cfbMix: 0.88,
      cfbGain: 1.03,
      cfbDelayUs: 0.6,
      cfbLines: 2,
      cfbGenlock: 1,
      colorUnderMix: 0.6,
      chromaGain: 1.4,
      noiseIre: 1.5,
    },
    mod: [{ target: 'tbStickNs', source: 'smooth', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'cueing into the store',
    blurb:
      'Picture search into a frame store. Each sweep of the head lays its noise bars at a different phase, the store holds the last one, and the bars beat against themselves into a moving lattice.',
    patch: {
      shuttleX: 4,
      cfbMix: 0.88,
      cfbGain: 1.02,
      cfbDelayUs: 0.4,
      cfbLines: 3,
      cfbTrail: 0.6,
      cfbGenlock: 1,
      lumaMHz: 2.8,
      colorUnderMix: 1,
      hHold: 0.35,
      chromaGain: 1.4,
      noiseIre: 2,
    },
    mod: [
      { target: 'shuttleX', source: 'triangle', rateHz: 0.03, depth: 0.06 },
    ],
  },
  {
    name: 'the compensator guesses',
    blurb:
      'A dropout compensator patching from one line back, inside a loop, on a tape dropping out constantly. The line it patches from is loop content, 227.5 subcarrier cycles away, so every patch arrives in the complementary hue and the patched territory spreads.',
    patch: {
      dropoutRate: 150,
      dropoutLenUs: 10,
      dropoutComp: 1,
      cfbMix: 0.9,
      cfbGain: 1.03,
      cfbDelayUs: 0.5,
      cfbLines: 1,
      cfbGenlock: 1,
      colorUnderMix: 1,
      chromaGain: 1.6,
      noiseIre: 2,
    },
    mod: [
      { target: 'dropoutRate', source: 'smooth', rateHz: 0.06, depth: 0.15 },
    ],
  },
  {
    name: 'the servo never settles',
    blurb:
      'The auto-tracking servo hunting, with a beam limiter hunting beside it on a different clock, and a loop holding every position both of them tried.',
    patch: {
      trackAmt: 0.55,
      trackPos: 0.7,
      trackHunt: 1,
      trackKick: 0.9,
      abl: 0.7,
      cfbMix: 0.88,
      cfbGain: 1.04,
      cfbDelayUs: 0.5,
      cfbLines: -3,
      cfbTrail: 0.55,
      cfbGenlock: 1,
      colorUnderMix: 1,
      chromaGain: 1.3,
      noiseIre: 2,
    },
  },
  {
    name: 'the ripple multiplies',
    blurb:
      'Mains ripple inside a line amp, which multiplies instead of adding, inside a loop. Lap N has been through the multiply N times, so the hum bands sharpen from a shading into hard rungs that drift at the beat between mains and field rate.',
    patch: {
      humAmp: 22,
      humMod: 1,
      cfbMix: 0.9,
      cfbGain: 1.04,
      cfbDelayUs: 0.7,
      cfbLines: 4,
      cfbGenlock: 1,
      chromaGain: 1.4,
      noiseIre: 1.5,
    },
    mod: [{ target: 'humAmp', source: 'smooth', rateHz: 0.05, depth: 0.08 }],
  },
  {
    name: 'a carrier through the shield',
    blurb:
      'Somebody keying up on a cracked cable, and a store behind them. The herringbone the carrier lays goes round with the picture, so the sweep is on screen at every age at once instead of only where it is now.',
    patch: {
      ingress: 0.7,
      cfbMix: 0.88,
      cfbGain: 1.02,
      cfbDelayUs: 0.8,
      cfbLines: -2,
      cfbGenlock: 1,
      chromaGain: 1.6,
      noiseIre: 1.2,
    },
    mod: [{ target: 'ingress', source: 'smooth', rateHz: 0.06, depth: 0.2 }],
  },
  {
    name: 'the detailer inside the loop',
    blurb:
      "The outboard enhancer's own resonator, which sits inside the mixer loop's round trip, ringing at 2.4 MHz with the loop feeding it its own ringing.",
    patch: {
      enhPeakMHz: 2.4,
      enhPeakQ: 0.8,
      enhPeakBoost: 3,
      cfbMix: 0.8,
      cfbGain: 1.02,
      cfbDelayUs: 0.6,
      cfbLines: 1,
      cfbGenlock: 1,
      chromaGain: 1.4,
      noiseIre: 1.5,
    },
  },
  {
    name: 'both clocks',
    blurb:
      'The electrical loop reading its store off a clock a fraction fast, so hue fans along every line, and the optical loop rotating that fan a few degrees a lap. One box writes the colour and the other winds it.',
    patch: {
      cfbMix: 0.85,
      cfbGain: 1.02,
      cfbClockPct: 0.4,
      cfbDelayUs: 0.2,
      cfbLines: 1,
      cfbGenlock: 1,
      fbMix: 0.85,
      fbGain: 1.2,
      fbZoom: 0.97,
      fbRotateDeg: 2.5,
      chromaGain: 1.8,
      noiseIre: 1.2,
    },
    mod: [
      { target: 'cfbClockPct', source: 'smooth', rateHz: 0.04, depth: 0.06 },
    ],
  },
  {
    name: 'one head packed',
    blurb:
      'A clogged head collapsing alternate sweeps to snow, with the store one line off, so the good sweeps and the dead ones interleave into a comb the loop keeps rebuilding.',
    patch: {
      headClog: 0.75,
      cfbMix: 0.9,
      cfbGain: 1.04,
      cfbDelayUs: 0.5,
      cfbLines: 1,
      cfbTrail: 0.6,
      cfbGenlock: 1,
      colorUnderMix: 1,
      chromaGain: 1.4,
      noiseIre: 2,
    },
  },
]

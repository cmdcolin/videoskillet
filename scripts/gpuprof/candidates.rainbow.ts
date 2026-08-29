// Ten routes to colour made by arithmetic rather than by a tint knob — and the
// screening that showed most of them are the same route.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     candidates --spec=scripts/gpuprof/candidates.rainbow.ts
//
// **`cfbRing` does not make rainbows. It takes colour away.** Six of the ten
// below are built on it and they render as the same desaturated grey-blue wash,
// within a point of each other on every measure — the detune, the line offset,
// the defeated trap, the sheared demod axis and the notch all make no
// difference worth seeing. The mechanism is why: ring-modulating the loop bus
// against the live program multiplies two signals whose subcarriers sit on the
// *same crystal*, so the products land at the sum (7.16 MHz, above the chroma
// passband) and the difference (DC, which is luma). The chroma filter throws
// away the first and the second is not colour any more. Pulling the crystal
// 60 kHz does not help: 60 kHz off 3.58 MHz is still DC to within the
// passband's ability to care.
//
// What does make colour by multiplication is two terms at *genuinely* different
// frequencies, so the difference lands back inside the chroma band at a phase
// nothing put there:
//
//   - `bRing` with `bDetuneHz` — B's subcarrier against A's, kilohertz apart.
//     Renders saturated colour bands, and at bGain 0.55 it also renders at mean
//     209, which is blown out: the level wants pulling well back.
//   - the synth oscillator near 3.58 MHz over the picture (`synthOver`,
//     `synthColor`), which translates luma up into the chroma band — brightness
//     arriving as hue. Strong, but one hue at a time; the colorizer wants
//     sweeping to get a spectrum rather than an olive wash.
//
// `rainbowStorm` already owns the obvious route — a crystal pulled off
// frequency, so hue shears and barber-poles down the frame. Nothing here
// repeats it.
//
// Kept as the record of a negative result. Re-run it before believing any of
// the six.

import type { Controls } from '../../src/core/controls'

export interface Candidate {
  name: string
  blurb: string
  patch: Partial<Controls>
}

export const candidates: Candidate[] = [
  {
    name: 'ring rainbow',
    blurb:
      'The loop bus multiplied against the live picture and nothing else touched. Subcarrier times subcarrier lands energy at the sum and the difference, neither of which the picture carried, so the colour is arithmetic on two frames rather than anything either frame was.',
    patch: {
      cfbMix: 0.7,
      cfbGain: 1,
      cfbDelayUs: 0.35,
      cfbRing: 0.9,
      chromaGain: 1.6,
    },
  },
  {
    name: 'ring beat',
    blurb:
      'The same multiplication with the crystal pulled a few kilohertz off. The ring products and the decoder now disagree about where zero degrees is, and the disagreement walks — so the bands the ring makes drift through the hues instead of standing still.',
    patch: {
      cfbMix: 0.68,
      cfbGain: 1,
      cfbDelayUs: 0.3,
      cfbRing: 0.85,
      scDetuneKHz: 3.5,
      burstLock: 0.7,
      chromaGain: 1.4,
    },
  },
  {
    name: 'ring ladder',
    blurb:
      'The multiplied loop returned one line down, so each generation of products lands under the last. The colour accumulates vertically and the frame builds a ladder of hues that were never in the source.',
    patch: {
      cfbMix: 0.72,
      cfbGain: 1,
      cfbLines: 1,
      cfbDelayUs: 0.25,
      cfbRing: 0.8,
      chromaGain: 1.5,
    },
  },
  {
    name: 'double ring',
    blurb:
      'Both multipliers at once — the B deck rung against the program, and the loop bus rung against the result. Products of products, and the second stage has no idea the first was not a picture.',
    patch: {
      bGain: 0.5,
      bRing: 0.7,
      cfbMix: 0.6,
      cfbGain: 1,
      cfbDelayUs: 0.4,
      cfbRing: 0.7,
      chromaGain: 1.3,
    },
  },
  {
    name: 'deck ring',
    blurb:
      'The B deck alone, multiplied against the program instead of mixed with it. One stage, so the products stay legible as products — this is the one to read before the stacked ones.',
    patch: { bGain: 0.65, bRing: 0.85, chromaGain: 1.4 },
  },
  {
    name: 'ring past the trap',
    blurb:
      'The ring products sent round the loop and into the luma path as well, with the chroma trap defeated. What was colour arithmetic a generation ago comes back as brightness, gets re-encoded, and is colour again — by a different route each lap.',
    patch: {
      cfbMix: 0.65,
      cfbGain: 1,
      cfbDelayUs: 0.3,
      cfbRing: 0.75,
      svideoBleed: 0.62,
      chromaGain: 1.2,
    },
  },
  {
    name: 'sheared ring',
    blurb:
      "The demodulator's two axes pulled toward each other, so the hue wheel collapses toward a line — and the ring products, which are spread all over that wheel, come back down onto one axis as a two-colour split rather than a spectrum.",
    patch: {
      cfbMix: 0.66,
      cfbGain: 1,
      cfbDelayUs: 0.35,
      cfbRing: 0.8,
      demodAxisDeg: 128,
      chromaGain: 1.5,
    },
  },
  {
    name: 'upsample rainbow',
    blurb:
      'No ring at all: the chroma demodulated at every eighth sample and interpolated between, so reconstructed colour re-attaches to the wrong subcarrier phase at every edge. Fine detail blooms into rainbows because the decoder is guessing, and it guesses differently on each edge.',
    patch: { chromaCoarse: 8, chromaGain: 1.5, lumaPeak: 1.4, combMode: 0 },
  },
  {
    name: 'ring into the comb',
    blurb:
      'The multiplied loop decoded through a notch instead of a comb, which is the setting that lets cross-colour survive. Luma detail and ring product arrive in the chroma band together and the decoder cannot tell them apart.',
    patch: {
      cfbMix: 0.7,
      cfbGain: 1,
      cfbDelayUs: 0.28,
      cfbRing: 0.8,
      combMode: 0,
      lumaPeak: 1.5,
      chromaGain: 1.4,
    },
  },
  {
    name: 'quiet ring',
    blurb:
      'The same multiplication run gently, over a picture left otherwise intact: the shapes stay readable and the colour on them is arithmetic. The one here that could sit under content rather than replace it.',
    patch: {
      cfbMix: 0.4,
      cfbGain: 0.95,
      cfbDelayUs: 0.5,
      cfbRing: 0.55,
      chromaGain: 1.15,
      phosphor: 0.3,
    },
  },
]

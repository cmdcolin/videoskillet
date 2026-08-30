// The two routes that survived `candidates.rainbow.ts`, worked properly.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     candidates --spec=scripts/gpuprof/candidates.rainbow2.ts
//
// Both put the two multiplied terms at genuinely different frequencies, which
// is the whole difference from the six that failed: a product only reads as
// colour if it lands inside the chroma passband, and two signals on the same
// crystal put theirs at DC and 7.16 MHz where nothing can see them.
//
//   1. `bRing` with `bDetuneHz` — B's subcarrier against A's, kilohertz apart.
//      The level is the trap: at bGain 0.55 this renders at mean 209, blown
//      out. Everything here runs it at a third of that.
//   2. The synth oscillator over the picture. Two ways: an oscillator *at* the
//      subcarrier translates luma up into the chroma band, so brightness
//      arrives as hue; and `synthMix: ring mod` with osc B down at audio rate
//      puts both sidebands inside the passband with no carrier between them,
//      which is a suppressed-carrier colour signal made of nothing.

//
// Screened. What the frames said, beyond what the numbers did:
//
//   - **The beat family wants graphic source.** On flat bars it is saturated
//     hue substitution and the best thing here; on the detail chart the noisy
//     half of the picture goes to white hash at every level tried, including
//     `bRing` at 0.35 with `aGain` pulled to 0.6. The blow-out is the product
//     itself, not the level: multiplying two whole composite signals, sync tips
//     and all, makes a big number. `bGain` barely touches it — `bRing` is the
//     fader here, and even at a third it blows.
//   - **The synth family is one mechanism at seven settings.** It places a
//     single hue rather than a spectrum. `synthHueDeg` does work — 0 is green,
//     120 lavender, 240 mauve — so the spectrum arrives by *sweeping* it, which
//     means the look lives in a modulation routing rather than in the patch.
//
// So neither is a rainbow on its own terms. One is a recolour you can aim, and
// the other is a hue rotation that needs a source without fine detail in it.

import type { Controls } from '../../src/core/controls'

export interface Candidate {
  name: string
  blurb: string
  patch: Partial<Controls>
}

const RING = 2 // synthMix: osc A × osc B
const PULSE = 3 // synthShape

export const candidates: Candidate[] = [
  {
    name: 'slow beat',
    blurb:
      'Two decks whose colour crystals are four hundred hertz apart, multiplied rather than mixed. The difference is slow enough to watch: the hue of the whole frame walks round the wheel and comes back.',
    patch: { bGain: 0.3, bRing: 0.9, bDetuneHz: 400, chromaGain: 1.4 },
  },
  {
    name: 'fast beat',
    blurb:
      'The same pair pulled two and a half kilohertz apart. Now the beat is quicker than the frame, so the rotation happens down the picture instead of across time and the frame holds a spectrum at once.',
    patch: { bGain: 0.3, bRing: 0.9, bDetuneHz: 2600, chromaGain: 1.4 },
  },
  {
    name: 'beat on the diagonal',
    blurb:
      "The beating pair with B's line rate pulled as well, so each line starts its rotation a little further round than the one above and the bands lean.",
    patch: {
      bGain: 0.32,
      bRing: 0.88,
      bDetuneHz: 1400,
      bLineHz: 14,
      chromaGain: 1.4,
    },
  },
  {
    name: 'beat rolling',
    blurb:
      'The same, with B free-running vertically. The colour pattern belongs to B, so it drifts up the frame while the picture stays where it is.',
    patch: {
      bGain: 0.3,
      bRing: 0.9,
      bDetuneHz: -1800,
      bRollLps: 3,
      chromaGain: 1.3,
    },
  },
  {
    name: 'inverted beat',
    blurb:
      "B's whole signal inverted before the multiplication, sync tips included, so the products land on the other side of everything and the dark half of the picture is where the colour goes.",
    patch: { bGain: 0.3, bRing: 0.9, bDetuneHz: 900, bInv: 1, chromaGain: 1.4 },
  },
  {
    name: 'carrier wash',
    blurb:
      'An oscillator sitting exactly on 3.58 MHz over the picture. It translates brightness straight up into the chroma band, so the decoder reads luma as hue and the picture comes back as one colour with its own shading.',
    patch: {
      synthOver: 0.5,
      synthAHz: 3579545,
      synthColor: 0.9,
      synthLevel: 0.9,
      chromaGain: 1.2,
    },
  },
  {
    name: 'carrier wash, turned',
    blurb:
      "The same translation with the colorizer's phase rotated most of the way round the wheel — the same mechanism landing on a different hue, which is what says the colour is arithmetic rather than a tint.",
    patch: {
      synthOver: 0.5,
      synthAHz: 3579545,
      synthColor: 0.9,
      synthHueDeg: 250,
      synthLevel: 0.9,
      chromaGain: 1.2,
    },
  },
  {
    name: 'luma to hue',
    blurb:
      'The oscillator pulled by the picture it is sitting on: bright regions push it further off the subcarrier than dark ones, so hue tracks brightness instead of standing at one colour.',
    patch: {
      synthOver: 0.5,
      synthAHz: 3500000,
      synthFm: 90000,
      synthColor: 0.9,
      synthLevel: 1,
      chromaGain: 1.2,
    },
  },
  {
    name: 'suppressed carrier',
    blurb:
      'Two oscillators multiplied — one on the subcarrier, one down at fifteen kilohertz. The product has sidebands either side of 3.58 and nothing in the middle, which is a colour signal with no carrier: hue that alternates, made of two tones neither of which is a picture.',
    patch: {
      synthOver: 0.55,
      synthMix: RING,
      synthAHz: 3579545,
      synthBHz: 15000,
      synthColor: 0.9,
      synthLevel: 1.1,
      chromaGain: 1.3,
    },
  },
  {
    name: 'suppressed, line-locked',
    blurb:
      'The same pair with the low oscillator sitting on the line rate, so the sidebands come back in step with the raster and the alternation stands still instead of crawling.',
    patch: {
      synthOver: 0.55,
      synthMix: RING,
      synthAHz: 3579545,
      synthBHz: 15734,
      synthColor: 0.9,
      synthLevel: 1.1,
      chromaGain: 1.3,
    },
  },
  {
    name: 'pulse carrier',
    blurb:
      'A square on the subcarrier rather than a sine. Its harmonics land all over the band the decoder is looking at, so instead of one translated hue there is a comb of them.',
    patch: {
      synthOver: 0.5,
      synthShape: PULSE,
      synthAHz: 3579545,
      synthColor: 0.95,
      synthLevel: 0.85,
      chromaGain: 1.3,
    },
  },
  {
    name: 'both routes',
    blurb:
      'The synth translating brightness into the chroma band, and the two decks beating against each other on top of it — colour arithmetic stacked on colour arithmetic, from two machines that do not know about each other.',
    patch: {
      synthOver: 0.4,
      synthAHz: 3579545,
      synthColor: 0.85,
      synthLevel: 0.7,
      bGain: 0.25,
      bRing: 0.85,
      bDetuneHz: 1100,
      chromaGain: 1.3,
    },
  },
]

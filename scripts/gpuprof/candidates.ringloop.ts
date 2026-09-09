// Ring modulator against the mixer loop: the combinations the library does not
// have yet.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     candidates --spec=scripts/gpuprof/candidates.ringloop.ts
//
// The library already carries the multiplier against the program (`ringLoop`),
// against the box's own oscillator (`lightBecomesHue`, `theSecondCrystal`),
// under both keyers (`ringInTheHighlights`, `chasingItsOwnColour`,
// `itOnlyEatsTheRed`), on a Lorenz (`ringStorm`) and on the bass
// (`ringOnTheBeat`). What none of them do is put the multiplier next to the
// other four boxes in the same rack — the Y/C separator on the return, the read
// clock, the resonant network and the varactor — and each of those pairs is a
// different arrangement rather than a retune:
//
//   - The separator decides what the modulator has to work with. On the luma
//     wire the return carries no chroma at all, so the swap the modulator
//     performs only runs one way; on the chroma wire the brightness it
//     translates up is the live picture's, not the loop's.
//   - The read clock and the modulator both write hue, one by stretching the
//     lattice and one by inventing a carrier, and each lap re-does both.
//   - A resonant loop past unity in-band generates a carrier of its own, which
//     is the one thing in this rack that can be an input to a multiplier
//     without coming from a picture or an oscillator.
//   - The varactor makes the displacement a map of the video, and with the
//     modulator on the oscillator that video is colour the box invented a lap
//     ago.
//
// Everything here keeps `cfbGenlock` at 1: docs/CURATION.md's loop round found
// that a loop displacing inside the line takes the sync tip round with it and
// throws its own structure across a raster that is no longer there, and none of
// these is a look about losing the raster.
//
// What the round found. Five shipped, and the six that did not are worth the
// lines because each names a pairing that reads well on paper:
//
//   - `the picture is the envelope` and `multiplied against a still` both put
//     the multiplier on the *program*, and docs/CURATION.md's finding holds
//     wherever the rest of the patch goes: both sides on one crystal, products
//     at DC and 7.16 MHz, and the chroma filter keeps neither. They rendered at
//     csd 2.5 and 7.3 against the shipped five's 16-42. The resonator one is
//     also a fine grey mesh with the picture gone, which is the texture the
//     screening rounds cut on sight.
//   - `ringing on the subcarrier` is the same network on the oscillator and it
//     works — csd 45.8, the boldest thing in the sheet — at motion 91-96, which
//     is deep in the band the wild round cut as chaos. Pulling the boost from
//     1.6 to 1.25 and to 1.05 took the bars away and left soft blobs at motion
//     90 either way, so the structure and the chaos are the same setting.
//   - `a generation a lap` has a drain in it: the colour-under path bandlimits
//     chroma to 629 kHz every generation, so what the modulator manufactures is
//     eaten faster than it is made. csd 6.6.
//   - `warped by what it invented` is the varactor, which `meltdown` and the
//     two `warp in the...` looks already own, and it landed grey at csd 13.6.
//   - `lens and multiplier` above unity is the camera loop taking the frame
//     (a green vignette round a magenta core, no picture); brought back under
//     unity it is `both loops` with a multiplier nobody can see, csd 2.4.
//
// `clock and crystal` below carries its retune: 0.25% of read-clock error and
// a 8 kHz detune rendered as grey hash, and doubling both is what made the fan
// legible. The other four shipped as they are written here.

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
    name: 'luma up the carrier',
    blurb:
      "Y/C separator on the return with the luma wire round the loop, into the modulator's oscillator input. The return carries brightness and the sync tip and no chroma at all, so the encoder-modulator has nothing to translate down — the swap only runs one way, brightness up into the chroma band, and the colour laid back over it is the live picture's own.",
    patch: {
      cfbMix: 0.9,
      cfbGain: 1.02,
      cfbDelayUs: 0.5,
      cfbLines: 2,
      cfbReturn: 2,
      cfbRing: 0.9,
      cfbRingSrc: 1,
      cfbCarrierKHz: 6,
      chromaGain: 1.6,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
  },
  {
    name: 'the light is a lap behind',
    blurb:
      "The other wire off the same separator. The loop's colour goes round over live brightness, and the modulator then trades the two: the brightness it lifts into the chroma band is current, and the colour it drops into brightness is the accumulation. So the frame's light is a record of hue that is seconds old and its hue is the picture as it is now.",
    patch: {
      cfbMix: 0.88,
      cfbGain: 1.02,
      cfbDelayUs: 0.35,
      cfbLines: 2,
      cfbReturn: 1,
      cfbRing: 1,
      cfbRingSrc: 1,
      chromaGain: 1.8,
      crtSat: 1.2,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
  },
  {
    name: 'clock and crystal',
    blurb:
      'The read clock fans hue along every line, and the modulator is what makes the hue there is to fan. One lap invents colour out of brightness on the second crystal; the next lap reads that colour back at a rate a quarter of a percent off the one it was written at, so it opens across the line, and modulates what it opened.',
    patch: {
      cfbMix: 0.85,
      cfbGain: 1.02,
      cfbClockPct: 0.5,
      cfbDelayUs: 0.15,
      cfbLines: 1,
      cfbRing: 0.95,
      cfbRingSrc: 1,
      cfbCarrierKHz: 16,
      chromaGain: 1.8,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
    mod: [
      { target: 'cfbClockPct', source: 'smooth', rateHz: 0.04, depth: 0.06 },
    ],
  },
  {
    name: 'the picture is the envelope',
    blurb:
      "A resonant network across the loop, brought past unity in its band so the loop generates a standing pattern out of nothing, with the multiplier taking the live picture as its other input. The oscillation is the carrier and the picture is what modulates it, so the pattern is only where the picture is and carries the picture's own brightness as its amplitude.",
    patch: {
      cfbMix: 0.7,
      cfbGain: 1.05,
      cfbDelayUs: 0.3,
      cfbLines: 1,
      cfbFilterMHz: 2.4,
      cfbFilterQ: 0.6,
      cfbFilterBoost: 1.4,
      cfbRing: 0.8,
      chromaGain: 1.4,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
  },
  {
    name: 'ringing on the subcarrier',
    blurb:
      'The same network tuned to the colour subcarrier instead of picture detail, so what the loop generates is already inside the chroma band, and the modulator on its own oscillator translates the picture up to meet it. Two carriers a few kilohertz apart, one the loop made and one the box holds, beating where the decoder can only read the beat as colour.',
    patch: {
      cfbMix: 0.68,
      cfbGain: 1.04,
      cfbDelayUs: 0.25,
      cfbLines: 1,
      cfbFilterMHz: 3.6,
      cfbFilterQ: 0.7,
      cfbFilterBoost: 1.6,
      cfbRing: 0.75,
      cfbRingSrc: 1,
      cfbCarrierKHz: 14,
      chromaGain: 1.5,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
  },
  {
    name: 'keyed on its own invention',
    blurb:
      'The modulator paints a hue out of brightness and the keyer is set to that hue, so the only thing allowed to keep regenerating is colour the box itself invented a lap ago. Self-limiting, because the delay turns every return further round the wheel: a region holds its territory until its own product leaves the wedge, then hands it to whatever has turned in behind it.',
    patch: {
      cfbMix: 0.9,
      cfbGain: 1.1,
      cfbDelayUs: 1,
      cfbLines: 1,
      cfbRing: 1,
      cfbRingSrc: 1,
      cfbCarrierKHz: 5,
      cfbKey: 1,
      cfbKeyAcceptDeg: 55,
      cfbKeyHueDeg: 200,
      cfbKeySoft: 10,
      chromaGain: 1.6,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
  },
  {
    name: 'warped by what it invented',
    blurb:
      "The varactor on the loop delay with the modulator on the box's own oscillator. The delay is pulled by the level of the video going through it, and that video is now colour the modulator manufactured out of last lap's brightness — so the displacement field is a map of invented hue, and a sample of pull is another ninety degrees of it.",
    patch: {
      cfbMix: 0.85,
      cfbGain: 1.04,
      cfbDelayUs: 0.8,
      cfbLines: 1,
      cfbServoUs: -30,
      cfbRing: 0.85,
      cfbRingSrc: 1,
      cfbCarrierKHz: 10,
      chromaGain: 1.6,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
    mod: [{ target: 'cfbServoUs', source: 'sine', rateHz: 0.05, depth: 0.2 }],
  },
  {
    name: 'multiplied against a still',
    blurb:
      "The frame store held for six frames at a time, so the multiplier's other input is a picture that stops being current and stays that way. Between grabs the live frame slides continuously against a fixed past and the products drift with it; on the grab the whole reference changes at once. A rhythm the loop is keeping rather than a rate anything is set to.",
    patch: {
      cfbMix: 0.9,
      cfbGain: 1.02,
      cfbHold: 6,
      cfbDelayUs: 0.6,
      cfbLines: 1,
      cfbRing: 0.9,
      chromaGain: 1.5,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
  },
  {
    name: 'lens and multiplier',
    blurb:
      'The optical loop collapsing inward past unity while the electrical one multiplies what it hands over. The camera decides where the picture is and the modulator decides what colour it comes back as, and neither can do the other job — a lens cannot invent a hue and a bridge cannot move a corridor.',
    patch: {
      fbMix: 0.85,
      fbGain: 1.25,
      fbZoom: 0.96,
      fbVign: 0.4,
      fbBlack: 0.04,
      cfbMix: 0.75,
      cfbGain: 1.02,
      cfbDelayUs: 0.9,
      cfbRing: 0.8,
      cfbRingSrc: 1,
      chromaGain: 1.5,
      cfbGenlock: 1,
    },
    mod: [{ target: 'fbZoom', source: 'smooth', rateHz: 0.05, depth: 0.02 }],
  },
  {
    name: 'sheared and stacked',
    blurb:
      'The multiplier on the oscillator with the loop stepping twenty lines a lap, so every band down the frame is a generation further through the swap: light, then hue, then light again. The demodulator is off quadrature, so the plane those products land on is sheared and neighbouring bands come back in colours that are not opposites of each other.',
    patch: {
      cfbMix: 0.82,
      cfbGain: 1.02,
      cfbDelayUs: 1.1,
      cfbLines: 20,
      cfbRing: 0.95,
      cfbRingSrc: 1,
      cfbCarrierKHz: 4,
      demodAxisDeg: 62,
      chromaGain: 1.7,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
    mod: [
      { target: 'cfbLines', source: 'triangle', rateHz: 0.03, depth: 0.05 },
    ],
  },
  {
    name: 'a generation a lap',
    blurb:
      'The multiplier inside a loop whose bus has already been down two tape generations, so what goes round is re-recorded as well as re-multiplied. The colour-under path eats a little chroma every pass and the modulator manufactures more of it out of the brightness that survived, which is a loop with a source of colour inside it and a drain beside it.',
    patch: {
      dubGens: 2,
      colorUnderMix: 1,
      underJitterDeg: 6,
      cfbMix: 0.86,
      cfbGain: 1.04,
      cfbDelayUs: 0.7,
      cfbLines: 1,
      cfbRing: 0.9,
      cfbRingSrc: 1,
      cfbCarrierKHz: 9,
      chromaGain: 1.6,
      noiseIre: 2,
      cfbGenlock: 1,
    },
  },
]

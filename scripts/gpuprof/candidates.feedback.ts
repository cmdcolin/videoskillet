// Feedback candidates for screening: the two loops that survived the cut, run
// at settings meant to be dramatic rather than tasteful.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     candidates --spec=scripts/gpuprof/candidates.feedback.ts
//
// What the previous screening round (scripts/candidates.example.mjs) already
// ruled out, and which nothing here repeats:
//
//   - A camera loop at unity `fbGain` just dims away. Every pass is darker than
//     the last, the geometry never accumulates, and the frame reads as the
//     source slightly soft. Everything below runs the camera loop above unity.
//   - A mixer loop at `cfbMix` .5–.7 with a sub-microsecond delay is the source
//     with grain on it.
//   - `cfbFilterQ` .7+ over boost 2 takes the picture away entirely and
//     flickers hard enough to be unpleasant.
//   - Keying the loop is what puts the ringing back *on* the picture instead of
//     over it. Three of these key it.

import type { Controls } from '../../src/core/controls'

export interface Candidate {
  name: string
  blurb: string
  patch: Partial<Controls>
}

export const candidates: Candidate[] = [
  {
    name: 'zoom bloom',
    blurb:
      'The camera pushed in a couple of percent a pass, above unity so the geometry accumulates instead of dimming out. Highlights breed toward the middle.',
    patch: {
      fbMix: 0.62,
      fbGain: 1.07,
      fbZoom: 1.02,
      fbBlack: 0.05,
      phosphor: 0.6,
    },
  },
  {
    name: 'tunnel out',
    blurb:
      'The same loop pulled the other way: each pass a shade smaller, so the picture falls away from itself down a corridor rather than growing out of the frame.',
    patch: {
      fbMix: 0.66,
      fbGain: 1.06,
      fbZoom: 0.975,
      fbVign: 0.45,
      phosphor: 0.5,
    },
  },
  {
    name: 'spiral',
    blurb:
      'Three degrees of rotation a pass on top of a slight zoom — the two together are what makes a spiral rather than a ring.',
    patch: {
      fbMix: 0.7,
      fbGain: 1.05,
      fbZoom: 1.012,
      fbRotateDeg: 3.2,
      phosphor: 0.55,
    },
  },
  {
    name: 'iris hunt',
    blurb:
      'The auto-iris servo undamped and left to hunt inside a loop it is metering. The exposure pumps at its own rate, and the loop photographs the pumping.',
    patch: {
      fbMix: 0.68,
      fbGain: 1.12,
      fbZoom: 1.015,
      fbIris: 0.85,
      phosphor: 0.6,
    },
  },
  {
    name: 'defocus blobs',
    blurb:
      'A loop that cannot hold detail: every pass is softer than the last, so only what is bright enough to survive the blur keeps going round.',
    patch: {
      fbMix: 0.72,
      fbGain: 1.14,
      fbFocus: 6,
      fbZoom: 1.008,
      fbBlack: 0.06,
    },
  },
  {
    name: 'drift smear',
    blurb:
      'No zoom and no rotation — just a shift, so each pass lands beside the last and the picture drags itself across the frame in its own copies.',
    patch: {
      fbMix: 0.7,
      fbGain: 1.08,
      fbZoom: 1,
      fbShiftX: 0.012,
      fbShiftY: -0.006,
      phosphor: 0.7,
    },
  },
  {
    name: 'subcarrier comb',
    blurb:
      'A mixer loop at a delay near the subcarrier period, so what comes back is a quarter cycle out and the hue rotates a step every generation.',
    patch: { cfbMix: 0.82, cfbGain: 0.98, cfbDelayUs: 0.14, chromaGain: 1.3 },
  },
  {
    name: 'line ladder',
    blurb:
      'The loop returned two lines down. Each generation steps further, so the picture climbs the frame as a staircase of itself rather than sitting on top of it.',
    patch: {
      cfbMix: 0.78,
      cfbGain: 0.99,
      cfbLines: 2,
      cfbDelayUs: 0.3,
      phosphor: 0.4,
    },
  },
  {
    name: 'keyed resonator',
    blurb:
      'A resonant loop keyed to the bright half of the picture: the ringing only exists where there is light to sustain it, so it weaves into the image instead of covering it.',
    patch: {
      cfbMix: 0.7,
      cfbGain: 1.05,
      cfbDelayUs: 0.22,
      cfbFilterMHz: 1.4,
      cfbFilterQ: 0.62,
      cfbFilterBoost: 2.4,
      cfbKey: 0.8,
      cfbKeyLevel: 48,
      cfbKeySoft: 9,
    },
  },
  {
    name: 'shadow resonator',
    blurb:
      'The same rig keyed the other way — the loop lives in the dark parts, so the ringing fills the shadows and the lit picture stays clean.',
    patch: {
      cfbMix: 0.72,
      cfbGain: 1.04,
      cfbDelayUs: 0.26,
      cfbFilterMHz: 2.1,
      cfbFilterQ: 0.58,
      cfbFilterBoost: 2.2,
      cfbKey: -0.75,
      cfbKeyLevel: 40,
      cfbKeySoft: 7,
    },
  },
  {
    name: 'ring loop',
    blurb:
      'The loop bus multiplied against the live picture instead of summed with it, so every generation lands colour at sum and difference phases neither frame contained.',
    patch: {
      cfbMix: 0.62,
      cfbGain: 1,
      cfbDelayUs: 0.4,
      cfbRing: 0.65,
      chromaGain: 1.2,
    },
  },
  {
    name: 'servo warp',
    blurb:
      "A varactor on the loop's own delay, driven by the video going through it: bright picture pulls its own timebase, so the returning frame bends where it was lit.",
    patch: {
      cfbMix: 0.74,
      cfbGain: 1.02,
      cfbDelayUs: 1.2,
      cfbServoUs: 34,
      phosphor: 0.45,
    },
  },
  {
    name: 'strobed trail',
    blurb:
      'The loop re-photographed every fourth frame instead of every frame, with trails on — the echo arrives in steps rather than as a smear.',
    patch: {
      cfbMix: 0.8,
      cfbGain: 1,
      cfbHold: 4,
      cfbTrail: 0.8,
      cfbDelayUs: 0.5,
      phosphor: 0.65,
    },
  },
  {
    name: 'both loops',
    blurb:
      'Camera and mixer at once, each modest: the optical loop can only do what a lens can and the electrical one carries the subcarrier, so the two disagree about what the picture is.',
    patch: {
      fbMix: 0.5,
      fbGain: 1.05,
      fbZoom: 1.014,
      fbRotateDeg: -1.5,
      cfbMix: 0.55,
      cfbGain: 1,
      cfbDelayUs: 0.18,
      phosphor: 0.5,
    },
  },
]

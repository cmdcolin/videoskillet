// More in the vein of `beamBendsItsOwnScan`: the loop's own content deciding
// what the loop does to it, rather than a number somebody typed.
//
//   deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/sheet.ts \
//     candidates --spec=scripts/gpuprof/candidates.selfbend.ts
//
// What separates that preset from `flagOnEveryLap` beside it: a flag is a fixed
// shape that accumulates, and the sag is a *field* the picture writes. Every arm
// here is one of those. `sync.wgsl` integrates a second-order tank down the
// raster, driven by each line's own mean beam current:
//
//   w    = mix(0.35, 0.08, hvRing)    tank frequency, rad/line
//   damp = mix(0.55, 0.015, hvRing)   loss per line
//   vel += w * (load - sag) - damp * vel
//
// so `hvRing` is not a texture knob. It decides how much of the picture *above*
// a line is still in that line's displacement — a tight tank traces the row
// brightness almost literally, a loose one carries the memory of every band it
// has passed and rings on past them. The shipped preset sits at 0.55, halfway
// between two different instruments, and both ends are worth having.
//
// Two things this round already knows and does not need to re-learn: chroma
// trims compound once per generation inside this loop (docs/CURATION.md), so
// nothing here carries one; and a bend throws content off the raster and never
// gets it back, so the vignette stays near zero and the limiter stays off the
// drive unless the limiter is the point.
//
// Not in this vein, checked and dropped before rendering: `scanBloom` reads
// beam current per pixel but lives in `present.wgsl`, which is downstream of
// `crt_face` and therefore outside the loop — it cannot compound.

import type { Controls } from '../../src/core/controls'
import type { LooseRouting } from './render'

export interface Candidate {
  name: string
  blurb: string
  patch: Partial<Controls>
  mod?: readonly LooseRouting[]
}

// The transport `beamBendsItsOwnScan` settled on: a collapse well past unity
// with the light left in, so what varies below is the mechanism and not the
// camera.
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
    name: 'the tank ringing',
    blurb:
      'The same supply left almost lossless. The tank rings for most of a frame after every bright band, so a line is displaced by content that passed forty lines ago and the frame fills with standing waves that no longer sit where the thing that caused them is.',
    patch: { ...RIG, hvSagUs: 45, hvRing: 0.9, abl: 0.15 },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'the tank tight',
    blurb:
      "The other end of the same dial: heavy loss, fast tank, so the bend follows each line's own beam current and almost nothing else. The raster becomes a relief map of the picture rather than a wave, and the loop photographs the relief and maps it again.",
    patch: { ...RIG, hvSagUs: 65, hvRing: 0.06, abl: 0.15 },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'the supply wired backwards',
    blurb:
      'The sag reversed. The load term is already signed about mid-grey, so this does not key the bend to the dark half — it mirrors the whole field, and every line that was thrown right is thrown left. On a still picture that is the same bend reflected; what it does inside a loop is the question.',
    patch: { ...RIG, hvSagUs: -55, hvRing: 0.5, abl: 0.15 },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
  {
    name: 'the limiter and the tank',
    blurb:
      'Both servos reading the same beam current and doing different things with it: the tank bends the scan by it, the limiter hauls the drive down by it, and the drive it hauls down is what the tank is measuring. Neither can settle while the other moves.',
    patch: { ...RIG, hvSagUs: 55, hvRing: 0.45, abl: 0.9, agc: 0.5 },
    mod: [{ target: 'abl', source: 'smooth', rateHz: 0.05, depth: 0.12 }],
  },
  {
    name: 'the tank and the varactor',
    blurb:
      "Both loops displacing by their own content, in different domains. The supply bends the scan by beam current per line; the varactor on the mixer loop's delay pulls the timebase by the video going through it, per sample. One is geometry after decoding, the other is the waveform itself, and they disagree about where the picture is.",
    patch: {
      ...RIG,
      hvSagUs: 40,
      hvRing: 0.5,
      abl: 0.15,
      cfbMix: 0.7,
      cfbGain: 1.02,
      cfbDelayUs: 1,
      cfbServoUs: 28,
      cfbGenlock: 1,
    },
    mod: [{ target: 'cfbServoUs', source: 'sine', rateHz: 0.05, depth: 0.25 }],
  },
  {
    name: 'the halo keyed to the beam',
    blurb:
      'Halation whose radius is set by how hard the beam is driving, inside the loop. A highlight throws light further into the glass than a mid-tone does, that wider patch is brighter next lap, and it throws further again.',
    patch: {
      ...RIG,
      crtHalation: 1.6,
      crtHaloKey: 3,
      crtBloom: 0.5,
      fbGain: 1.22,
    },
    mod: [
      { target: 'crtHaloKey', source: 'smooth', rateHz: 0.05, depth: 0.15 },
    ],
  },
  {
    name: 'velocity modulation, wide',
    blurb:
      "The SVM coil retried with a wide aperture and a fraction of the drive. It multiplies the beam by the picture's own horizontal gradient, so every edge writes a white overshoot on one side and a black notch on the other, and next lap those are edges too.",
    patch: { ...RIG, crtSvm: 1.1, crtSvmWidth: 9, fbGain: 1.22 },
    mod: [{ target: 'crtSvm', source: 'sine', rateHz: 0.05, depth: 0.12 }],
  },
  {
    name: 'hue by brightness, per lap',
    blurb:
      'The chroma answer to the same question. A bent amplifier swings hue with the luma riding under it, so the colour a region comes back as is a function of how bright it was — and the loop applies that function again to what it made, so a trail separates into layers ordered by the brightness each layer started at.',
    patch: { ...RIG, diffPhaseDeg: 45, diffGain: 0.35, fbGain: 1.2 },
    mod: [
      { target: 'diffPhaseDeg', source: 'smooth', rateHz: 0.05, depth: 0.15 },
    ],
  },
  {
    name: 'the fold feeding itself',
    blurb:
      'FM over-deviation inside the loop: an edge bright enough to run the deviation past the discriminator folds to black and smears a streak rightward. The streak has its own hard edge, so next lap that edge folds too, and the black works its way back into the picture from every highlight it started at.',
    patch: { ...RIG, fmOverdev: 0.8, fmStreakUs: 1.2, fbGain: 1.22 },
    mod: [{ target: 'fmOverdev', source: 'smooth', rateHz: 0.05, depth: 0.15 }],
  },

  // the shipped one, unchanged, as the bar
  {
    name: 'beamBendsItsOwnScan, as shipped',
    blurb: 'For comparison.',
    patch: { ...RIG, hvSagUs: 45, hvRing: 0.55, abl: 0.2 },
    mod: [{ target: 'hvSagUs', source: 'sine', rateHz: 0.04, depth: 0.15 }],
  },
]

import { CONTROL_KEYS, DEFAULT_CONTROLS } from '../core/controls'
import { randomIndex } from '../core/rng'
import { SLIDER_BY_KEY, VIEW_KEYS, snapToStep } from './controls'
import {
  ROLL_NEVER_LANDS,
  ROLL_NEVER_STARTS,
  ROLL_STAYS_UNDER,
  rollLanding,
} from './mutate'

import type { ControlKey, Controls } from '../core/controls'
import type { ModRouting } from './modSlots'

export interface PresetDef {
  // Identifier: camelCase, no spaces, since it lands bare in `?preset=` and in
  // MIDI-binding storage keys. `displayName` carries the words a name needed.
  name: string
  // The multi-word form a single-word `name` couldn't hold. Absent means
  // `name` is already what a chip, palette row, or MIDI label should show.
  displayName?: string
  group: string
  blurb: string
  patch: Partial<Controls>
  // How the look moves, if it moves at all. A preset without one says nothing
  // about motion rather than asserting stillness: clearing the bay on every
  // chip click would make each one destroy hand-patched routings, and most
  // presets have no opinion about whether an LFO is running.
  //
  // Avoid targeting the five filter controls (encChromaMHz, demodMHz,
  // chromaTail, lumaMHz, lumaPeak) — modulating one rebuilds the FIR bank every
  // frame, which is a real cost to hang on a preset someone clicked casually.
  mod?: readonly ModRouting[]
}

// What a chip, palette row, or MIDI label should show — never the bare
// identifier when a preset has words that didn't fit in it.
export const presetLabel = (p: PresetDef): string => p.displayName ?? p.name

// The same, from a name rather than the preset itself — for the callers that
// hold only what `?preset=` or `mix.lastPreset` carries, which is the
// identifier. Falls back to the name it was given, so a stored look naming a
// preset that has since been retired reads as itself rather than as nothing.
//
// Worth having as a function: `PRESETS.find(...)?.displayName ?? name` was
// written out at two call sites and about to be at a third (a strip row's
// suggested name), and the failure it produces is silent — a row called
// "neonTube" where the chip beside it says "neon tube".
export const presetLabelFor = (name: string): string => {
  const found = PRESETS.find(p => p.name === name)
  return found === undefined ? name : presetLabel(found)
}

// Built-in presets are absolute: defaults + patch. Ordered by group so the UI
// can render them under labeled headers.
export const PRESETS: PresetDef[] = [
  {
    name: 'clean',
    group: 'Clean',
    blurb:
      'Pristine studio signal with no artifacts. The baseline everything else departs from.',
    patch: {},
  },
  {
    name: 'vhs',
    group: 'Tape wear',
    blurb:
      'Home VHS: softened luma, color-under chroma, light head-switch wobble and specks.',
    patch: {
      lumaMHz: 2.8,
      lumaPeak: 0.8,
      noiseIre: 3,
      colorUnderMix: 1,
      underJitterDeg: 4,
      tbJitterNs: 150,
      tbWowNs: 300,
      headSwitchShiftUs: 0.8,
      headSwitchNoise: 0.4,
      dropoutRate: 6,
      demodMHz: 0.5,
    },
  },
  {
    name: 'protectedTape',
    displayName: 'protected tape',
    group: 'Tape wear',
    blurb:
      "A rental tape with Macrovision on it, into a set whose AGC trusts the measurement. Pulses in the vertical interval inflate the measured sync depth, so the gain crushes and recovers on the process's own slow cycle. Colourstripe bands crawl down the frame in the wrong hue, and a vertical hold this marginal lets the flashing bar itself come into view.",
    patch: {
      macrovision: 0.9,
      mvStripeDeg: 110,
      agc: 1,
      vFreqHz: 59.9,
      vHold: 0.02,
      lumaMHz: 3,
      lumaPeak: 0.6,
      noiseIre: 2.5,
      colorUnderMix: 0.8,
      tbJitterNs: 120,
      headSwitchShiftUs: 0.6,
      headSwitchNoise: 0.3,
    },
  },
  {
    name: 'wornTape',
    displayName: 'worn tape',
    group: 'Tape wear',
    blurb:
      'Third-gen dub: mushy detail, heavy grain, frequent dropouts and bad tracking.',
    patch: {
      dubGens: 2,
      lumaMHz: 2.2,
      lumaPeak: 1.4,
      noiseIre: 7,
      colorUnderMix: 1,
      chromaNoiseIre: 9,
      underJitterDeg: 10,
      tbJitterNs: 400,
      tbWowNs: 900,
      headSwitchShiftUs: 1.6,
      headSwitchNoise: 0.8,
      dropoutRate: 25,
      dropoutLenUs: 9,
      ghostDelayUs: 3,
      ghostGain: 0.15,
      demodMHz: 0.45,
    },
  },
  {
    name: 'pictureSearch',
    displayName: 'picture search',
    group: 'Tape wear',
    blurb:
      'Cue at 5x: the head crosses four tracks per sweep, noise bars sweeping the frame while the strips between them tear and rainbow.',
    patch: {
      shuttleX: 5,
      lumaMHz: 2.8,
      lumaPeak: 0.8,
      noiseIre: 3,
      colorUnderMix: 1,
      underJitterDeg: 4,
      tbJitterNs: 200,
      headSwitchShiftUs: 0.8,
      headSwitchNoise: 0.4,
      hHold: 0.3,
      demodMHz: 0.5,
    },
  },
  {
    name: 'stuckTape',
    displayName: 'stuck tape',
    group: 'Tape wear',
    blurb:
      'Deck jammed on pause. The head grinds one track boundary into a drifting noise bar, time runs at a third of real speed, and phosphor trails smear what little still moves.',
    patch: {
      shuttleX: 0,
      timeScale: 0.35,
      phosphor: 0.9,
      lumaMHz: 2.6,
      lumaPeak: 1,
      noiseIre: 4,
      colorUnderMix: 1,
      underJitterDeg: 6,
      tbJitterNs: 300,
      tbWowNs: 500,
      headSwitchShiftUs: 1,
      headSwitchNoise: 0.5,
      hHold: 0.3,
    },
  },
  {
    name: 'trackingBand',
    displayName: 'tracking band',
    group: 'Tape wear',
    blurb:
      'The head riding half off its track: a band of hash where the signal is weakest, the picture bending through it, and colour dropping out across it because the 629 kHz carrier starves before the luma does. This is what the tracking knob on the front of the deck was for.',
    patch: {
      trackAmt: 0.55,
      trackPos: 0.62,
      headClog: 0.2,
      colorUnderMix: 1,
      chromaNoiseIre: 18,
      lumaMHz: 2.8,
      noiseIre: 3,
      tbJitterNs: 250,
      hHold: 0.25,
    },
    // A real deck's band never sits still — the tape stretches, the servo
    // hunts, and the band walks slowly up and down the frame. Slow enough to
    // read as drift rather than as something flapping.
    mod: [{ target: 'trackPos', source: 'smooth', rateHz: 0.08, depth: 0.25 }],
  },
  {
    name: 'servoHunt',
    displayName: 'servo hunt',
    group: 'Tape wear',
    blurb:
      'An auto-tracking deck that cannot find the track. The servo sweeps the noise band up the picture, overshoots, rings back, settles for a moment and loses it again as the tape stretches. Every scene change, shuttle exit, splice and thump from the music knocks it off the peak, and the top of the frame flags on the tension each time. Nothing here is drawn. It is a loop with too little damping.',
    patch: {
      trackHunt: 0.85,
      trackKick: 0.9,
      trackPos: 0.7,
      colorUnderMix: 1,
      chromaNoiseIre: 14,
      lumaMHz: 2.9,
      noiseIre: 2.5,
      tbJitterNs: 200,
      tbWowNs: 400,
      hHold: 0.3,
      syncBendUs: 1.5,
    },
  },
  {
    name: 'hueRidesTheLight',
    displayName: 'hue rides the light',
    group: 'Tape wear',
    blurb:
      "The video amplifier's gain and delay both vary with the brightness they are working on, which every VTR spec sheet called DG and DP. This is the third copy through it, so each generation rotates the last one's hue again by the light it carries. Subcarrier on bright picture comes through smaller and later than the same colour on dark picture, so saturation drains out of the highlights while hue swings with the luma underneath. Three passes turn that from an error into a palette: a red chair lit from above turns gold at the top and stays brown underneath. Burst sits at blanking where the error is zero, so the decoder's reference never moves and no tint knob undoes any of it. The line amp it all passes through has a failing supply, which scales the brightness the errors depend on rather than adding to it, so the hum bar comes through as a band of different colour rolling up the picture and taking the palette with it.",
    patch: {
      diffPhaseDeg: 52,
      diffGain: 0.75,
      dubGens: 3,
      // The one thing this fault could not do on its own is move. A failing
      // line amp scales the very luma the two errors are keyed to, so the hum
      // bar arrives as a *hue* bar and rolls up the picture at the beat
      // between mains and the field rate.
      humMod: 0.32,
      humAmp: 0.1,
      lumaMHz: 3.2,
      lumaPeak: 1.1,
      chromaGain: 1.5,
      noiseIre: 1.5,
    },
  },
  {
    name: 'overDeviatedWhite',
    displayName: 'over-deviated white',
    group: 'Tape wear',
    blurb:
      "A deck whose white clip is set too hot, with its own sharpener making the edges that trigger it. Brightness is recorded as FM with the video pre-emphasized, so a hard dark-to-bright edge overshoots the deviation the head and tape can carry. Past the response cliff the discriminator folds back and more frequency comes out as less video: a black streak trailing every bright edge, smearing a microsecond rightward as the deemphasis recovers. Colour is a separate recording on its own carrier, so it passes straight through the fold and the streaks come out saturated over black. The threshold is re-decided per sample per frame by the demod's own noise, so the streaks boil where the picture has detail and hold still where it does not.",
    patch: {
      fmOverdev: 0.92,
      fmStreakUs: 0.7,
      colorUnderMix: 1,
      dubGens: 2,
      lumaMHz: 3,
      // Past the redline, and it is the sharpener that feeds the fold: the
      // overshoot it lays on every edge is what runs past the deviation the
      // tape can carry, so the two mechanisms are one fault at two stages.
      lumaPeak: 4,
      chromaGain: 1.7,
      chromaNoiseIre: 14,
      noiseIre: 2,
    },
  },
  {
    name: 'oneLineBack',
    displayName: 'one line back',
    group: 'Tape wear',
    blurb:
      'Binder hydrolysis, and the circuit that is supposed to hide half of it. The same failure does two things at once. The oxide sheds, so the head reads nothing several times a line, and the tape grabs the drum until the tension breaks it free, a relaxation oscillator that shows as bands of shear leaning further line by line and then snapping back. Where the head read nothing the compensator patches the gap from a delay line holding the line above. A line of NTSC is 227.5 subcarrier cycles, so the patch arrives exactly half a cycle out of phase: invisible in brightness, and in the complementary hue. That is why a shedding tape on a cheap deck streaks in colours the scene never had rather than in white. The chroma AGC lags well behind, so colour blooms back through each scarred band instead of snapping, and where two dropouts stack the delay line holds a line that lost the same samples, so the raw dropout shows through.',
    patch: {
      dropoutRate: 120,
      dropoutLenUs: 30,
      dropoutComp: 1,
      tbStickNs: 2500,
      colorUnderMix: 1,
      accLagLines: 90,
      chromaNoiseIre: 14,
      lumaMHz: 2.9,
      noiseIre: 2.5,
      tbJitterNs: 120,
    },
    // Oxide sheds in patches rather than evenly, so the rate walks: stretches
    // the compensator keeps up with, stretches where it cannot.
    mod: [
      { target: 'dropoutRate', source: 'smooth', rateHz: 0.05, depth: 0.12 },
    ],
  },
  {
    name: 'broadcast',
    group: 'RF / Broadcast',
    blurb:
      'Clean over-the-air feed: a little noise and a soft multipath ghost.',
    patch: { noiseIre: 1.2, ghostDelayUs: 1.8, ghostGain: 0.1, demodMHz: 0.8 },
  },
  {
    name: 'mistunedRf',
    displayName: 'mistuned rf',
    group: 'RF / Broadcast',
    blurb:
      'Tuner off-station. The sound carrier gets out of its trap and the detector multiplies it against the picture, giving buzz weave, a coarse 920 kHz beat and rainbow crawl on fine detail, over snow, a hard ghost and a struggling AGC.',
    patch: {
      rfMistuneMHz: 0.55,
      noiseIre: 6,
      ghostDelayUs: 2.4,
      ghostGain: 0.18,
      agc: 0.4,
      tbJitterNs: 80,
    },
  },
  {
    name: 'fringeReception',
    displayName: 'fringe reception',
    group: 'RF / Broadcast',
    blurb:
      'A station at the edge of its range, through the envelope detector that gives weak signal its character. Whites boil into snow first, blacks hold longest, and sync dies last, so the picture fights through rather than sinking into grey fuzz, while a distant reflection ghosts it and the AGC works from what sync depth it can still find.',
    patch: {
      rfSnow: 0.5,
      agc: 0.7,
      ghostDelayUs: 3.5,
      ghostGain: 0.14,
      rfMistuneMHz: 0.1,
      hHold: 0.3,
    },
  },
  {
    name: 'ignitionStorm',
    displayName: 'ignition storm',
    group: 'RF / Broadcast',
    blurb:
      'Arc interference over a dim signal: clustered hits from ticks to torn slabs, plus millisecond strikes. Every big one lands on sync and the beam load, so the raster tears, the supply rings, and the AGC recovers slowly while the phosphor holds each flash. The rig reacting is most of the look.',
    patch: {
      impulseRate: 4,
      impulseIre: 120,
      strikeRate: 1.5,
      aGain: 0.3,
      agc: 0.6,
      hvSagUs: 5,
      hvRing: 0.5,
      crtCutoff: 0.1,
      phosphor: 0.88,
    },
  },
  {
    name: 'deadChannel',
    displayName: 'dead channel',
    group: 'RF / Broadcast',
    blurb:
      'No signal: full snow, hum bars, rolling picture and collapsing sync.',
    patch: {
      noiseIre: 32,
      killThresh: 8,
      agc: 0.7,
      hHold: 0.6,
      tbJitterNs: 600,
      tbWowNs: 1200,
      dropoutRate: 40,
      dropoutLenUs: 14,
      ghostDelayUs: 6,
      ghostGain: 0.3,
      humAmp: 8,
    },
  },
  {
    name: 'dimmerHash',
    displayName: 'dimmer hash',
    group: 'RF / Broadcast',
    blurb:
      'A triac dimmer on the same mains, firing twice a cycle at its set angle. The interference stops falling anywhere and bunches into two bands of hash that roll up the picture locked to the hum bar. They share the same mains, so they travel together. Quieter than an arc storm and more unsettling, because it is periodic.',
    patch: {
      impulseRate: 9,
      impulseHz: 420,
      impulseMains: 0.85,
      impulseIre: 90,
      humAmp: 14,
      humMod: 0.35,
      agc: 0.45,
      noiseIre: 3,
      phosphor: 0.8,
    },
  },
  {
    name: 'scrambledChannel',
    displayName: 'scrambled channel',
    group: 'RF / Broadcast',
    blurb:
      'Premium channel with no decoder box. Sync is suppressed at the head-end, so every line lands at its own offset and the AGC ends up chasing a tip that is not there.',
    patch: {
      scramble: 0.55,
      hDetuneHz: 18,
      agc: 0.3,
      hHold: 0.45,
      noiseIre: 2,
    },
  },
  {
    name: 'ssavi',
    group: 'RF / Broadcast',
    blurb:
      "Zenith's system, undecoded: suppression plus video inversion, a shearing negative with the colour still in it.",
    patch: {
      scramble: 0.85,
      scrambleMode: 2,
      hDetuneHz: 20,
      agc: 0.4,
      hHold: 0.5,
      noiseIre: 2.5,
    },
  },
  {
    name: 'verticalHoldGone',
    displayName: 'vertical hold gone',
    group: 'Sync / Deflection',
    blurb:
      'Vertical oscillator detuned past its pull-in range: the picture scrolls forever, VBI bar and all, hooking sideways at every seam.',
    patch: {
      vFreqHz: 54,
      vHold: 0.35,
      syncBendUs: 7,
      hHold: 0.2,
      noiseIre: 2.5,
    },
    // A free-running vertical oscillator hunts: the roll speeds up and slows
    // as the divider drifts, which is the difference between a set that has
    // lost hold and a picture being scrolled at a constant rate.
    mod: [{ target: 'vFreqHz', source: 'smooth', rateHz: 0.08, depth: 0.015 }],
  },
  {
    name: 'bentScan',
    displayName: 'bent scan',
    group: 'Sync / Deflection',
    blurb:
      'Deflection bowed hard across the glass. The blanking interval itself curves through the picture.',
    patch: { bendUs: 24, bendShape: 2, syncBendUs: 4, noiseIre: 2 },
  },
  {
    name: 'supplyChaos',
    displayName: 'supply chaos',
    group: 'Sync / Deflection',
    blurb:
      'Beam current bending its own scan through a ringing HV supply: geometry driven by picture content, never repeating.',
    patch: {
      hvSagUs: 16,
      hvRing: 0.85,
      bGain: 0.55,
      bLineHz: 0.9,
      bDetuneHz: 130,
      bRollLps: 0.2,
      bRing: 0.3,
      noiseIre: 2,
    },
  },
  {
    name: 'fullCollapse',
    displayName: 'full collapse',
    group: 'Sync / Deflection',
    blurb:
      'Every deflection fault at once, feeding the mixer loop. Bend, roll and beam load chase each other frame to frame.',
    patch: {
      hvSagUs: 20,
      hvRing: 0.9,
      bendUs: 12,
      bendShape: 2,
      vFreqHz: 58.5,
      vHold: 0.4,
      syncBendUs: 6,
      hHold: 0.18,
      bGain: 0.6,
      bLineHz: 0.9,
      bDetuneHz: 130,
      bRollLps: 0.2,
      cfbMix: 0.45,
      cfbLines: 3,
      phosphor: 0.85,
      noiseIre: 3,
    },
  },
  {
    name: 'bassSmack',
    displayName: 'bass smack',
    group: 'Sync / Deflection',
    blurb:
      'Every kick slams the HV supply and knocks vertical hold loose, then it snaps back. Enable the microphone under Audio.',
    patch: {
      audioRoll: 5,
      audioTear: 130,
      audioLoad: 2.2,
      // a little standing sag for character, most of it on the onset so the
      // tube sits nearly still between hits and the kick actually lands
      hvSagUs: 4,
      audioSagUs: 24,
      hvRing: 0.5,
      vHold: 0.45,
      hHold: 0.3,
      phosphor: 0.8,
      noiseIre: 2,
    },
  },
  {
    name: 'lineNineteen',
    displayName: 'line nineteen',
    group: 'Decoder',
    blurb:
      'A VIR set trimming itself against the reference on line 19, given a third-generation dub whose amplifier is bent against brightness. The reference sits at burst phase on a 70 IRE pedestal, so the set rotates and re-gains the whole picture until that one level decodes right. A correction that is exact at 70 IRE is wrong everywhere else. What was already near the pedestal comes back true while everything under it leans the other way: the window returns to green as the red chair goes electric magenta, which shows where the reference sat. The saturation half is why none of it is subtle. Three generations of colour-under have eaten the reference as well as the picture, and a weak reference reads to the corrector as a set that needs more colour, so a worn dub arrives garish rather than washed out, the opposite of what the tape did to it.',
    patch: {
      vir: 1,
      virLag: 90,
      diffPhaseDeg: 45,
      diffGain: 0.5,
      dubGens: 3,
      colorUnderMix: 1,
      chromaGain: 1.2,
      noiseIre: 1.2,
    },
    // The error the corrector is measuring, walked slowly. What this shows that
    // a still frame cannot is the lag: the hue on the glass is where the
    // reference was a second and a half ago, never where it is now.
    mod: [
      { target: 'diffPhaseDeg', source: 'smooth', rateHz: 0.04, depth: 0.2 },
    ],
  },
  {
    name: 'collapsedAxes',
    displayName: 'collapsed axes',
    group: 'Decoder',
    blurb:
      'A cheap decoder with its whole colour reference out. The two demodulators sit 90° apart only because that network says so, and here they have drifted toward reading the same phase twice, which squashes the colour plane onto a single line. This shears the wheel rather than rotating it, so hues that were opposite stop being opposite. Some come through at full strength and their neighbours land on colours nothing in the scene had. The crystal is pulled a few kilohertz off with it, so hue also ramps along every line, and the reconstruction lattice samples the result four samples coarse, which lays the squashed palette down in blocks. The guns are left to hit their own rails, so what survives arrives fluorescent. The drift moves: down to both axes reading as one, up through quadrature and out the far side where the plane stretches and folds, so green comes back gold while nothing in the picture has moved.',
    patch: {
      demodAxisDeg: 30,
      scDetuneKHz: 6,
      chromaCoarse: 4,
      chromaGain: 2.6,
      matrixClip: 1,
      phosphor: 0.5,
      noiseIre: 1.2,
    },
    mod: [
      { target: 'demodAxisDeg', source: 'sine', rateHz: 0.025, depth: 0.42 },
    ],
  },
  {
    name: 'mixerLoop',
    displayName: 'mixer loop',
    group: 'Feedback loops',
    blurb: 'Composite fed back into itself — each line echoes into the next.',
    patch: {
      cfbMix: 0.85,
      cfbDelayUs: 1.2,
      cfbLines: 3,
      noiseIre: 1.5,
      cfbGenlock: 1,
      cfbGain: 1.04,
    },
    // The loop delay is also a hue rotation, so drifting it by a fraction of a
    // microsecond walks the colour of every generation around the wheel while
    // the geometry stays put.
    mod: [{ target: 'cfbDelayUs', source: 'sine', rateHz: 0.12, depth: 0.01 }],
  },
  {
    name: 'strobeTrails',
    displayName: 'strobe trails',
    group: 'Feedback loops',
    blurb: 'Held frames blended forward, smearing motion into long trails.',
    patch: {
      cfbMix: 0.9,
      cfbTrail: 0.9,
      cfbHold: 3,
      cfbDelayUs: 1.6,
      noiseIre: 2,
      cfbGenlock: 1,
      cfbGain: 1.06,
    },
  },
  {
    name: 'keyLoop',
    displayName: 'key loop',
    group: 'Feedback loops',
    blurb:
      'Luma-keyed feedback. Only bright areas re-enter the loop and tunnel.',
    patch: {
      cfbMix: 0.92,
      cfbKey: 0.85,
      cfbKeyLevel: 45,
      cfbKeySoft: 8,
      cfbDelayUs: 1.5,
      cfbLines: 2,
      noiseIre: 1.5,
      cfbGenlock: 1,
      cfbGain: 1.05,
    },
  },
  {
    name: 'fbBloom',
    displayName: 'fb bloom',
    group: 'Feedback loops',
    blurb:
      'Camera-style zoom + rotate feedback blooming outward into a tunnel.',
    patch: {
      fbMix: 0.82,
      fbZoom: 1.045,
      fbRotateDeg: 2.5,
      fbGain: 1.18,
      fbFocus: 1.3,
      fbBlack: 0.05,
      fbKnee: 0.65,
      fbVign: 0.35,
      noiseIre: 1.5,
    },
    // Nobody holds a camera that still. A degree of sway on the mount is also
    // what keeps the loop from settling into one fixed pattern and sitting
    // there — the tunnel keeps finding new structure to breed.
    mod: [{ target: 'fbRotateDeg', source: 'sine', rateHz: 0.05, depth: 0.02 }],
  },
  {
    name: 'woundSpiral',
    displayName: 'wound spiral',
    group: 'Feedback loops',
    blurb:
      'The camera turned a few degrees on its mount and the exposure pushed past unity. Each pass lands rotated and brighter than the last, so the subject smears into a spiral instead of a tunnel.',
    patch: {
      fbMix: 0.78,
      fbZoom: 1.015,
      fbRotateDeg: 3.2,
      fbShiftX: 0.03,
      fbGain: 1.1,
      fbFocus: 1.4,
      fbKnee: 0.6,
      fbVign: 0.45,
      fbBlack: 0.04,
      noiseIre: 2,
    },
  },
  {
    name: 'shadowLadder',
    displayName: 'shadow ladder',
    group: 'Feedback loops',
    blurb:
      'Loop key inverted so only the dark areas re-enter, stepped four lines every trip. The shadows climb the frame in rungs while the highlights stay put.',
    patch: {
      cfbMix: 0.9,
      cfbKey: -0.7,
      cfbLines: 4,
      cfbDelayUs: 0.2,
      noiseIre: 1.5,
      cfbGenlock: 1,
      cfbGain: 1.05,
    },
  },
  {
    name: 'ladderClimb',
    displayName: 'ladder climb',
    group: 'Feedback loops',
    blurb:
      'Frame store walking six lines up per pass with its peak-hold left on: trails stack into a bleached ladder and tear the picture off its own edges.',
    patch: {
      cfbMix: 0.9,
      cfbGain: 1.05,
      cfbLines: -6,
      cfbTrail: 0.85,
      cfbDelayUs: 0.06,
      noiseIre: 1.5,
      cfbGenlock: 1,
    },
  },
  {
    name: 'subcarrierSiren',
    displayName: 'subcarrier siren',
    group: 'Feedback loops',
    blurb:
      'Resonance in the loop set on the colour subcarrier and driven past unity. The filter stops responding to the picture and starts generating its own, in bands of pure hue.',
    patch: {
      cfbMix: 0.55,
      cfbFilterMHz: 3.6,
      cfbFilterQ: 0.85,
      cfbFilterBoost: 2.6,
      noiseIre: 1.5,
      cfbGenlock: 1,
    },
    // What makes it a siren rather than a drone: an oscillator this close to
    // unity walks its own centre frequency as the loop warms, and the bands
    // sweep with it. Cheap to modulate — the loop resonance is designed per
    // frame in the shader, not baked into the FIR bank.
    mod: [
      { target: 'cfbFilterMHz', source: 'sine', rateHz: 0.04, depth: 0.03 },
    ],
  },
  {
    name: 'huntingServos',
    displayName: 'hunting servos',
    group: 'Feedback loops',
    blurb:
      "Two underdamped gain servos, the beam limiter and the camera's auto-iris, each metering a loop it is inside. Neither can settle while the other moves, and their unequal rhythms beat: bloom, clamp, collapse, reopen, on a rhythm no content is writing.",
    patch: {
      abl: 0.8,
      fbIris: 0.9,
      fbMix: 0.6,
      fbZoom: 1.04,
      agc: 0.6,
      hvSagUs: 4,
      hvRing: 0.45,
      crtBloom: 0.3,
      fbGain: 1.1,
    },
  },
  {
    name: 'meltdown',
    group: 'Feedback loops',
    blurb:
      "The loop's delay trimmer driven by its own video bus, so every lap the picture rewrites its own timing and hue, with a ring mod folding the products back in and every servo in the rack hunting. The image dissolves into flowing terrain that never repeats, because the displacement field is the picture one generation late.",
    patch: {
      cfbMix: 0.7,
      cfbGain: 1.06,
      cfbLines: 2,
      cfbDelayUs: 0.35,
      cfbServoUs: -4.5,
      cfbRing: 0.5,
      abl: 0.75,
      fbIris: 0.85,
      fbMix: 0.45,
      fbZoom: 1.03,
      hvSagUs: 5,
      hvRing: 0.5,
      accLagLines: 18,
      agc: 0.6,
      chromaGain: 1.8,
      crtSat: 1.3,
    },
  },
  {
    name: 'zoomBloom',
    displayName: 'zoom bloom',
    group: 'Feedback loops',
    blurb:
      'The camera pushed in two percent a pass, with the loop above unity so the geometry accumulates instead of dimming out. A highlight grows inward toward the middle and never quite arrives, because every generation is a little larger than the one it grew from.',
    patch: {
      fbMix: 0.82,
      fbGain: 1.13,
      fbZoom: 1.02,
      fbBlack: 0.05,
      phosphor: 0.6,
    },
    // The gain is the one thing standing between this and a white field, so
    // walking it is walking how close to the edge the loop runs — slow, and
    // narrow enough that the bottom of the sweep still accumulates.
    mod: [{ target: 'fbGain', source: 'smooth', rateHz: 0.06, depth: 0.03 }],
  },
  {
    name: 'tunnelOut',
    displayName: 'tunnel out',
    group: 'Feedback loops',
    blurb:
      'The same loop pulled the other way. Each pass is a shade smaller than the last, so the picture recedes down a corridor rather than growing out of the frame. The vignette gives the corridor its walls.',
    patch: {
      fbMix: 0.9,
      fbGain: 1.25,
      fbZoom: 0.95,
      fbVign: 0.45,
      phosphor: 0.5,
    },
    mod: [{ target: 'fbZoom', source: 'sine', rateHz: 0.04, depth: 0.008 }],
  },
  {
    name: 'spiral',
    group: 'Feedback loops',
    blurb:
      'Three degrees of rotation a pass on top of a slight zoom. Either alone gives a ring or a corridor. The two together make the picture wind, because a generation lands rotated *and* displaced from the one under it.',
    patch: {
      fbMix: 0.9,
      fbGain: 1.22,
      fbZoom: 0.955,
      fbRotateDeg: 5,
      phosphor: 0.55,
    },
    // Through zero, so the wind reverses: the arms unwind, stall, and go back
    // the other way, which a fixed rotation never does.
    mod: [{ target: 'fbRotateDeg', source: 'sine', rateHz: 0.03, depth: 0.02 }],
  },
  {
    name: 'subcarrierComb',
    displayName: 'subcarrier comb',
    group: 'Feedback loops',
    blurb:
      'A mixer loop delayed by about a quarter of a subcarrier cycle, so what comes back is ninety degrees out and the hue steps round the wheel one generation at a time. Nothing here touches a colour control. The rotation is the delay, arriving as colour because the subcarrier went round the loop with the picture.',
    patch: {
      cfbMix: 0.82,
      cfbGain: 0.98,
      cfbDelayUs: 0.14,
      chromaGain: 1.3,
      cfbGenlock: 1,
    },
    // A hundred and forty nanoseconds is one sample; sweeping a fraction of one
    // walks the whole wheel, so the picture cycles hue without a tint knob
    // moving.
    mod: [
      { target: 'cfbDelayUs', source: 'triangle', rateHz: 0.05, depth: 0.1 },
    ],
  },
  {
    name: 'ringLoop',
    displayName: 'ring loop',
    group: 'Feedback loops',
    blurb:
      'The loop bus multiplied against the live picture instead of summed with it. Subcarrier against subcarrier lands colour at sum and difference phases neither frame contained, and every product goes round to be multiplied again, so the spectrum folds over itself generation after generation rather than settling.',
    patch: {
      cfbMix: 0.9,
      cfbGain: 1.06,
      cfbDelayUs: 2.2,
      cfbRing: 0.65,
      chromaGain: 1.2,
      cfbGenlock: 1,
    },
    mod: [{ target: 'cfbRing', source: 'smooth', rateHz: 0.08, depth: 0.25 }],
  },
  {
    name: 'ringLadder',
    displayName: 'ring ladder',
    group: 'Feedback loops',
    blurb:
      'The loop offset two dozen lines a lap, with the return multiplied against the live program rather than summed into it. The offset stacks generations down the frame. The multiplier makes each one a product of the band above it and whatever the picture is doing there now, so instead of a ladder of copies the frame fills with blocks of colour at frequencies nothing in the chain is carrying.',
    patch: {
      cfbMix: 0.8,
      cfbGain: 1.02,
      cfbDelayUs: 1.4,
      cfbLines: 24,
      cfbRing: 0.7,
      chromaGain: 1.4,
      phosphor: 0.5,
      cfbGenlock: 1,
    },
    // Walking the offset walks the rung spacing, so the mosaic re-lays itself
    // at a new pitch rather than sitting where the first lap put it.
    mod: [
      { target: 'cfbLines', source: 'triangle', rateHz: 0.03, depth: 0.04 },
    ],
  },
  {
    name: 'ringStorm',
    displayName: 'ring storm',
    group: 'Feedback loops',
    blurb:
      'Feedback and a multiplier, with the depth of the multiply on a Lorenz attractor. Summed, a loop returns what it was given. Multiplied, every lap beats the last generation against the live one and folds in frequencies neither carried, then sends the products round to be multiplied again. The knob deciding between those two is driven by something that never returns to where it was, so the loop is never in the same regime twice, and the peak hold keeps each state on the glass long enough for the next one to multiply it.',
    patch: {
      cfbMix: 0.9,
      cfbGain: 1,
      cfbDelayUs: 0.9,
      cfbLines: 2,
      cfbRing: 0.55,
      cfbTrail: 0.8,
      chromaGain: 1.5,
      phosphor: 0.6,
      cfbGenlock: 1,
    },
    mod: [{ target: 'cfbRing', source: 'lorenz', rateHz: 0.6, depth: 0.45 }],
  },
  {
    name: 'ringOnTheBeat',
    displayName: 'ring on the beat',
    group: 'Feedback loops',
    blurb:
      'The same two mechanisms with the bass deciding between them. The loop rests as a plain echo, delayed, offset and summed, and every kick switches the multiplier in for as long as the envelope lasts, so the trails that were accumulating suddenly beat against the live frame and come back in sum-and-difference colour. It settles between hits, which is what makes the hits legible. Patch something with a low end into the audio input.',
    patch: {
      cfbMix: 0.72,
      cfbGain: 1.02,
      cfbDelayUs: 0.5,
      cfbLines: 3,
      cfbTrail: 0.6,
      chromaGain: 1.4,
      phosphor: 0.55,
      cfbGenlock: 1,
    },
    // The bass-onset follower rather than an LFO: this is the one control here
    // that should move on the music instead of on a clock.
    mod: [{ target: 'cfbRing', source: 'hit', rateHz: 1, depth: 0.7 }],
  },
  {
    name: 'invertedRungs',
    displayName: 'inverted rungs',
    group: 'Feedback loops',
    blurb:
      'The loop returning below zero, so every lap comes back as the opposite polarity of the one before it, dropped sixty lines each time. The frame fills with a stack of generations alternating positive and negative down the screen. The multiplier holds them apart. Summed, the alternating laps cancel into vertical smear and the copies stop being legible. Multiplied, each rung lands hard-edged and in a palette the rung above it did not have.',
    patch: {
      cfbMix: 0.78,
      cfbGain: -1.1,
      cfbDelayUs: 1.2,
      cfbLines: 60,
      cfbRing: 0.9,
      chromaGain: 1.6,
      phosphor: 0.3,
      cfbGenlock: 1,
    },
  },
  {
    name: 'ringInTheHighlights',
    displayName: 'ring in the highlights',
    group: 'Feedback loops',
    blurb:
      'The loop return keyed on brightness, so the multiply can only happen where the picture is already lit. Highlights grow scalloped trails sideways and everything under the slice, a dark subject or a saturated backing, stays photographic. That is the difference between feedback that follows the subject and feedback that floods the frame. Keyed and summed, the trail is a grey smear of the highlight itself. Keyed and multiplied, the same trail comes back through the spectrum, because the loop against the live picture lands at sums and differences the highlight never carried.',
    patch: {
      cfbMix: 0.92,
      cfbGain: 1.02,
      cfbDelayUs: 1.1,
      cfbLines: 1,
      cfbRing: 1,
      cfbKey: 1,
      cfbKeyLevel: 50,
      cfbKeySoft: 10,
      chromaGain: 1.8,
      phosphor: 0.5,
      cfbGenlock: 1,
    },
  },
  {
    name: 'ringInTheShadows',
    displayName: 'ring in the shadows',
    group: 'Feedback loops',
    blurb:
      "The same key wired the other way up. The return is gated where the signal is low, so the multiply happens everywhere the picture is not lit. That is a bigger change than it sounds, because the key is watching a composite line and the darkest thing on a composite line is not a shadow. It is blanking and the sync tip. So the strongest return of every lap lands on the receiver's own timing reference. The frame shears and rolls while the shadows fill with product, and a lit subject sits through it photographic. The slice moves, so the boundary climbs the picture's own gradient instead of sitting where it was put.",
    patch: {
      cfbMix: 0.92,
      cfbGain: 1.14,
      cfbDelayUs: 0.8,
      cfbLines: 2,
      cfbRing: 1,
      cfbKey: -1,
      cfbKeyLevel: 32,
      cfbKeySoft: 14,
      chromaGain: 1.6,
      phosphor: 0.45,
      cfbGenlock: 1,
    },
    mod: [
      { target: 'cfbKeyLevel', source: 'smooth', rateHz: 0.06, depth: 0.18 },
    ],
  },
  {
    name: 'warpInTheHighlights',
    displayName: 'warp in the highlights',
    group: 'Feedback loops',
    blurb:
      "The same key on the varactor instead of the multiplier. What comes back is the highlight in the wrong place rather than a colour it never had. The varactor pulls the loop's own delay by the brightness passing through it, and the key only lets the pulled return land where the picture was already lit. A lit subject tears sideways into ribbons that recolour as they go, every 70 ns of pull being another 90 degrees of hue, and a dark subject or a saturated backing sits through it in register. Feedback that displaces geometry rather than manufacturing colour, keyed so it displaces only what it was pointed at.",
    patch: {
      cfbMix: 0.8,
      cfbGain: 1.06,
      cfbDelayUs: 1,
      cfbLines: 1,
      cfbServoUs: 44,
      cfbKey: 1,
      cfbKeyLevel: 50,
      cfbKeySoft: 12,
      chromaGain: 1.3,
      phosphor: 0.45,
      cfbGenlock: 1,
    },
  },
  {
    name: 'warpInTheShadows',
    displayName: 'warp in the shadows',
    group: 'Feedback loops',
    blurb:
      "The varactor keyed the other way up, which lands it on the one thing a composite line keeps below every shadow: blanking, and the sync tip under that. The deepest part of the wire pulls the delay hardest, and now it is also the only part the key lets through, so the pull moves each line's sync into its neighbour's territory and the receiver's problems compound on their own. The frame shears into bands and rolls. A lit subject rides it photographic. The slice drifts, so which shadows are doing the pulling changes without anyone moving it.",
    patch: {
      cfbMix: 0.92,
      cfbGain: 1.12,
      cfbDelayUs: 0.8,
      cfbLines: 2,
      cfbServoUs: 36,
      cfbKey: -1,
      cfbKeyLevel: 30,
      cfbKeySoft: 14,
      chromaGain: 1.5,
      phosphor: 0.45,
      cfbGenlock: 1,
    },
    mod: [
      { target: 'cfbKeyLevel', source: 'smooth', rateHz: 0.05, depth: 0.16 },
    ],
  },
  {
    name: 'rungsInTheLight',
    displayName: 'rungs in the light',
    group: 'Feedback loops',
    blurb:
      'The inverted loop and its sixty-line drop, but keyed, so the ladder of alternating-polarity generations is only built where the picture is lit and the shadows underneath never join in. That makes the rungs hard. With the whole frame feeding back the positive and negative laps overlap into vertical smear. With only the lit areas feeding back, each rung stands against unfed picture and keeps its edge. A subject comes back as a stack of plates in polarities the plate above it did not have.',
    patch: {
      cfbMix: 0.8,
      cfbGain: -1.14,
      cfbDelayUs: 1.2,
      cfbLines: 60,
      cfbRing: 0.9,
      cfbKey: 1,
      cfbKeyLevel: 48,
      cfbKeySoft: 8,
      chromaGain: 1.6,
      phosphor: 0.3,
      cfbGenlock: 1,
    },
  },
  {
    name: 'ringingInTheHighlights',
    displayName: 'ringing in the highlights',
    group: 'Feedback loops',
    blurb:
      "A resonant network across the loop instead of a multiplier, brought just far enough that the round trip passes unity inside its band and the loop starts generating a pattern from nothing. Unkeyed, that pattern is the whole frame and the picture is gone. Keyed, the oscillation can only stand where the picture is bright, so a fine mesh grows on a white shirt and a lit window and stops at their edges, and the mesh is at the network's own frequency rather than anything in the scene. The rest of the picture is unaffected by the oscillation.",
    patch: {
      cfbMix: 0.7,
      cfbGain: 1.08,
      cfbDelayUs: 0.3,
      cfbLines: 1,
      cfbFilterMHz: 2.6,
      cfbFilterQ: 0.55,
      cfbFilterBoost: 1.1,
      cfbKey: 1,
      cfbKeyLevel: 58,
      cfbKeySoft: 8,
      chromaGain: 1.4,
      phosphor: 0.45,
      cfbGenlock: 1,
    },
    // The slice, not the network: the mesh keeps its pitch and changes how much
    // of the picture is allowed to carry it.
    mod: [
      { target: 'cfbKeyLevel', source: 'smooth', rateHz: 0.05, depth: 0.12 },
    ],
  },
  {
    name: 'chasingItsOwnColour',
    displayName: 'chasing its own colour',
    group: 'Feedback loops',
    blurb:
      'A chroma keyer in the loop return where the luma one was. The box slices the phase of the signal instead of its level, so what decides whether a region may keep regenerating is the colour it came back as. That makes it self-limiting, because the loop delay is a hue rotation. A region regenerates, its own return turns a little further round the wheel every lap, and at some lap it leaves the wedge and stops. The territory then goes to whatever has turned into the wedge behind it. Nothing draws the boundary, nothing holds it still, and the frame ends up shredded along its own colour edges rather than its brightness ones.',
    patch: {
      cfbMix: 0.9,
      cfbGain: 1.14,
      cfbDelayUs: 1.1,
      cfbLines: 1,
      cfbRing: 0.9,
      cfbKey: 1,
      cfbKeyAcceptDeg: 60,
      cfbKeyHueDeg: 180,
      cfbKeySoft: 10,
      chromaGain: 1.6,
      phosphor: 0.5,
      cfbGenlock: 1,
    },
  },
  {
    name: 'carvedByTheLivePicture',
    displayName: 'carved by the live picture',
    group: 'Feedback loops',
    blurb:
      "The keyer's key input moved off the loop return and onto program, so the boundary is drawn by what is in front of the camera now rather than by what the loop was doing a generation ago. The trails still grow and still come back through the spectrum, but they are cut off cleanly at the live subject's edge instead of smearing across it. The accumulation cannot follow a subject that moves, so a hand crossing the frame carves its own shape out of everything the loop has built. Compare it against the self-keyed version: same product, same delay, and the only difference is which cable the key is on.",
    patch: {
      cfbMix: 0.92,
      cfbGain: 0.92,
      cfbDelayUs: 1.1,
      cfbLines: 1,
      cfbRing: 1,
      cfbKey: 1,
      cfbKeyExt: 1,
      cfbKeyLevel: 50,
      cfbKeySoft: 10,
      chromaGain: 1.8,
      phosphor: 0.5,
      cfbGenlock: 1,
    },
  },
  {
    name: 'theHoleTheSubjectKeeps',
    displayName: 'the hole the subject keeps',
    group: 'Feedback loops',
    blurb:
      'The live key inverted, so the loop is allowed everywhere the picture is not lit and the subject holds a clean hole in it. What fills the rest is generations of product beating against generations of product, which drains most of the colour out of itself and changes far faster than anything in the scene, fast enough that no two frames hold the same palette. The hole does not change. It is redrawn from live picture every frame, so it stays photographic and stays wherever the subject went, and the boundary between the two is the only still thing on the screen.',
    patch: {
      cfbMix: 0.93,
      cfbGain: 1.06,
      cfbDelayUs: 0.8,
      cfbLines: 2,
      cfbRing: 1,
      cfbKey: -1,
      cfbKeyExt: 1,
      cfbKeyLevel: 42,
      cfbKeySoft: 12,
      chromaGain: 1.6,
      phosphor: 0.45,
      cfbGenlock: 1,
    },
  },
  {
    name: 'itOnlyEatsTheRed',
    displayName: 'it only eats the red',
    group: 'Feedback loops',
    blurb:
      "Both of the keyer's connectors at once: it slices hue rather than level, and it slices the live picture rather than the loop's own past. So the loop is confined to a colour (103 degrees is where red lands on the wheel the subcarrier carries) and confined to wherever that colour is right now. A red chair goes to rainbow striping and everything green or neutral beside it stays a photograph, with no mask anywhere and nothing tracking anything. Move the key hue and the loop switches to a different part of the room.",
    patch: {
      cfbMix: 0.94,
      cfbGain: 1.16,
      cfbDelayUs: 1.1,
      cfbLines: 1,
      cfbRing: 1,
      cfbKey: 1,
      cfbKeyExt: 1,
      cfbKeyAcceptDeg: 40,
      cfbKeyHueDeg: 103,
      cfbKeySoft: 10,
      chromaGain: 1.7,
      phosphor: 0.5,
      cfbGenlock: 1,
    },
  },
  {
    name: 'theWrongClock',
    displayName: 'the wrong clock',
    group: 'Feedback loops',
    blurb:
      "The loop's frame store read out three thousandths fast. Every line is stretched from where it started, which on its own is a small squeeze. But the subcarrier is in the samples being re-clocked, so the carrier comes back off the lattice the decoder measures against and hue turns further the further a sample sits from the line start. One pass is a rainbow fanning left to right across the picture. The next pass re-clocks the picture that came out of the first, so the fan opens again, and again, until the right-hand side has been round the wheel several times while the left edge is still the colour it started. Neither loop's geometry knobs do this and no lens could. A camera moves a picture, and a clock rewrites where its colour sits while it moves it.",
    patch: {
      cfbMix: 0.85,
      cfbGain: 1.02,
      cfbClockPct: 0.3,
      cfbDelayUs: 0.2,
      cfbLines: 1,
      chromaGain: 1.9,
      phosphor: 0.5,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
    mod: [
      { target: 'cfbClockPct', source: 'smooth', rateHz: 0.04, depth: 0.06 },
    ],
  },
  {
    name: 'colourInTheDark',
    displayName: 'colour in the dark',
    group: 'Feedback loops',
    blurb:
      "The separator's chroma wire round the loop and the live brightness taken from the picture, so only the colour is fed back. Hue accumulates lap after lap and keeps turning through the delay's rotation, while the picture under it stays sharp and current. What builds up is colour detached from the thing that cast it, drifting across a subject that has not moved. Nothing is smeared, because brightness never enters the loop: the edges are as crisp as the source and the colour on them is minutes old. The slice is on nothing here and the key is out. What decides where colour survives is only how far round the wheel it has already turned.",
    patch: {
      cfbMix: 0.88,
      cfbGain: 1.02,
      cfbDelayUs: 0.35,
      cfbLines: 2,
      cfbReturn: 1,
      chromaGain: 2.2,
      phosphor: 0.5,
      crtSat: 1.3,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
  },
  {
    name: 'greyUnderTheColour',
    displayName: 'grey under the colour',
    group: 'Feedback loops',
    blurb:
      "The other wire off the same separator, with the live colour recombined over it. Brightness alone goes round, so the trails a moving subject leaves are grey rungs stacking four lines up a lap, and the colour laid over them is the picture's own, current and in the wrong place, because it belongs to where the subject is now rather than to the ladder of where it was. The sync tip is on the luma wire too, so this return still disturbs the receiver. The accumulation pulls at where each line starts, and the ladder tears along with the picture instead of sitting behind it.",
    patch: {
      cfbMix: 0.9,
      cfbGain: 1.06,
      cfbDelayUs: 0.2,
      cfbLines: -4,
      cfbReturn: 2,
      cfbTrail: 0.45,
      hHold: 0.5,
      chromaGain: 1.3,
      phosphor: 0.4,
      noiseIre: 1.5,
      cfbGenlock: 0.6,
    },
  },
  {
    name: 'lightBecomesHue',
    displayName: 'light becomes hue',
    group: 'Feedback loops',
    blurb:
      "The ring modulator's other input taken off the program and put on the box's own subcarrier oscillator, which turns the bridge into an encoder's chroma modulator. Against a carrier at 3.58 MHz the return's brightness is translated up into the chroma band, where the decoder can only read it as colour, and the return's own colour is translated down to where it is read as brightness. Each lap trades the two: a lit face comes back as a saturated field, that field comes back as light, and the light is translated again. What settles out is a picture drawn entirely in colours nothing in the room has, arranged exactly where the brightness was. Multiplied against the program instead, this same knob makes none of it. Both sides are on one crystal there, and their products land where the chroma filter discards them.",
    patch: {
      cfbMix: 0.9,
      cfbGain: 1,
      cfbDelayUs: 0.4,
      cfbLines: 1,
      cfbRing: 0.9,
      cfbRingSrc: 1,
      chromaGain: 1.5,
      phosphor: 0.45,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
  },
  {
    name: 'theSecondCrystal',
    displayName: 'the second crystal',
    group: 'Feedback loops',
    blurb:
      'The same modulator with its oscillator pulled twelve kilohertz off the house crystal. On frequency the colour it makes out of brightness lands on one phase, so the loop comes back monochrome in a hue you picked. Off frequency the phase it writes with ramps continuously through the frame, so the invented colour turns along every line and further down every line after it, and the whole picture barber-poles through the wheel at a rate the detune sets. It is a crystal in another box, so nothing pulls it back into step. Because the loop re-modulates its own output, the hue a region arrives at is the hue it was given a lap ago turned again by however far the two crystals have drifted since. The detune wanders, so the pitch of the barber pole leans while it runs.',
    patch: {
      cfbMix: 0.84,
      cfbGain: 1.02,
      cfbDelayUs: 0.9,
      cfbLines: -3,
      cfbRing: 1,
      cfbRingSrc: 1,
      cfbCarrierKHz: 12,
      chromaGain: 1.8,
      phosphor: 0.5,
      noiseIre: 1.5,
      cfbGenlock: 1,
    },
    mod: [
      { target: 'cfbCarrierKHz', source: 'smooth', rateHz: 0.05, depth: 0.06 },
    ],
  },
  {
    name: 'layeredByBrightness',
    displayName: 'layered by brightness',
    group: 'Feedback loops',
    blurb:
      "The loop's frame store taps the bus after the tape, so the amplifier bent against brightness is inside the loop and every lap goes through it again. A delay at 3.58 MHz is a phase shift, so the hue rotation the loop delay applies stops being one number and becomes a function of the light each part of the trail carries. A lit edge turns further per generation than the shadow beside it, and after four or five laps one trail has separated into layers ordered by how bright each layer started. The differential gain alongside it drains the highlights' saturation as they go, so the layers differ in how much colour they have as well as which. The far end of a bright trail arrives pale and rotated where the dark end is still deep and near where it began.",
    patch: {
      cfbMix: 0.8,
      cfbGain: 1.01,
      cfbDelayUs: 0.55,
      cfbLines: 3,
      diffPhaseDeg: 42,
      diffGain: 0.4,
      chromaGain: 1.7,
      phosphor: 0.45,
      noiseIre: 1.5,
      cfbGenlock: 1,
    },
    // The bend walked slowly, because what this look is about only shows as the
    // layer spacing changes: the trail restacks itself while nothing in front
    // of the camera has moved.
    // Base and depth both inside the control: 55 with a depth of 0.3 swings
    // 36 degrees on a span that ends at 60, so it would spend much of its run
    // pinned there — a routing against a clamp is a routing that is not
    // running (docs/CURATION.md).
    mod: [
      { target: 'diffPhaseDeg', source: 'smooth', rateHz: 0.05, depth: 0.15 },
    ],
  },
  {
    name: 'intermodLoop',
    displayName: 'intermod loop',
    group: 'Feedback loops',
    blurb:
      "A tuner off channel feeding a loop that taps the bus behind it. With the sound carrier out of its trap the video detector multiplies it against everything else on the wire, so chroma comes back at 920 kHz and 920 kHz picture detail comes back at 3.58 MHz, where the decoder reads it as colour. That much is a mistuned set. The loop makes the look: the manufactured colour is on the bus when the frame store captures, so next lap it is picture, and the detector multiplies it again. Each generation folds the last one's invented chroma back through the same arithmetic. Fine detail rainbows, the rainbow becomes detail, and the herringbone the loose carrier lays over everything goes round with it.",
    patch: {
      cfbMix: 0.88,
      cfbGain: 1,
      cfbDelayUs: 0.9,
      cfbLines: -2,
      rfMistuneMHz: 1.4,
      chromaGain: 1.8,
      phosphor: 0.4,
      noiseIre: 2,
      cfbGenlock: 1,
    },
    mod: [
      { target: 'rfMistuneMHz', source: 'smooth', rateHz: 0.04, depth: 0.15 },
    ],
  },
  {
    name: 'whereTheProductsLand',
    displayName: 'where the products land',
    group: 'Feedback loops',
    blurb:
      'A ring loop read by a decoder whose colour reference has drifted. The multiplier fills the bus with products at phases neither frame was carrying, and the two demodulators that have to make colour out of them are no longer 90 degrees apart, so the plane those products land on is sheared rather than turned. Hues that were opposite stop being opposite. Some of what the loop makes arrives at full strength, its neighbour a few degrees round arrives as a colour nothing in the room has, and the pair that would have cancelled reinforce instead. The guns are left to hit their own rails, so whatever survives the shear arrives fluorescent. The axis drifts through quadrature and out the far side where the plane folds through itself, which is the same loop being read two incompatible ways while nothing about the loop changes.',
    patch: {
      cfbMix: 0.84,
      cfbGain: 1,
      cfbDelayUs: 1.2,
      cfbLines: 2,
      cfbRing: 0.85,
      // The multiplier on its oscillator, not on the program. Against the
      // program both sides share one crystal and the products land where the
      // chroma filter throws them away — measured at sat 0.032 on a
      // monochrome source, which is a sheared demodulator handed nothing to
      // shear. On the oscillator the same patch reads 0.318.
      cfbRingSrc: 1,
      demodAxisDeg: 34,
      matrixClip: 1,
      chromaGain: 1.8,
      phosphor: 0.5,
      noiseIre: 1.2,
      cfbGenlock: 1,
    },
    // 0.38 of a 180-degree span is 68 degrees either way, which from a base of
    // 34 spends a third of the sine below zero and clamped there.
    mod: [
      { target: 'demodAxisDeg', source: 'sine', rateHz: 0.03, depth: 0.15 },
    ],
  },
  {
    name: 'servoWarp',
    displayName: 'servo warp',
    group: 'Feedback loops',
    blurb:
      "A varactor on the loop's own delay, driven by the video going through it. Bright picture pulls its own timebase, so the frame that comes back is bent where it was lit. The bend is a map of the last generation's brightness, which is why it moves with the picture instead of across it.",
    patch: {
      cfbMix: 0.74,
      cfbGain: 1.02,
      cfbDelayUs: 1.2,
      cfbServoUs: 34,
      phosphor: 0.45,
      cfbGenlock: 0.85,
    },
    // Through zero again: the pull reverses, so the warp leans one way, flattens
    // and leans back.
    mod: [{ target: 'cfbServoUs', source: 'sine', rateHz: 0.05, depth: 0.3 }],
  },
  {
    name: 'bothLoops',
    displayName: 'both loops',
    group: 'Feedback loops',
    blurb:
      'Camera and mixer running at once, each modest. The optical loop can only do what a lens can (zoom, rotate, cut a black level) and the electrical one carries the subcarrier round with it, so the two disagree about what the picture is and the disagreement is the look.',
    patch: {
      fbMix: 0.8,
      fbGain: 1.15,
      fbZoom: 1.014,
      fbRotateDeg: -1.5,
      cfbMix: 0.8,
      cfbGain: 1.04,
      cfbDelayUs: 1.6,
      phosphor: 0.5,
      cfbGenlock: 1,
    },
    // One routing, on the optical half only. Walking both at once makes a look
    // that never holds still long enough to read as either machine.
    mod: [{ target: 'fbZoom', source: 'smooth', rateHz: 0.05, depth: 0.03 }],
  },
  {
    name: 'runaway',
    group: 'Feedback loops',
    blurb:
      'A camera loop pushed past unity with the beam limiter working against it. The picture blooms toward white, the limiter senses the beam current and pulls the drive down, and the loop climbs again: a cycle set by two servos disagreeing rather than by anything on screen. The auto-iris is in the loop too, hunting, so the bloom never reaches the same brightness twice.',
    patch: {
      fbMix: 0.8,
      fbGain: 1.2,
      fbZoom: 1.03,
      fbIris: 0.7,
      abl: 0.8,
      chromaGain: 1.2,
      phosphor: 0.75,
    },
    // Slow, and through the region where the loop crosses unity: above it the
    // structure breeds, below it decays, and the look is the crossing.
    mod: [{ target: 'fbGain', source: 'sine', rateHz: 0.08, depth: 0.12 }],
  },
  {
    name: 'syncInTheLoop',
    displayName: 'sync in the loop',
    group: 'Feedback loops',
    blurb:
      'The picture already coming apart before the camera gets to it. The vertical hold is marginal, so what the loop photographs is a frame mid-roll, and it feeds the roll back in to be photographed again. The seam accumulates instead of passing through, and the loop ends up holding several rolls at once at different ages.',
    patch: {
      fbMix: 0.85,
      fbGain: 1.12,
      fbZoom: 1.02,
      vHold: 0.06,
      vFreqHz: 59.85,
      hHold: 0.4,
      chromaGain: 1.3,
      phosphor: 0.7,
    },
    // A hold this marginal does not drift steadily — it wanders, and the roll
    // rate wanders with it, which is what keeps the stack of seams uneven.
    mod: [{ target: 'vFreqHz', source: 'smooth', rateHz: 0.06, depth: 0.02 }],
  },
  {
    name: 'lorenzLoop',
    displayName: 'lorenz loop',
    group: 'Feedback loops',
    blurb:
      "The mixer loop's delay driven by a Lorenz attractor rather than an oscillator. The echo spacing never repeats and never settles, so the structure the loop builds never lands twice in the same place. Aperiodic without being random, which is the difference between this and shaking the control.",
    patch: {
      cfbMix: 0.82,
      cfbGain: 1.02,
      cfbDelayUs: 2,
      cfbLines: 1,
      chromaGain: 1.4,
      phosphor: 0.6,
      cfbGenlock: 1,
    },
    mod: [{ target: 'cfbDelayUs', source: 'lorenz', rateHz: 0.5, depth: 0.06 }],
  },
  {
    name: 'strobeBloom',
    displayName: 'strobe bloom',
    group: 'Feedback loops',
    blurb:
      'The beam cut for most of each cycle and let through in flashes, inside a loop running above unity. The loop photographs the dark frames as well as the lit ones, so instead of running steady it pumps at the strobe rate, and the phosphor is long enough that each flash is still on the glass when the next one lands.',
    patch: {
      strobeHz: 6,
      strobeMs: 40,
      fbMix: 0.82,
      fbGain: 1.16,
      fbZoom: 1.025,
      phosphor: 0.92,
      chromaGain: 1.3,
    },
    // Sample and hold rather than an LFO: the rate should jump to a new value
    // and sit there, because a strobe sliding continuously through its rates
    // reads as a broken strobe rather than as one being played.
    mod: [{ target: 'strobeHz', source: 'hold', rateHz: 0.4, depth: 0.3 }],
  },
  {
    name: 'cleanDissolve',
    displayName: 'clean dissolve',
    group: 'A/B mixing',
    blurb:
      'Source B genlocked to the house reference and dissolved half over A: a clean switcher mix, with no beat or roll.',
    patch: {
      bGenlock: 1,
      bGain: 0.5,
    },
  },
  {
    name: 'dirtyMix',
    displayName: 'dirty mix',
    group: 'A/B mixing',
    blurb:
      'Source B bleeds in off-frequency and off-line, tearing the horizontal sync.',
    patch: {
      bGain: 0.55,
      bLineHz: 0.6,
      bDetuneHz: 120,
      bRollLps: 0.2,
      hHold: 0.22,
      noiseIre: 2,
    },
  },
  {
    name: 'ringMix',
    displayName: 'ring mix',
    group: 'A/B mixing',
    blurb:
      'Both faders nearly shut and the ring mod up, so the two composite signals barely meet in the summing amplifier and meet properly only in the multiplier. Two subcarriers multiplied land colour at their sum and their difference, so the screen comes back in hues neither source is carrying. The product of two sync tips is a bright spike rather than a sync tip, so the receiver is left hunting for an edge wherever the two decks happen to agree.',
    patch: {
      aGain: 0.3,
      bGain: 0.15,
      bRing: 0.8,
      bDetuneHz: 25,
      bLineHz: 0.4,
      bRollLps: 0.05,
      hHold: 0.3,
      chromaGain: 1.4,
      noiseIre: 2,
    },
  },
  {
    name: 'outOfVolts',
    displayName: 'out of volts',
    group: 'A/B mixing',
    blurb:
      "Both faders wide open into a summing amplifier with no headroom left. Two full composites added is twice what one stage was built to carry, so it spends most of every line against its supply. A stage against its supply is a multiplier rather than a limiter: its gain falls as the sum rises, and a falling gain multiplies the two signals sharing the bus by each other. B's subcarrier is running thirty hertz off A's, so the beat between them lands inside the chroma band and comes back as colour. This is what the ring mod does deliberately, arriving because the box ran out of volts rather than because anybody patched a multiplier. The sync tips are squashed along with the picture, so neither deck's pulse wins the line start by as much as it should and the frame hunts between two geometries while the colour churns.",
    patch: {
      // Eight tenths each rather than wide open. Two composites at full sum to
      // twice what the stage carries and the survey put the driven look at mean
      // 225 with the spread collapsing — which is the blown-out reading
      // docs/CURATION.md already flags on the other multiplier. At 0.8 the sum
      // is still well over the stage's headroom, so the mechanism is untouched,
      // and the picture keeps its contrast: mean 166, spread 77.
      aGain: 0.8,
      bGain: 0.8,
      busClip: 0.75,
      bDetuneHz: 30,
      bLineHz: 0.6,
      bRollLps: 0.04,
      hHold: 0.4,
      chromaGain: 1.6,
      noiseIre: 1.5,
    },
    mod: [{ target: 'busClip', source: 'smooth', rateHz: 0.05, depth: 0.12 }],
  },
  {
    name: 'pauseFight',
    displayName: 'pause fight',
    group: 'A/B mixing',
    blurb:
      "The old rig: a VCR on pause into the dirty mixer. The held frame shreds through the live picture in torn bands. The paused deck free-runs with its servo defeated, the mistrack stripe moves, hue flickers between the drum's two reads, and when the stripe crosses B's vertical interval the sync fight turns into a roll.",
    patch: {
      bGain: 0.5,
      bPause: 0.8,
      bLineHz: 0.2,
      bDetuneHz: 25,
    },
  },
  {
    name: 'pirateFeed',
    displayName: 'pirate feed',
    group: 'A/B mixing',
    blurb:
      'A scrambled premium channel on input A, with sync suppressed at the head-end, and a pirate box summing a little clean B in as substitute sync. The receiver almost recovers the picture around the borrowed pulses, which is exactly how the real boxes worked. Pull B gain to zero to watch it collapse into shear.',
    patch: {
      aScramble: 1,
      bGain: 0.22,
      bLineHz: 0.05,
      bDetuneHz: 15,
      bRollLps: 0,
    },
  },
  {
    name: 'negativeDrifter',
    displayName: 'negative drifter',
    group: 'A/B mixing',
    blurb:
      "SSAVI scrambling on input B alone. Its sync is suppressed before the mix, so A holds the raster steady while B's picture leaks through as a negative: a ghost image in complementary luma drifting and beating through the program.",
    patch: {
      bScramble: 1,
      bScrambleMode: 2,
      bGain: 0.6,
      bDetuneHz: 60,
      bRollLps: 0.15,
    },
  },
  {
    name: 'houseDeckHeld',
    displayName: 'house deck held',
    group: 'A/B mixing',
    blurb:
      "The pause button on the deck feeding input A, which is the house reference itself. Every line of the program scatters around the defeated servo's wander, a mistrack stripe creeps through the picture, and the clean B summed underneath starts winning sync contests it used to lose.",
    patch: {
      aPause: 0.75,
      bGain: 0.35,
      bLineHz: 0.1,
      bDetuneHz: 30,
    },
  },
  {
    name: 'differenceKey',
    displayName: 'difference key',
    group: 'A/B mixing',
    blurb:
      'Source A inverted on its own bus fader and summed against B. Where the two pictures agree they cancel to flat grey, and where they differ the mix lights up, with a slow chroma beat passing through.',
    patch: {
      aGain: -1,
      bGain: 1,
      bLineHz: 0,
      bDetuneHz: 30,
      bRollLps: 0,
      noiseIre: 1.5,
    },
  },
  {
    name: 'dirtyDissolve',
    displayName: 'dirty dissolve',
    group: 'A/B mixing',
    blurb:
      'A manual crossfade on the summing bus, with A pulled halfway down under B. B is still off-frequency and off-line, so the dissolve beats and rolls instead of sitting clean like the genlocked one.',
    patch: {
      aGain: 0.5,
      bGain: 0.6,
      bLineHz: 0.3,
      bDetuneHz: 60,
      bRollLps: 0.12,
      hHold: 0.28,
      noiseIre: 1.8,
    },
  },
  {
    name: 'greenScreen',
    displayName: 'green screen',
    group: 'A/B mixing',
    blurb:
      "A chroma keyer across the mixer, slicing B's green out so A shows through it. B's hue is trimmed round so the two inputs disagree even when they are the same picture. The keyed band comes back in A's own colour while everything else stays rotated. Put different things in the two slots for the real thing, and note the edge: the keyer is on the bus, so it slices the chroma the encoder made, and that filter has no vertical term. The matte is soft across and sharp down, the way every composite key was.",
    patch: {
      bGenlock: 1,
      bGain: 1,
      bHueDeg: 150,
      bKey: 1,
      bKeyAcceptDeg: 34,
      bKeyClip: 0.06,
      bKeySoft: 0.04,
      bKeySpill: 0.8,
    },
  },
  {
    name: 'matteFlood',
    displayName: 'matte flood',
    group: 'A/B mixing',
    blurb:
      "The keyer's own matte generator poured through an inverted key, so what floods the picture is a single flat encoded colour and what survives is one hue. Inverted, the wedge is the only thing the box keeps. Everything more than eighty degrees off the backing is cut and the fill comes up behind it. The fill is a flat field on the house carrier rather than an RGB value pasted on, so it dot-crawls and demodulates like any other colour the chain carries. The result is large areas of one hue with a hard organic boundary shaped by where the picture's own colour happens to sit, with the subject still legible inside it as brightness. The backing hue sweeps, so the boundary migrates through the picture's colours and the flood takes over a different part of the room as it goes. The most saturated look in the table, and among the flattest: three hues holding more than half the frame.",
    patch: {
      bGenlock: 1,
      bGain: 1,
      bKey: -1,
      bKeyHueDeg: 40,
      bKeyAcceptDeg: 80,
      bKeyClip: 0.02,
      bKeyFill: 1,
      bKeyMatteY: 0.6,
      bKeyMatteSat: 0.6,
      bKeyMatteHueDeg: 200,
      chromaGain: 2.5,
      demodMHz: 0.4,
    },
    mod: [
      // Depth kept inside the base: the bay's LFOs are bipolar, and 0.15 of a
      // 360-degree span swings past 0 from a base of 40, which is a routing
      // spending part of its run against the clamp (docs/CURATION.md).
      { target: 'bKeyHueDeg', source: 'smooth', rateHz: 0.03, depth: 0.08 },
    ],
  },
  {
    name: 'keySweep',
    displayName: 'key sweep',
    group: 'A/B mixing',
    blurb:
      "The keyer's backing colour moved round the wheel by an LFO, so the transparent hue travels and the picture dissolves into A one colour at a time. Best with the video synth in slot B. Its colorizer turns level into hue, so B is a moving ramp *through* the wheel and the key cuts a band out of it. The acceptance angle becomes the width of the hole and the key hue becomes where it sits, with nothing anywhere drawing a stripe.",
    patch: {
      bGenlock: 1,
      bGain: 1,
      bKey: 1,
      bKeyAcceptDeg: 34,
      bKeyClip: 0.05,
      bKeySoft: 0.06,
      bKeySpill: 0.5,
      // Parked mid-wheel so the sweep below has room either side of it. The
      // control clamps at 0 and 360, and a sweep that runs into a clamp parks
      // the hole off the end of the picture for most of its cycle — which
      // reads as the preset doing nothing, not as a key at the end of its
      // travel.
      bKeyHueDeg: 180,
      synthShape: 0,
      synthAHz: 15754,
      synthColor: 1,
    },
    // Half depth over a 0..360 control: 90° to 270°, so the transparent hue
    // walks through green at 241 and out the other side without ever hitting
    // the rail.
    mod: [{ target: 'bKeyHueDeg', source: 'sine', rateHz: 0.09, depth: 0.5 }],
  },
  {
    name: 'keyIntoTheLoop',
    displayName: 'key into the loop',
    group: 'A/B mixing',
    blurb:
      "The mixer's own output patched into the keyer's fill input, so the feedback only regenerates inside the shape the key cut. What grows is the silhouette of whatever was the backing colour. The loop is bounded by a matte the picture is making for itself, and every lap it comes back a little further round the hue the delay turns it.",
    patch: {
      bGenlock: 1,
      bGain: 1,
      bHueDeg: 150,
      bKey: 1,
      bKeyAcceptDeg: 40,
      bKeySpill: 0.4,
      bKeyFill: 2,
      cfbMix: 0.62,
      cfbGain: 0.92,
      cfbDelayUs: 0.3,
      cfbLines: 2,
      phosphor: 0.35,
    },
  },
  {
    name: 'wipeFight',
    displayName: 'wipe fight',
    group: 'A/B mixing',
    blurb:
      'Two sources across a slowly sweeping wipe, with sync struggling to hold.',
    patch: {
      bGain: 0.6,
      bLineHz: 1.2,
      bDetuneHz: 150,
      bRollLps: 0.15,
      wipeMode: 1,
      wipeSoft: 0.03,
      wipeRate: 0.25,
      hHold: 0.25,
      noiseIre: 2,
    },
  },
  {
    name: 'negative',
    group: 'Cross-wired',
    blurb:
      'Reversed polarity on the composite line. Luma and every hue flip to their complement.',
    patch: { invert: 1 },
  },
  {
    name: 'sVideoMiswire',
    displayName: 's-video miswire',
    group: 'Cross-wired',
    blurb:
      'S-video pins jammed into a composite jack, with the chroma pin making the best contact. Colour glows hot through a darkened, barely-locking picture, the subcarrier herringbones through brightness, detail decodes as rainbow blocks, and the frame rolls when the shallow sync loses lock.',
    patch: {
      svideoBleed: 1,
      chromaGain: 2.6,
      demodMHz: 1.4,
      encChromaMHz: 2,
      chromaTail: 0.6,
      chromaCoarse: 2,
      chromaPinOnly: 0.5,
      hHold: 0.15,
      noiseIre: 2,
    },
  },
  {
    name: 'noTerminator',
    displayName: 'no terminator',
    group: 'Bad cables',
    blurb:
      'Unterminated line running hot: blown highlights and edges ringing from the reflected wave.',
    patch: { termination: 0.7, agc: 0.3 },
  },
  {
    name: 'daisyChained',
    displayName: 'daisy-chained',
    group: 'Bad cables',
    blurb:
      'Two monitors on one line double-terminate it: dim, washed out, sync barely holding.',
    // AGC now reaches the sync separator (it slices post-IF-gain), so a
    // strong AGC would quietly rescue this fault; a weak one keeps the look
    // the blurb promises while still breathing the way a real set's would.
    patch: { termination: -1.0, agc: 0.2, hHold: 0.5, noiseIre: 2 },
  },
  {
    name: 'looseConnector',
    displayName: 'loose connector',
    group: 'Bad cables',
    blurb:
      'Intermittent contact: bands of the picture cut to snow and flicker as the plug wiggles.',
    patch: { connectorGlitch: 0.45, noiseIre: 2 },
  },
  {
    name: 'bentEnhancer',
    displayName: 'bent enhancer',
    group: 'Circuit bent',
    blurb:
      'Output bridged back to input through a resonant network, keyed by its own brightness: the band rings past unity and a woven oscillation eats into the picture wherever the loop finds light.',
    patch: {
      cfbMix: 0.55,
      cfbGain: 1.0,
      cfbDelayUs: 0.25,
      cfbLines: 1,
      cfbFilterMHz: 1.3,
      cfbFilterQ: 0.75,
      cfbFilterBoost: 2.0,
      cfbKey: 0.8,
      cfbKeyLevel: 52,
      cfbKeySoft: 10,
      noiseIre: 1.5,
    },
  },
  {
    name: 'contourLines',
    displayName: 'contour lines',
    group: 'Circuit bent',
    blurb:
      "The video synth patched over slot A with the picture's own brightness driving its oscillator. Frequency rather than phase, so the wave runs faster through bright picture and slower through dark, equal-brightness regions fall into step, and the image draws itself as contour lines. The colorizer turns those bands into hue, and the encoder downstream gets a picture full of edges it was never designed to carry.",
    patch: {
      synthOver: 0.6,
      synthShape: 1,
      synthAHz: 32000,
      synthFm: 90000,
      synthColor: 0.75,
      synthLevel: 1.4,
      lumaPeak: 1.1,
      chromaGain: 1.2,
    },
  },
  {
    name: 'pouredColour',
    displayName: 'poured colour',
    group: 'Circuit bent',
    blurb:
      "Both synth oscillators run down at frame rate rather than across at line rate, ninety hertz against thirty-seven, so one fits a cycle and a half down the picture and the other under half of one. Their product is a slow beat with no fine structure anywhere. The colorizer then turns level into hue, which on a signal that only changes over hundreds of lines means the whole screen is a few enormous fields of saturated colour rather than the fringing that appears whenever colour is carried on detail. The set's chroma bandwidth is turned down to keep it that way. A narrow colour filter cannot follow an edge, so it holds the fields flat and soft where a wide one would put a rainbow on every line of the picture underneath. What is left of the picture reads through the colour as brightness alone.",
    patch: {
      synthOver: 0.8,
      synthAHz: 90,
      synthBHz: 37,
      synthMix: 2,
      synthShape: 1,
      synthColor: 1,
      synthLevel: 1.8,
      // Mid-range so the routing below has room both ways: the bay's LFOs are
      // bipolar and a control resting at its own end loses half its swing.
      synthHueDeg: 180,
      demodMHz: 0.4,
      chromaGain: 4,
      crtSat: 1.6,
    },
    // The palette turns while the fields stay where they are, which is the
    // colorizer's whole trick: rotating all three phase shifts together slides
    // the wheel without moving the pattern that is being coloured.
    mod: [
      { target: 'synthHueDeg', source: 'smooth', rateHz: 0.04, depth: 0.4 },
    ],
  },
  {
    name: 'silkscreen',
    group: 'Circuit bent',
    blurb:
      "A colorizer wired the way one was actually sold, video in and colour out with its oscillators out of circuit, and slicing rather than phase-shifting. Three comparators sit at three levels and each gun is switched fully on or off at its own threshold, so the output can only be one of eight corners of the colour cube. The cat comes back as a flat yellow shape inside a red outline on a dark green ground, with every area of equal brightness taking the same colour however far apart the two are on screen. The box's own input filter is wide open ahead of it, which keeps the regions large. A slicer given a sharp picture finds a threshold crossing on every piece of detail, and given a soft one it finds a few long boundaries. That filter is on the colorizer's input alone, so the picture reaching the screen keeps all of its detail and the result is a sharp image with flat colour on it. The hue knob slides all three thresholds together, so the colours hold still and the boundaries move through the picture's tonal range.",
    patch: {
      synthOver: 0.9,
      synthColor: 1,
      synthColorSrc: 1,
      synthColorMode: 1,
      synthHueDeg: 180,
      synthColorSoftPx: 14,
      demodMHz: 0.4,
      chromaGain: 3,
      crtSat: 1.6,
    },
    mod: [
      { target: 'synthHueDeg', source: 'smooth', rateHz: 0.03, depth: 0.25 },
    ],
  },
  {
    name: 'falseColour',
    displayName: 'false colour',
    group: 'Circuit bent',
    blurb:
      "The same box with the phase shifter back in it, so level turns continuously through the wheel instead of being sliced into corners. Pointed at the picture, it maps the whole tonal range onto the whole colour wheel. Shadows land at one hue, mid tones a third of the way round, highlights two thirds, and every area of equal brightness comes back the same colour wherever it sits. It looks like the picture reprinted as a heat map. The tones are the image's own, and the only thing added is the decision to read them as hue. Turning the phase rotates the entire palette while the boundaries between the fields stay exactly where the picture's brightness put them.",
    patch: {
      synthOver: 0.9,
      synthColor: 1,
      synthColorSrc: 1,
      synthHueDeg: 180,
      synthColorSoftPx: 14,
      demodMHz: 0.4,
      chromaGain: 3,
      crtSat: 1.6,
      crtSpot: 4,
      crtBloom: 0.6,
    },
    mod: [
      { target: 'synthHueDeg', source: 'smooth', rateHz: 0.03, depth: 0.4 },
    ],
  },
  {
    name: 'blockColour',
    displayName: 'block colour',
    group: 'Circuit bent',
    blurb:
      'The same two slow oscillators as the poured look, into the comparator instead of the multiplier. A comparator has two output levels and nothing in between, so the second oscillator on its reference input decides only where the boundary falls. With both running down the frame at a few cycles, that boundary is a handful of horizontal edges that drift. The colorizer maps level to hue, and a signal with two levels lands on two opposite hues, so the screen becomes hard-edged slabs of red and cyan with the picture reading through each slab as brightness alone. Measured the flattest thing in the table: the fewest hues of any coloured look and less colour edging than a clean signal has.',
    patch: {
      synthOver: 0.8,
      synthAHz: 90,
      synthBHz: 37,
      synthMix: 3,
      synthShape: 1,
      synthColor: 1,
      synthLevel: 1.8,
      synthHueDeg: 180,
      demodMHz: 0.4,
      chromaGain: 4,
      crtSat: 1.6,
    },
    mod: [
      { target: 'synthHueDeg', source: 'smooth', rateHz: 0.04, depth: 0.4 },
    ],
  },
  {
    name: 'litAtTheEdges',
    displayName: 'lit at the edges',
    group: 'Feedback loops',
    blurb:
      "The carrier making hue out of brightness, with the loop kept well under unity so it colours the picture instead of building structure out of it. Where the colour lands is the thing to know, and it is not where you would guess. Translating brightness onto the subcarrier puts the *fast* part of the brightness into the chroma band, so the flat areas of the picture come back nearly neutral and everything the light changes across arrives saturated. A subject is drawn in colour along its own edges (bones, a rim, the line where a shadow starts) with the fields between them left grey, and the loop's delay turns each of those edges a little further round the wheel than the one beside it. The beam is opened to a wide spot so it is laid down as light on glass rather than as pixels.",
    patch: {
      cfbMix: 0.6,
      cfbGain: 0.65,
      cfbDelayUs: 0.9,
      cfbRing: 1,
      cfbRingSrc: 1,
      cfbCarrierKHz: 10,
      demodMHz: 0.15,
      combMode: 2,
      chromaGain: 9,
      crtSat: 2.2,
      crtSpot: 5,
      crtBloom: 0.8,
      phosphor: 0.4,
      cfbGenlock: 1,
    },
    mod: [
      { target: 'cfbCarrierKHz', source: 'smooth', rateHz: 0.04, depth: 0.05 },
    ],
  },
  {
    name: 'contoursOnContours',
    displayName: 'contours on contours',
    group: 'Circuit bent',
    blurb:
      "The same patch with the oscillator's frequency input moved off the deck and onto the camera loop's return, which is this stage's own output one frame ago with the synth already drawn into it. So the contours are traced on last frame's contours rather than on the picture, and the frequency at any point is set by how bright the oscillator's own drawing was there the time before. A little defocus in the lens keeps that from collapsing into single-pixel noise, and a slightly turned lens means each generation lands rotated off the one it grew from. The result is banding that reorganises continuously and never settles, over a subject you can still recognise, with the colorizer turning the whole thing through hue.",
    patch: {
      synthOver: 0.55,
      synthShape: 1,
      synthAHz: 26000,
      synthFm: 110000,
      synthFmSrc: 1,
      synthColor: 0.8,
      synthLevel: 1.3,
      // Mid-range, not at the 0 the control rests at: the bay's LFOs are
      // bipolar, so a routing based at an end spends its run against the clamp
      // (docs/CURATION.md). Based here the palette walks the whole wheel.
      synthHueDeg: 180,
      fbMix: 0.55,
      fbGain: 1.02,
      fbRotateDeg: 0.6,
      fbFocus: 2.5,
      fbBlack: 0.04,
      chromaGain: 1.3,
      phosphor: 0.35,
    },
    mod: [
      { target: 'synthHueDeg', source: 'smooth', rateHz: 0.05, depth: 0.35 },
    ],
  },
  {
    name: 'ringPlaid',
    displayName: 'ring plaid',
    group: 'Circuit bent',
    blurb:
      "Both synth oscillators into the balanced multiplier and the result laid over the picture. One fits eight cycles across a line, the other twenty-one down the frame, so what comes out is a weave neither of them contains. The picture's own brightness is on oscillator A's frequency input, which pulls the bars running across the line tighter through the highlights and lets them out through the shadows, so the fabric is woven at the image's own contours with nothing anywhere drawing an edge.",
    patch: {
      synthOver: 0.7,
      synthMix: 2,
      synthShape: 2,
      // Eight cycles across a line and twenty-one down the frame, both a little
      // off the exact multiple: the weave leans and creeps instead of standing
      // still like something drawn.
      synthAHz: 125800,
      synthBHz: 1260,
      synthFm: 80000,
      synthLevel: 1.8,
      synthColor: 0.8,
      chromaGain: 1.3,
    },
    // How hard the picture pulls the oscillator, walked slowly: the weave
    // tightens and loosens over the image while the image holds still.
    mod: [{ target: 'synthFm', source: 'smooth', rateHz: 0.05, depth: 0.12 }],
  },
  {
    name: 'twoMultipliers',
    displayName: 'two multipliers',
    group: 'Circuit bent',
    blurb:
      "A ring modulator in the synth feeding a ring modulator in the loop. The first beats two oscillators against each other and lays the product over the picture. The second beats that against the machine's own last frame, so every product is an input to the next multiply. With two balanced bridges in series, nothing on screen is at a frequency either oscillator is set to, and the pattern reorganises itself every few seconds without a single control moving.",
    patch: {
      synthOver: 0.6,
      synthMix: 2,
      synthShape: 0,
      synthAHz: 15754,
      synthBHz: 900,
      synthLevel: 1.5,
      synthColor: 0.6,
      cfbMix: 0.6,
      cfbGain: 0.98,
      cfbDelayUs: 0.28,
      cfbLines: 1,
      cfbRing: 0.8,
      chromaGain: 1.3,
      phosphor: 0.45,
      cfbGenlock: 1,
    },
  },
  {
    name: 'punchIn',
    displayName: 'punch in',
    group: 'Circuit bent',
    blurb:
      'A look that sits still until you hit it. The board rests just short of trouble, with two one-shot envelopes patched to the horizontal hold and the deflection bend. Press ⚡ fire in the Modulation section (or the ⚡ on either slot) and the picture is knocked out of lock and recovers on its own, fast one and slow one together. Everything else in the bay says what a knob is doing. This says what you just did.',
    patch: {
      hHold: 0.5,
      bendPeriod: 40,
      noiseIre: 1.5,
      lumaMHz: 3.2,
      phosphor: 0.3,
    },
    // Two rates on purpose: the fast one is the hit and the slow one is the
    // settle, and firing them together reads as one event with a tail rather
    // than two envelopes ending at different times.
    mod: [
      { target: 'hHold', source: 'trig', rateHz: 4, depth: 0.35 },
      { target: 'bendUs', source: 'trig', rateHz: 1.1, depth: 0.3 },
    ],
  },
  {
    name: 'rainbowStorm',
    displayName: 'rainbow storm',
    group: 'Circuit bent',
    blurb:
      'The 3.58 MHz crystal pulled far off-frequency: hue shears across every line and barber-poles down the frame faster than the burst loop can chase it.',
    patch: {
      scDetuneKHz: 7,
      burstLock: 0.55,
      chromaGain: 1.2,
      hHold: 0.25,
      noiseIre: 2,
    },
    // A crystal pulled off frequency does not sit still — it wanders with
    // temperature, which is why the barber pole in a real one never holds a
    // steady pitch. Smooth noise rather than a sine for the same reason.
    mod: [
      { target: 'scDetuneKHz', source: 'smooth', rateHz: 0.05, depth: 0.02 },
    ],
  },
  {
    name: 'neonTube',
    displayName: 'neon tube',
    group: 'Phosphor / CRT',
    blurb:
      'A camcorder pointed at a CRT at night: beam cutoff crushes the background to true black, gamma blooms the cores white-hot, and saturated colour stays electric at the clipping point.',
    patch: {
      crtCutoff: 0.12,
      crtGamma: 2.4,
      crtSat: 1.4,
      crtBloom: 0.6,
      crtHalation: 0.5,
      crtGlow: 0.3,
      chromaGain: 1.5,
    },
  },
  {
    name: 'strobedTube',
    displayName: 'strobed tube',
    group: 'Phosphor / CRT',
    blurb:
      'The blanking gate held on. The guns are cut for most of each cycle and let through in short flashes, over a long-persistence phosphor. It does not cut to black. The gate is upstream of the phosphor, so the light already on the glass keeps decaying through the dark, shifting toward green as red and blue die first. The beam limiter sees the beam current collapse and opens up, so the first field after each dark stretch surges before the servo catches it. Lock the rate to the beat with ♩.',
    patch: {
      strobeHz: 3.5,
      strobeMs: 30,
      phosphor: 0.86,
      phosphorSkew: 0.5,
      phosphorBleed: 0.18,
      crtCutoff: 0.08,
      crtGamma: 1.7,
      crtHalation: 0.6,
      abl: 0.7,
      scanBeam: 0.35,
    },
  },
  {
    name: 'roundTube',
    displayName: 'round tube',
    group: 'Phosphor / CRT',
    blurb:
      'Early-60s colorimetry: the deep 1953 phosphors on an Illuminant-C white. Green and red pull in, whites cool, bright lines fatten between visible scanlines, and a soft-focus gun bleeds every sample into its neighbours.',
    patch: {
      phosphorMode: 2,
      crtCutoff: 0.06,
      crtGamma: 2.2,
      crtSpot: 1.3,
      crtGrain: 0.16,
      crtBloom: 0.3,
      crtHalation: 0.3,
      crtGlow: 0.15,
      scanBeam: 0.45,
      scanBloom: 0.7,
      phosphor: 0.7,
      phosphorBleed: 0.2,
    },
  },
  {
    name: 'greenTerminal',
    displayName: 'green terminal',
    group: 'Phosphor / CRT',
    blurb:
      'Long-persistence mono green tube (P1 family). Everything lands on one phosphor, and motion leaves a seconds-long tail that sums like light rather than paint. It keeps scattering sideways in the layer while it lingers, so old light goes soft and cloudy while the fresh edge stays sharp.',
    patch: {
      phosphorMode: 3,
      phosphor: 0.99,
      phosphorBleed: 0.35,
      crtCutoff: 0.08,
      crtGamma: 2.2,
      crtSpot: 1.2,
      crtGrain: 0.22,
      crtBloom: 0.5,
      scanBeam: 0.5,
      scanBloom: 0.5,
    },
  },
  {
    name: 'radarTube',
    displayName: 'radar tube',
    group: 'Phosphor / CRT',
    blurb:
      'A P7 cascade, the two-layer phosphor radar and oscilloscope tubes were coated with. The beam lands on a fast blue layer and releases most of its light there at once, but what it excites underneath is a slow yellow-green that keeps emitting long after the blue has gone. So the tail changes colour as it fades: the fresh edge is white, a few tenths of a second back it is amber, and what is still glowing seconds later is green. The three channels are given the decay rates the two layers have, and the colour change follows from them dying at different speeds.',
    patch: {
      // Green holds ~2.5s; the skew puts red at a quarter of that and blue at a
      // seventh, which is the cascade. Bleed is high because the long layer is
      // what scatters — the old light in a scope tube goes cloudy while the
      // trace itself stays sharp.
      phosphor: 0.9925,
      phosphorSkew: 3,
      phosphorBleed: 0.3,
      // A scope tube is a dim tube read in a dark room: crushed black for the
      // tail to register against, and a real haze on the glass.
      crtCutoff: 0.1,
      crtGamma: 2.2,
      crtGlow: 0.35,
      crtGrain: 0.18,
      crtSpot: 1.3,
      // The trace is enormously brighter than anything around it, which is the
      // case keyed halation exists for: the live edge throws light well into the
      // faceplate while the decayed tail keeps a tight halo.
      crtBloom: 0.5,
      crtHalation: 0.4,
      crtHaloKey: 2,
      scanBeam: 0.2,
      scanBloom: 0.6,
    },
    // A tube like this says nothing on a still picture — the whole look is what
    // motion leaves behind it, so the preset brings its own sweep.
    mod: [{ target: 'bendUs', source: 'smooth', rateHz: 0.12, depth: 0.1 }],
  },
  {
    name: 'noseAgainstTheGlass',
    displayName: 'nose against the glass',
    group: 'Phosphor / CRT',
    blurb:
      'The magnifier, turned up: close enough to see what the picture is made of. Grille triads, the gaps between scan lines, the granular deposit, and the beam spot bleeding one sample into the next. Drag the magnifier x/y sliders in Screen to move around the glass.',
    patch: {
      crtZoom: 5,
      // parked on a colour-bar boundary, where the beam spot's ramp from one
      // bar into the next is the thing to look at
      crtZoomX: 0.285,
      crtZoomY: 0.3,
      crtSpot: 1.4,
      crtGrain: 0.3,
      maskAmt: 0.55,
      maskPitch: 3,
      scanBeam: 0.6,
      scanBloom: 0.45,
      crtCutoff: 0.05,
      crtGamma: 2.1,
      crtGlow: 0.12,
    },
  },
  {
    name: 'bentDetailer',
    displayName: 'bent detailer',
    group: 'Circuit bent',
    blurb:
      "Jumper across the enhancer's peaking coil. The stage is regenerative, so the sync pulse at the head of every line sets it ringing and the bars build across the picture into the amplifier's rails.",
    patch: {
      enhPeakMHz: 2.5,
      enhPeakQ: 0.86,
      enhPeakBoost: 0.36,
      enhDroopUs: 120,
      noiseIre: 1.5,
      crtCutoff: 0.05,
      crtGamma: 2.1,
    },
  },
  {
    name: 'howlroundLoom',
    displayName: 'howlround loom',
    group: 'Circuit bent',
    blurb:
      "The enhancer's peaking coil regenerative and generating its own sync, fed into a loop whose delay its video is pulling and whose ring mod re-multiplies every product. The howl, the servo warp and the raster lock combine into a full-field electric pattern with no picture left in it.",
    patch: {
      enhPeakMHz: 1.9,
      enhPeakQ: 0.95,
      enhPeakBoost: 3,
      enhSync: 0.8,
      enhSliceIre: 35,
      cfbMix: 0.6,
      cfbGain: 1.05,
      cfbServoUs: 3,
      cfbRing: 0.45,
      cfbLines: 1,
      abl: 0.7,
      fbIris: 0.8,
      fbMix: 0.35,
      fbZoom: 1.04,
      agc: 0.8,
      accLagLines: 14,
      chromaGain: 2,
      matrixClip: 0.7,
      crtSat: 1.4,
    },
  },
  {
    name: 'falseSync',
    displayName: 'false sync',
    group: 'Circuit bent',
    blurb:
      "The stabilizer's sync slicer raised into picture territory. Every dark area produces pulses of its own mid-line, and the set tears wherever the image goes dark.",
    patch: {
      enhSync: 1,
      enhSliceIre: 14,
      enhClampUs: 6,
      hHold: 0.6,
      noiseIre: 2,
    },
  },
  {
    name: 'paperclipChroma',
    displayName: 'paperclip on the chroma',
    group: 'Circuit bent',
    blurb:
      "Metal held across the chroma reference network three times a second, a fifth of a second at a time. While the short is down the set stops trusting the burst and its two demodulators stop sitting 90° apart, so hue shears rather than rotating: some colours come through the bite and their opposites do not. The colour AGC has tens of lines of burst memory here, so its gain responds to each short a good part of a frame late and colour blooms down the picture instead of snapping at either edge of the contact. A bite the set takes two or three frames to show takes five or six to let go of, so every one arrives quicker than it leaves. The gaps between contacts are random rather than counted off a clock, so two land together and then a stretch of nothing, which is what makes this read as somebody's hand instead of a machine.",
    patch: {
      // Three contacts a second at a fifth of a second each: the board is
      // shorted about half the time counting the tails, which is what makes
      // this a look rather than a clean picture with an occasional event in it.
      // The gaps still read, and they are what the rate is for.
      clipHz: 3.2,
      clipPoint: 3,
      clipBite: 0.85,
      clipDwellMs: 200,
      clipChatter: 0.45,
      accLagLines: 36,
      lumaMHz: 3.4,
      noiseIre: 2,
      phosphor: 0.35,
    },
  },
  {
    name: 'blackRestore',
    displayName: 'black restore',
    group: 'Phosphor / CRT',
    blurb:
      'Just the beam transfer: cutoff and gun gamma with no bloom. Lifts the decoded pedestal off the floor for a clean tube with a genuinely black background.',
    patch: {
      crtCutoff: 0.08,
      crtGamma: 2.2,
    },
  },
  {
    name: 'magnetised',
    group: 'Phosphor / CRT',
    blurb:
      'A speaker left against the cabinet, or a set moved without degaussing. A patch of mask stays magnetised and bends all three beams together. A triad is three dots 120° apart, so the same nudge over-excites the one it moves toward and starves the one opposite. The stain turns hue across itself instead of tinting flat, and it is fixed on the glass, so a rolling picture travels through it.',
    patch: {
      crtPurity: 1.1,
      crtPurityX: 0.31,
      crtPurityY: 0.63,
      crtPuritySize: 0.34,
      maskAmt: 0.45,
      maskPitch: 3,
      crtCutoff: 0.08,
      crtGamma: 2.2,
      crtSpot: 1.1,
      scanBeam: 0.4,
      scanBloom: 0.5,
    },
  },
  {
    name: 'misconverged',
    group: 'Phosphor / CRT',
    blurb:
      'Three guns firing through one mask from three positions, registered only in the middle. Sharp at the centre and fringing red and blue harder toward every corner. With the scan-velocity trick wired in on top, edges also get the asymmetric relief consumer sets used to fake sharpness: a white overshoot one side, a black notch the other.',
    patch: {
      crtConverge: 2.6,
      crtSvm: 1.2,
      crtSvmWidth: 3,
      maskAmt: 0.5,
      maskPitch: 3.5,
      crtSpot: 1.4,
      scanBeam: 0.45,
      scanBloom: 0.55,
      crtCutoff: 0.08,
      crtGamma: 2.2,
    },
  },
  // Stacks rather than single mechanisms: several stages misbehaving at once,
  // interfering with each other. The rest of the table is deliberately one
  // fault per preset — it is what makes a chip teachable — but the looks people
  // actually keep are usually three of them at the same time, and nothing here
  // reached that on its own.
  {
    name: 'transmissionFault',
    displayName: 'transmission fault',
    group: 'Full board',
    blurb:
      'Sync suppressed at the head-end while the colour crystal sits off frequency and the tube is left long. Every line lands at its own offset, in the wrong hue, over the ghost of the last one.',
    patch: {
      scramble: 0.35,
      agc: 0.5,
      hHold: 0.3,
      hDetuneHz: 30,
      syncBendUs: 5,
      scDetuneKHz: 5,
      burstLock: 0.6,
      chromaGain: 1.6,
      encChromaMHz: 1.7,
      demodMHz: 1.1,
      noiseIre: 8,
      phosphor: 0.75,
      crtBloom: 0.4,
      crtGamma: 1.4,
    },
  },
  {
    name: 'nightMonitor',
    displayName: 'night monitor',
    group: 'Full board',
    blurb:
      'A monitor run hot in a dark room with a camera on it. The loop grows halos out of the highlights, the faceplate scatters them, and the phosphor holds what is left.',
    patch: {
      fbMix: 0.55,
      fbZoom: 1.01,
      fbGain: 1.06,
      fbFocus: 2,
      fbKnee: 0.7,
      fbVign: 0.6,
      crtBloom: 1,
      crtHalation: 0.9,
      crtGlow: 0.25,
      crtCutoff: 0.06,
      crtGamma: 1.5,
      crtSat: 1.3,
      phosphor: 0.9,
      noiseIre: 2,
    },
    // A loop sitting a hair over unity is a knife edge, and a tube warming up
    // does not hold a bias steady. Drifting the exposure across that edge is
    // what makes the halos breathe instead of settling.
    mod: [{ target: 'fbGain', source: 'smooth', rateHz: 0.03, depth: 0.01 }],
  },
  // Past the redline: every patch below sets at least one control beyond the
  // range it was tuned to, so none of these were reachable before the travel
  // was widened — which is the argument for writing them down rather than
  // leaving the extra range to be found by dragging a slider into its stop.
  //
  // Still the house rule: model the mechanism, let the look emerge. What is
  // different out here is only that the mechanisms are being driven past
  // anything the hardware would have survived, so what they interfere into is
  // no longer a broken television. They are aimed at disagreeing across the
  // frame rather than pumping all of it together — eight heads at uneven
  // spacing, arcs that cluster, a loop ringing against its own rails.
  {
    name: 'everyColourButOne',
    displayName: 'every colour but one',
    group: 'Past the redline',
    blurb:
      "The loop's chroma keyer inverted, which is a large change. A wedge a hundred and forty degrees wide inverted leaves everything outside it regenerating, which is very nearly a loop with no key on it. What survives is one narrow band of hue and the rest of the frame goes over to product, including blanking and the sync tip, which no longer have a key holding them out. The receiver loses the top of the picture to one timing and the bottom to another and a hard seam sits between them. The surviving hue drifts, so which band of the picture is still a picture moves.",
    patch: {
      cfbMix: 0.62,
      cfbGain: 0.95,
      cfbDelayUs: 1.1,
      cfbLines: 1,
      cfbRing: 0.8,
      cfbKey: -1,
      cfbKeyAcceptDeg: 140,
      cfbKeyHueDeg: 180,
      cfbKeySoft: 12,
      chromaGain: 1.5,
      phosphor: 0.5,
    },
    // Parked mid-wheel so a quarter-span walk has room either side: the control
    // clamps at 0 and 360, and a sweep into a clamp parks the surviving band
    // off the end of the picture for most of its cycle.
    mod: [
      { target: 'cfbKeyHueDeg', source: 'smooth', rateHz: 0.04, depth: 0.25 },
    ],
  },
  {
    name: 'pastTheYoke',
    displayName: 'past the yoke',
    group: 'Past the redline',
    blurb:
      'The scan magnified far past anything the tube would frame, and bowed with it. A narrow band of raster stands in for a picture, barrelling against its own beam current.',
    patch: {
      vSize: 3.4,
      bendUs: 70,
      bendShape: 2,
      hvSagUs: 60,
      hvRing: 0.9,
      abl: 0.5,
      hDetuneHz: 900,
      phosphor: 0.85,
      noiseIre: 3,
    },
  },
  {
    name: 'arcStorm',
    displayName: 'arc storm',
    group: 'Past the redline',
    blurb:
      'Eighteen arcs a frame at three times peak white, over a tape that has shed most of its oxide. The hits arrive clustered and the stick-slip shear moves under them, so nothing lands twice in the same place.',
    patch: {
      impulseRate: 18,
      impulseIre: 320,
      strikeRate: 11,
      dropoutRate: 220,
      dropoutLenUs: 40,
      // Enough snow to read as a failing front end, not so much that it buries
      // the arcs and the shear — those are the mechanisms this is about, and
      // past about 40 IRE the uniform noise is all that is left.
      noiseIre: 32,
      tbStickNs: 8000,
      tbJitterNs: 2200,
      phosphor: 0.88,
    },
  },
  {
    name: 'railSlam',
    displayName: 'rail slam',
    group: 'Past the redline',
    blurb:
      'The composite bus fed back at more than unity, ninety lines up, through a resonance that howls. The loop clips to a square and stays there. It cannot run away, so it rings instead.',
    patch: {
      // Just over unity, not far over. The loop clips instead of diverging, so
      // gain this side of the rail rings and gain well past it just pins every
      // sample to +110 and hands back a flat white frame — the saturation is
      // the sound, but only while something still gets through unsaturated.
      cfbMix: 0.93,
      cfbGain: 1.1,
      cfbTrail: 0.96,
      cfbLines: 90,
      cfbDelayUs: 22,
      cfbFilterMHz: 2.4,
      cfbFilterQ: 0.85,
      cfbFilterBoost: 5,
      cfbRing: 0.5,
      noiseIre: 2,
    },
  },
  {
    name: 'chromaRails',
    displayName: 'chroma rails',
    group: 'Past the redline',
    blurb:
      "Colour driven six times past the knob's top into output stages with no headroom left, under a colorized pulse laid over the picture. The guns hit their rails one at a time, so every hue on screen slides to whichever corner of the cube it reached first and the picture comes back in four colours it was never carrying.",
    patch: {
      // The two together are the look; either alone is not it. Gain past 1
      // with the matrix fitting back into gamut (matrixClip 0) just makes
      // vivid colour, and the hard rails do nothing to a picture whose chroma
      // never reaches them — so the palette only collapses to primaries
      // when the overdrive and the clipping are both on.
      chromaGain: 6,
      matrixClip: 1,
      // Twenty-one cycles down the frame rather than twenty: an exact multiple
      // stands still and reads as a texture somebody drew, and the whole point
      // is that nobody drew it. The odd hertz makes the stack creep.
      synthOver: 0.55,
      synthAHz: 638,
      synthShape: 3,
      synthLevel: 2.2,
      // The colorizer is what puts the bars on the wheel; without it they are
      // grey and clip to white, and white is the one thing this palette has
      // none of.
      synthColor: 0.8,
      synthHueDeg: 40,
      // A comb rather than the stock trap, which is the one place this patch
      // asks for a better receiver instead of a worse one. A colorized pulse
      // hands the encoder more chroma sideband than the notch can tell from
      // detail, so on trap every bar comes back shredded into line-rate hash
      // and the flat blocks the clipping is supposed to produce never appear.
      combMode: 2,
      crtSat: 2,
      // A mistrack stripe up at the top edge, where a head switch would sit.
      trackAmt: 0.3,
      trackPos: 0.04,
      noiseIre: 3,
    },
    // Colorizer phase rather than anything in the picture: rotating all three
    // phase shifts together slides the palette round the wheel without moving
    // a single edge, so the bars stay exactly where the oscillator put them
    // and only which four colours survive the rails changes. Slow, and short
    // of a full turn — a wire that carousels the whole wheel reads as a demo
    // of the colorizer rather than as a set drifting.
    mod: [{ target: 'synthHueDeg', source: 'sine', rateHz: 0.04, depth: 0.35 }],
  },
  {
    name: 'outOfHeadroom',
    displayName: 'out of headroom',
    group: 'Past the redline',
    blurb:
      'Two controls and nothing else: colour driven nine times up, into output amplifiers that simply hit their rails. Every hue on screen slides to whichever corner of the RGB cube it reached first, and the picture comes back in primaries it was never carrying. The mechanism on its own, to lay over whatever is already on the board.',
    patch: {
      // Deliberately bare. Everything else that reads as this look — bars,
      // hash, a phosphor — is a separate mechanism that happens to sit well
      // with it, and bundling any of them here would stop this being the one
      // thing you can drag partway into another patch to find out what the
      // rails alone are doing to it.
      chromaGain: 9,
      matrixClip: 1,
    },
  },
  {
    name: 'soundAtTheRails',
    displayName: 'sound at the rails',
    group: 'Past the redline',
    blurb:
      'The audio patched straight into the video input under output stages with no headroom left, so loud passages land on the burst and the whole frame snaps between primaries on the beat. The waveform is on the deflection and the demodulator reference as well, drawing itself into the geometry and the hue one sample per scan line. Enable the microphone under Audio.',
    patch: {
      chromaGain: 6,
      matrixClip: 1,
      // Hot enough to reach the burst and the sync tips, which is the whole
      // reason this is the audio routing that pairs with the rails: it moves
      // the colour reference rather than the picture, so what the beat does is
      // re-decide which corner every hue clips to.
      audioIre: 90,
      audioHueDeg: 60,
      audioBendUs: 30,
      audioGain: 4,
      phosphor: 0.6,
      noiseIre: 2,
    },
  },
  {
    name: 'lightThatStays',
    displayName: 'light that stays',
    group: 'Past the redline',
    blurb:
      'A phosphor that gives almost nothing back, scattering sideways as it goes, under a gun with its gamma inverted. Everything the beam has touched is still on the glass, spreading.',
    patch: {
      phosphor: 0.999,
      phosphorBleed: 0.9,
      phosphorSkew: 5,
      // Gamma this far under 1 lifts the floor as hard as it lifts the mids,
      // and a tube whose black is white has nothing for the glow to sit on. The
      // cutoff puts the floor back: the gun stays off below the knee, so the
      // lifted part is only what the beam actually lit.
      crtGamma: 0.4,
      crtCutoff: 0.15,
      crtSat: 4.5,
      crtBloom: 3,
      crtHalation: 2.5,
      crtSpot: 6,
    },
    // A phosphor that holds this long has nothing to show on a still frame —
    // the trail IS the motion, so with a static source the whole patch reads as
    // a slightly soft picture. Lorenz rather than an LFO because a periodic
    // sweep would lay its trail back down on itself every cycle and average
    // out; the chaotic one never quite repeats, so the light accumulates
    // somewhere new each pass and the smear stays spatial.
    mod: [{ target: 'bendUs', source: 'lorenz', rateHz: 0.08, depth: 0.04 }],
  },
]

export function presetControls(patch: Partial<Controls>): Controls {
  return { ...DEFAULT_CONTROLS, ...patch }
}

export function controlsEqual(a: Controls, b: Controls): boolean {
  return CONTROL_KEYS.every(k => a[k] === b[k])
}

// Each authored patch resolved against the defaults, once, at module load. The
// patches are static, so the resolution is too — and everything that compares
// against a preset (`matchPreset` on every panel render, the blender on every
// pointer step of a weight drag) was rebuilding all 66 full 213-key objects to
// do it. That was half a millisecond per write, spent re-deriving a constant.
const PRESET_FULL: ReadonlyMap<PresetDef, Controls> = new Map(
  PRESETS.map(p => [p, presetControls(p.patch)]),
)

// A preset's full control-set. Falls back to resolving on the spot for a def
// that isn't one of PRESETS' own — nothing hands one in today, and the map
// lookup should not be the reason that stops working.
function fullControls(p: PresetDef): Controls {
  return PRESET_FULL.get(p) ?? presetControls(p.patch)
}

// How much of each preset is dialed in, by preset name. Absent or 0 is off.
export type PresetWeights = ReadonlyMap<string, number>

// Which controls a preset moves off stock. Derived once per preset from the
// same PRESET_FULL the blender reads, because the roll has to know what a
// candidate would tread on before it picks it — and because `matchPreset`
// below decides a whole preset from the size of one of these.
const PRESET_KEYS: ReadonlyMap<string, ReadonlySet<ControlKey>> = new Map(
  PRESETS.map(p => {
    const full = fullControls(p)
    return [
      p.name,
      new Set(CONTROL_KEYS.filter(k => full[k] !== DEFAULT_CONTROLS[k])),
    ]
  }),
)

// The preset whose full control-set exactly matches `values`, if any.
//
// Decided from the keys the board holds off stock rather than by comparing it
// against each preset in full. The two are the same question: every key where
// the board and a preset both sit at stock agrees for free, so a preset matches
// exactly when it moves the same keys the board does and agrees on those. One
// pass over the board answers it for all of them, and each preset is then a
// size comparison and a handful of reads.
//
// It is worth the restatement because of what the old spelling cost in place.
// `PRESETS.find(p => controlsEqual(fullControls(p), values))` is 85 presets ×
// 252 keys, and a board that matches nothing — anyone who has touched a knob —
// scans all of them: 21,420 reads. Against a fresh object that is 149 us;
// against the **live** board it is 612 us, because a `Controls` that has been
// spread and then written to by the glide, the bay and every drag reads about
// three times slower than the module literal it came from, and this had 21,420
// of those to do. It runs in a render body, so a panel update wore it.
export function matchPreset(values: Controls): PresetDef | undefined {
  const off = CONTROL_KEYS.filter(k => values[k] !== DEFAULT_CONTROLS[k])
  return PRESETS.find(p => {
    const moved = PRESET_KEYS.get(p.name)
    // Size, then values, and nothing checks membership: a key in `off` whose
    // value agrees with the preset's is a key the preset moved too, so `off`
    // is already a subset and matching sizes make it the same set.
    const full = fullControls(p)
    return (
      moved !== undefined &&
      moved.size === off.length &&
      off.every(k => values[k] === full[k])
    )
  })
}

// Fisher-Yates. `toSorted(() => rand() - 0.5)` is the idiom this used to use and
// it is not a shuffle: a comparator that ignores its arguments biases toward the
// input order by an amount that depends on the sort implementation, and what is
// being ordered here is which preset family gets to lead the roll. Measured over
// 40000 draws on this engine, against a fair 9.1% each: Tape wear led 18.1% of
// rolls and Phosphor / CRT 5.5%, a 3.3x spread across families, purely from
// where they sit in this file. Somebody rolling and rolling and getting tape
// again was reading the sort comparator, not the presets.
//
// `rand` rather than `Math.random` inside, which is what lets `vote/candidates.ts`
// sample the same space from a recorded seed: a dataset labelling looks nobody
// can render again is worth nothing, and it calls straight through to
// `randomPresetMix` rather than keeping a second copy of the roll.
function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// A follower must move controls no other preset in the roll has moved. Sharing
// even one is what puts a roll somewhere no author stood: `blendPresets` sums
// departures, so two presets that both reach for a knob land past whichever of
// them reached furthest.
//
// This was 2 — a couple of shared controls read as two faults meeting. Measured
// over 8000 rolls, that allowance put an overshot control in **24.6%** of them,
// and 21.5 points of the 24.6 were `noiseIre` alone: two presets that each add
// snow sum their snow, and the picture washes out to speckle. Disjoint
// followers cost 0.01 presets and 0.5 controls per roll and take overshoot to
// zero, because a control moved by exactly one preset cannot exceed it.
const MAX_TREAD = 0

// A fresh recipe: one full preset plus one or two partial ones from other
// groups, so a roll crosses families instead of deepening one. Shared by the
// "random look" button and by `?surprise` on a link, which is how the docs
// harness fills a gallery without clicking anything.
//
// Followers are chosen against what is already claimed rather than at random
// within their group, because `blendPresets` *sums* departures from stock: when
// two presets both move a control, the roll lands somewhere neither author put
// it. Over 4000 simulated rolls that was 1.6 controls fought over and 1.0
// pushed past every contributing preset, per roll — the arithmetic, not a look
// anybody designed, and the readiest explanation for a roll coming out mush.
// Picking the least-treading candidate in each group takes that to 0.4 fought
// over, and requiring the winner to tread on nothing at all (MAX_TREAD, below)
// takes the overshoot to zero.
//
// Summing stays as it is. It is what dragging two chips by hand means, and the
// roll has no business redefining that for the mixer — this fixes the roll by
// not handing the blender an argument in the first place.
export function randomPresetMix(
  sourceBOn: boolean,
  rand: () => number = Math.random,
): PresetWeights {
  const pool = PRESETS.filter(
    p => p.group !== 'Clean' && (sourceBOn || p.group !== 'A/B mixing'),
  )
  const groups = shuffled([...new Set(pool.map(p => p.group))], rand)
  // Two most of the time. Three whole authored looks at once — which is what a
  // 50/50 split was rolling — is a lot of picture to ask one frame to hold, and
  // the third is the one most likely to be the fault that tipped it over.
  const wanted = rand() < 0.3 ? 3 : 2
  const lead = pool.filter(p => p.group === groups[0])
  const first = lead[randomIndex(lead.length, rand)]
  const weights = new Map<string, number>([[first.name, 1]])
  const claimed = new Set(PRESET_KEYS.get(first.name))
  for (const g of groups.slice(1)) {
    if (weights.size >= wanted) break
    // 'Full board' presets are complete looks in themselves — as a lead that is
    // the point of them, on top of one it is a second whole board.
    //
    // 'Feedback loops' are held back for a different reason: a loop is a gain
    // and the limiter that bounds it, and a follower's weight scales the pair
    // together. The round-trip gain stays above unity while the knee, the iris
    // and the black clamp that were holding it come down with the weight, so
    // the loop grows every pass and the picture walls out to a flat white field
    // over the frames a feedback look needs to develop. Measured over 8000
    // rolls, 18.8% engaged a loop above unity; on 24 rolls against a clip that
    // showed up as 3 of 24 blown out, and none once loops arrive as leads only.
    // A lead comes in at weight 1 with its limiter intact, which is the look
    // somebody tuned.
    const opts = pool.filter(
      p =>
        p.group === g &&
        p.group !== 'Full board' &&
        p.group !== 'Feedback loops',
    )
    if (opts.length === 0) continue
    const best = opts
      .map(p => ({
        p,
        tread: [...(PRESET_KEYS.get(p.name) ?? [])].filter(k => claimed.has(k))
          .length,
      }))
      .toSorted((a, b) => a.tread - b.tread)[0]
    if (best.tread > MAX_TREAD) continue
    // Lower than the 0.3-0.8 this used to roll. A follower at 0.8 is not a
    // seasoning on the lead, it is a second look at nearly full strength, and
    // two of those over a lead is where "fun but not the best settings" came
    // from. Still enough to read: these are departures from stock, so a quarter
    // of a fault is a quarter of something that was designed to be visible.
    weights.set(best.p.name, 0.25 + rand() * 0.25)
    for (const k of PRESET_KEYS.get(best.p.name) ?? []) claimed.add(k)
  }
  return weights
}

// One authored look, whole and undiluted — the roll that stacks nothing.
//
// `randomPresetMix` answers "something I have not seen", and pays for it by
// putting a look together that nobody designed. This answers the other half of
// what a random button is for: show me one of the things somebody sat down and
// tuned, and let me see it at the strength it was tuned at. It is the chip
// nobody scrolls to — seventy of them behind a fold, and a session reaches for
// the same six.
//
// The group is drawn first and the preset out of it second, which is not the
// same as drawing uniformly from the presets: the families are wildly different
// sizes, and a flat draw would spend most of a session inside whichever one has
// the most entries this month.
// `avoid` is the preset already on the board, dropped from the draw: with nine
// families a repeat comes up often enough to read as the button not having
// fired, and this is the one roll where you can tell — the chip that lights up
// is the same one that was lit. Dropped before the group is picked, so a family
// of one that is the excluded preset takes itself out of the draw rather than
// leaving an empty group to be picked from.
export function randomSinglePreset(
  sourceBOn: boolean,
  rand: () => number = Math.random,
  avoid: string | null = null,
): PresetWeights {
  const pool = PRESETS.filter(
    p =>
      p.group !== 'Clean' &&
      p.name !== avoid &&
      (sourceBOn || p.group !== 'A/B mixing'),
  )
  const group = shuffled([...new Set(pool.map(p => p.group))], rand)[0]
  const lead = pool.filter(p => p.group === group)
  return new Map([[lead[randomIndex(lead.length, rand)].name, 1]])
}

// Controls holding a mode rather than a quantity: halfway between phosphor 0
// and 3 is not phosphor 1.5, it is a tube nobody asked for. The heaviest
// preset that moves one of these off its default picks the mode outright.
// Derived from which controls declare `choices`, so the blender and the panel's
// toggle groups can't drift from one hand-kept list.
// Exported for the morph, which needs the same list for the same reason and
// must not keep a second one: a mode cannot be halfway between two values
// whether you get there by mixing or by travelling.
export const ENUM_KEYS: ReadonlySet<ControlKey> = new Set<ControlKey>(
  [...SLIDER_BY_KEY.values()].filter(s => s.choices).map(s => s.key),
)

// Controls that hold rather than add. Retention is a rate, not an amount: put
// two phosphors together and the light stays as long as the slower one, it does
// not stay longer than either. Summing them says otherwise, and the value is
// geometric in what you see — 0.9 is a tenth of a second, 0.99 a second and a
// half, 0.9995 half a minute — so a lead at 0.9 with a quarter of a follower on
// top lands off the end of the dial on a smear that never clears. That was the
// roll covering its own work: over 4000 rolls, 2.9% came out past *every* preset
// that contributed and 2.9% pinned to the top of the track.
//
// So the longest hold wins and the rest abstain, as they do for a mode. A
// follower is still heard — at a quarter weight it is a quarter of a hold, which
// only wins if the lead brought none — and a tube coated for seconds of
// afterglow stays something you pick rather than something a roll stumbles into.
// Derived from the curve rather than named, because the curve is the same
// statement: this value is not linear in what it does.
const HOLD_KEYS: ReadonlySet<ControlKey> = new Set<ControlKey>(
  [...SLIDER_BY_KEY.values()]
    .filter(s => s.curve === 'persistence')
    .map(s => s.key),
)

// Snap a summed value back onto its slider's range and grid, so a mix lands on
// values the UI can actually show and `matchPreset` can compare exactly.
function quantize(key: ControlKey, v: number): number {
  const s = SLIDER_BY_KEY.get(key)
  return s === undefined ? v : snapToStep(s, v)
}

// What a recipe says about motion: the heaviest preset that carries routings
// wins outright, its depths scaled by how much of it is in.
//
// Routings do not sum the way control departures do — they are patch cables,
// and half of one cable plus half of another is not a quieter version of both,
// it is a different bay. So this follows the ENUM_KEYS rule instead: the
// heaviest mover picks, everyone else abstains. `null` is "the recipe has no
// opinion", which the caller reads as leave the bay alone.
export function blendMod(weights: PresetWeights): ModRouting[] | null {
  const winner = weights
    .entries()
    .filter(([, w]) => w > 0)
    .toArray()
    .toSorted(([, a], [, b]) => b - a)
    .flatMap(([name, w]) => {
      const def = PRESETS.find(p => p.name === name)
      return def?.mod === undefined ? [] : [{ w, mod: def.mod }]
    })
    .at(0)
  return winner === undefined
    ? null
    : winner.mod.map(m => ({ ...m, depth: m.depth * winner.w }))
}

// Presets mix by summing their departures from default onto `baseline`, so
// dialing in two faults accumulates both instead of the later one winning.
// ENUM_KEYS and HOLD_KEYS are the two exceptions, each for its own reason.
// Weight 1 on a single preset over the default baseline reproduces
// `presetControls(patch)` exactly, which is what keeps `matchPreset` honest.
export function blendPresets(
  baseline: Controls,
  weights: PresetWeights,
): Controls {
  const active = weights
    .entries()
    .filter(([, w]) => w > 0)
    .toArray()
    .toSorted(([, a], [, b]) => b - a)
    .flatMap(([name, w]) => {
      const def = PRESETS.find(p => p.name === name)
      return def === undefined ? [] : [{ w, full: fullControls(def) }]
    })
  const out = { ...baseline }
  for (const k of CONTROL_KEYS) {
    const moved = active.filter(a => a.full[k] !== DEFAULT_CONTROLS[k])
    if (moved.length > 0) {
      // `active` is heaviest-first, so the leading mover wins the enum keys.
      // A hold key takes whichever mover reaches furthest instead, starting
      // from what the board already holds.
      const from = DEFAULT_CONTROLS[k]
      out[k] = ENUM_KEYS.has(k)
        ? moved[0].full[k]
        : quantize(
            k,
            HOLD_KEYS.has(k)
              ? moved
                  .map(a => from + a.w * (a.full[k] - from))
                  .reduce(
                    (acc, v) =>
                      Math.abs(v - from) > Math.abs(acc - from) ? v : acc,
                    baseline[k],
                  )
              : moved.reduce(
                  (acc, a) => acc + a.w * (a.full[k] - from),
                  baseline[k],
                ),
          )
    }
  }
  return out
}

// The board a roll means: the recipe over stock, with the view controls — and a
// strobe the board was not already running — taken back from `view` instead of
// from the recipe.
//
// One function because there are two roll paths — the button in `useMix` and
// `?surprise` on boot in `useEngine` — and they are one verb that has to reach
// one place. Each used to carry its own copy of this rule and one of them was
// missing it, which is not a thing anybody notices by reading: it shows up as
// a link occasionally opening the app on a picture the size of a stamp, weeks
// later, with nothing to connect it to.
//
// What `view` should be differs, and that is the argument rather than a second
// branch in here. The button keeps where the magnifier already is, because a
// roll has no business moving your eye mid-session; the boot path has no
// "already" to keep and passes stock.
export function rollControls(weights: PresetWeights, view: Controls): Controls {
  const out = blendPresets(DEFAULT_CONTROLS, weights)
  for (const key of VIEW_KEYS) out[key] = view[key]
  // The same rule the jitter follows, and for the reason spelled out where the
  // set is defined: a roll never *starts* a strobe. It was only half a rule —
  // random nudge would not begin one, but random look picked the strobed tube
  // as a lead or a follower on 3% of presses, one in thirty-three, and handed
  // back a full-field flash at 0.9 to 3.5 Hz over whatever else it had rolled.
  // The chip is still there to click, which is a choice somebody made.
  for (const key of ROLL_NEVER_STARTS) if (view[key] === 0) out[key] = 0
  // And the two rules about where a control lands rather than about zero: no
  // barred shape and no ringing supply the board was not already holding.
  // Through `rollLanding` so the three rolls cannot disagree — the jitter and
  // the throw read the same function.
  //
  // A roll is where these bite hardest. `bendShape` is an enum key, so a
  // follower at weight 0.25 hands its shape over whole while the amplitude
  // around it scales down, and the HV tank arrives stacked under whatever else
  // the roll drew rather than as the look somebody tuned it inside. Both chips
  // still click through at full strength, which is a choice somebody made.
  for (const key of [...ROLL_NEVER_LANDS.keys(), ...ROLL_STAYS_UNDER.keys()]) {
    out[key] = rollLanding(key, out[key], view[key])
  }
  return out
}

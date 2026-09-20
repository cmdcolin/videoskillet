import { clamp } from '../core/math'

import type { Controls, ControlKey } from '../core/controls'
import type { SourceBMode, SourceMode } from '../sources/modes'
import type { CurveName } from './travel'

export interface SliderDef {
  key: ControlKey
  // This control's number on the wire (ui/packed.ts). Assigned once, at birth,
  // and never changed or reused: a packed link says "control 84", so a control
  // that renumbers turns every link and every saved look carrying it into a
  // different look. A new control takes one past the highest here; a deleted
  // one leaves its number behind unspoken, which is all a hole needs to be.
  //
  // It lives on the control rather than in a list beside the table because the
  // list version was an invariant somebody had to remember — never insert,
  // never reorder — and this one cannot be got wrong by moving a slider into
  // the group it belongs in.
  id: number
  label: string
  min: number
  max: number
  step: number
  unit: string
  // Plain-language mechanism behind the control, shown by the slider's ? icon.
  // Say what breaks in the hardware, not what the picture looks like — the look
  // is emergent, and knowing the cause is what makes the knobs combine.
  help: string
  // A discrete mode rather than a quantity: one label per integer value, index
  // == value. Presence renders a toggle-button group instead of a slider and is
  // the single source of truth for which controls blend by mode (ENUM_KEYS in
  // presets), so min/max/step still bound the same integer for MIDI and mod.
  choices?: string[]
  // How the travel maps onto the value; omitted is linear. The curves live in
  // travel.ts. 'magnifier' is the view-fraction scale in lens.ts, which puts
  // the fine control where the useful magnifications are and keeps a detent at
  // 1x; 'persistence' is logarithmic in what the phosphor keeps back, because
  // trail length is geometric in it and a linear track spends its whole lower
  // half on holds too short to see.
  //
  // 'zero' and 'unity' are the general ones, and most of a control's tuning is
  // deciding whether it wants one: they expand the travel around the stock
  // setting (0, or ×1) and coarsen away from it, so a pixel near stock is worth
  // one `step` and the far end of the span is still reachable. Take one on any
  // control where the whole mechanism lives in the first percent — a detune, a
  // loop's geometry, a bend — and leave it off where the span reads evenly (a
  // gain, a hue, a key level): the curve is not a general improvement, it is
  // travel taken from one end and given to the other. `step` is the fine end's
  // resolution once curved, so it is worth lowering at the same time.
  //
  // 'shuttle' is the one that expands around a fixed point the control does not
  // rest at: a tape speed is geometric out of *pause* in both directions, and
  // play — where the row does rest — sits a fifth of the way along that.
  curve?: CurveName
  // Present on a control whose travel now runs past the range it was tuned to:
  // the old [min, max], drawn as a notch on the track at whichever end grew.
  //
  // Past a notch the mechanism is still the modelled one and still numerically
  // safe — every extended path is railed, clamped, or normalized downstream, and
  // the ones that were not (the decode tile halo on chromaCoarse, the
  // dub-generation buffers) were left where they are — but
  // the value is beyond anything the hardware would have done. That is the
  // point; it is also worth being able to see, since `min`/`max` are the span
  // mutate jitters by and mod depth is a fraction of, so a widened control makes
  // both proportionally wilder.
  redline?: readonly [number, number]
  // A trim rather than a look-maker: adjusts the character of an effect some
  // other control turns on. The group tucks these behind a "fine tweaks"
  // disclosure so the rows that make the picture stay in reach. Absent = shown.
  fine?: true
  // Offer the minor-adjustment card: a second track the row's `minor` button
  // opens under it (vernier.ts). Nothing about the row changes: the step, the
  // curve and the shared readout column are all as they were.
  //
  // `true` moves the value in hundredths of `step`, for a control whose step is
  // a floor the mechanism can see past — the loop's geometry, where a notch of
  // track near stock is one step and the offsets worth hunting are smaller.
  //
  // `{ span }` spreads that much of the control across the card at its own
  // step, for a control whose step is fine enough and whose track is not — loop
  // delay, where a pixel of track is hundreds of steps. Pick the span off the
  // mechanism: a turn or two of hue, a roll slow enough to follow. `step` walks
  // the card finer than the row, down to a hundredth of the row's step, which is
  // what the wire carries (packed.ts); changing the row's own step would
  // redecode every link that carries the control.
  vernier?: true | { span: number; step?: number }
}

// The signal-path stages, in the order the panel's spine is browsed. A group
// placed on one of these renders in that stage.
//
// The head of the chain is an input, not a process: A and B are the same kind
// of thing — a source, its deck, its cable — and naming only one of them left
// the panel filing A's feed pair on a trunk stage called 'Source' and B's on a
// branch called 'Mix'. Two identical group pairs at two unrelated addresses,
// and the one box named after an input was named after what happens to *both*.
// So the trunk's head is 'Source A', its mirror hangs below it (SOURCE_B_STAGE,
// which is not a Phase — B joins the trunk rather than dividing it), and 'Mix'
// is the stage where the two meet and nothing else.
// 'Feedback' was here, between Mix and Tape, and it was not a stage. It was
// three machines filed under one word: a camera looking at the tube, the mixer
// bus patched into itself, and a second deck threaded with a loop of tape. They
// did not even re-enter at the same place — `compose` for the camera, ahead of
// the encoder, and `fbComposite` for the mixer bus, straight after the A/B sum
// (gpu/pipeline.ts) — so the box was standing on the wire between two different
// re-entry points and claiming to be both. The two that are left are each a
// stage of their own, hung off the trunk on the loop band, and each is reached
// by pressing its own return; the tape deck went with the loop it was. See
// LOOP_STAGES.
export const PHASE_ORDER = [
  'Source A',
  'Mix',
  'Channel',
  'Receiver',
  'Screen',
] as const
export type Phase = (typeof PHASE_ORDER)[number]

// The loops, as placements. A loop is not a division of the trunk — it is
// a machine patched across it — so it is off the spine for the same reason the
// two branches are, and its groups say which loop rather than which stage.
const LOOP_PLACES = ['camera', 'mixer'] as const
export type LoopPlace = (typeof LOOP_PLACES)[number]

// Where a group lives in the panel — its single source of placement truth, so
// nothing can silently fail to render:
//   a Phase — in that stage of the browsable signal-path spine;
//   'b'     — on the map's B branch (the Source B stage), openable only when
//             source B is on;
//   'audio' — on the map's Sound branch (SOUND_STAGE), openable only when an
//             audio input is picked;
//   'view'  — on the map's View box (VIEW_STAGE), which is not in the signal
//             path at all: it is where the picture is watched from;
//   a LoopPlace — on one of the three returns drawn over the trunk, openable
//             by pressing that return. Always openable: unlike a branch there
//             is nothing to patch into a loop, the loop *is* the patch.
//
// 'b' is the one placement that can take a control off screen entirely, so it
// is only for controls that genuinely have nothing to do without a second
// source. A control that still bites with B switched off — anything on input
// A's own feed, say — belongs on the spine, or a preset or a randomize can set
// it with no row anywhere to put it back. The Mix stage answers to the same
// rule from the other side: it is a Phase, so it is always drawn, but with
// nothing patched into B every control in it is inert and it opens onto
// nothing — see PathNode.off.
type Placement = Phase | 'b' | 'audio' | 'view' | LoopPlace

export interface Group {
  name: string
  place: Placement
  sliders: SliderDef[]
  // A group that describes a generator rather than the stage it is filed under.
  // Listed only while something is actually running that generator — see
  // `generatorsLive` below and the gate in panelChain.ts.
  generator?: GeneratorKind
}

// The two generators either slot can be showing. They are not sources in the
// picker's sense: one pair of oscillators and one noise generator on the bench,
// patched into whichever slot is calling for them.
export type GeneratorKind = 'noise' | 'synth'
export type GeneratorsLive = Record<GeneratorKind, boolean>

// The two per-source feeds, named here because the full diagram draws each as a
// box of its own and opens the panel at it. One mechanism (feed.wgsl bound to
// two uniform blocks) that the panel files in two places — A's on the Source
// stage, B's on the branch — so the names have to be reachable from outside the
// group list rather than retyped at the one place that addresses them.
// Each feed is two physical things in series — the machine and the wire out of
// it — and they are two different diagnoses: "this deck is broken" reaches for
// pause, dropouts and the head-end, "this cable is broken" for the plug, the
// ground and the terminator. Splitting them is what keeps either half scannable
// now that the connector and the ground loop are per input, and it is why the
// two inputs read as a pair: the same two groups, in the same order, per
// channel — A's on the Source A stage and B's on the Source B branch, which is
// the same pair of stages drawn one above the other on the map.
export const FEED_A_GROUP = 'Feed A · deck'
export const FEED_A_CABLE_GROUP = 'Feed A · cable'
export const FEED_B_GROUP = 'Feed B · deck'
export const FEED_B_CABLE_GROUP = 'Feed B · cable'

// The video synth's group, named for the same reason the feeds are: it is one
// of the two generator groups that describe whichever slot is showing them
// rather than belonging to input A, so the test that holds A and B to the same
// three groups has to be able to say so by name instead of guessing at a prefix.
export const SYNTH_GROUP = 'Video synth (source)'

// Which generators are running, which is what decides whether their groups are
// listed at all. Either slot can be the one showing one, so both modes are read.
//
// The synth has a third way of being live and it is the one worth having this
// function for: `synthOver` patches it *over* slot A's picture rather than
// instead of it (compose.wgsl), so with a video in A and that control up the
// synth is a module in the chain while no picker anywhere says 'synth'. Gating
// on the two modes alone would take the group off screen while it was drawing
// half the picture.
const runsNoise = (m: SourceMode | SourceBMode) =>
  m === 'tv static' || m === 'vhs static'

export const generatorsLive = (
  a: SourceMode,
  b: SourceBMode,
  controls: Controls,
): GeneratorsLive => ({
  noise: runsNoise(a) || runsNoise(b),
  synth: a === 'synth' || b === 'synth' || controls.synthOver > 0,
})

// Each carries its stage's name plus the physics that closes it, which is the
// one thing that tells the three apart once more than one is running.
export const CAMERA_LOOP_GROUP = 'Camera feedback (optical)'
export const MIXER_LOOP_GROUP = 'Mixer feedback (electrical)'

// Which of the three are actually carrying signal, so a drawing can show a
// running loop rather than only the three that exist in principle. One shape
// for both drawings and for the panel, and this is what stops them disagreeing
// about the names.
export type LoopsLive = Record<LoopPlace, boolean>

// The three loops as stages of the panel — one table, because five surfaces ask
// about them and every one of them used to answer for itself: the miniature
// drew and named the runs, the full diagram drew and named them again with a
// second set of sentences, the legend under it had a third, the panel filed all
// five of their groups under one 'Feedback' header, and the test that holds a
// lit run to a dispatched pass named the three mixes a fourth time.
//
// They are two because two passes close two different paths (see
// gpu/pipeline.ts), and the paths are what the names are for — the physics that
// closes a loop is the only thing that tells one from another once more than
// one is running. The camera loop is optical: it points at the tube's face, so
// it can only do what a lens can. The mixer loop is electrical: it carries the
// subcarrier round with it, so it does things optics cannot.
interface LoopStage {
  loop: LoopPlace
  // What the panel calls the stage, what the map opens by name, and what the
  // full diagram writes on the run — which has the width for the whole of it,
  // and a legend under it explaining what the loop does.
  name: string
  // What the miniature writes on the run instead, in lowercase — which is a CSS
  // rule there (ChainMap.module.css) rather than a second spelling here.
  //
  // The full name is right on the card and wordy on a 304-unit strip, where the
  // run is one of two stacked over the chain and the band it rides has
  // already said 'loop' by being the loop band. The word that is left is the
  // machine, which is the thing being pointed at. A hover carries the whole
  // name, and so does the heading you land on.
  short: string
  // The one-liner the run's hover and the stage's heading carry.
  blurb: string
  // The whole sentence, for the full diagram's legend — the one place with room.
  what: string
  // The mix that decides whether this loop is running. The pass closing the
  // loop is gated on the same control, so a lit run and a dispatched pass mean
  // the same thing (controls.test.ts holds both to real controls).
  mix: ControlKey
}

// Both by name, for the surfaces that address one of them by identity —
// written above the table and read out of it, so a rename lands in one place.
//
// Each says 'feedback' rather than 'loop', because 'loop' is the half of the
// name the band they ride already says and 'feedback' is the thing a first
// visit is looking for. Nobody arrives wondering where the loops are; they
// arrive wanting the camera pointed at the screen.
export const CAMERA_LOOP_STAGE = 'Camera feedback'
export const MIXER_LOOP_STAGE = 'Mixer feedback'

export const LOOP_STAGES: readonly LoopStage[] = [
  {
    loop: 'camera',
    name: CAMERA_LOOP_STAGE,
    // The machine. Each of the three is named for a different piece of gear,
    // so the first word is the one that carries the difference and the rest of
    // the name is what the loop band already says.
    short: 'Camera',
    blurb:
      'optical: a camera pointed at the tube, its picture mixed back in ahead of the encoder, plus the gun and glass it is looking at',
    what: 'an optical loop. A camera points at the tube and the mixer feeds its picture back into the input ahead of the encoder. The camera itself can only do what a lens does — zoom, shift, defocus, black level — but the return re-enters ahead of the encoder, so a lap is a whole encode/decode generation and every fault between there and the glass is inside it, applied once per generation. Above unity gain it builds structure on its own',
    mix: 'fbMix',
  },
  {
    loop: 'mixer',
    name: MIXER_LOOP_STAGE,
    short: 'Mixer',
    blurb:
      'electrical: the composite taken off the bus and crossfaded back against the live signal, subcarrier included',
    what: 'an electrical loop. The mixer takes the composite signal off the bus into an input and crossfades it against the live signal. The subcarrier travels round with it, so each sample of cable delay rotates fed-back hue by 90° per generation',
    mix: 'cfbMix',
  },
]

export const LOOP_STAGE_NAMES: readonly string[] = LOOP_STAGES.map(l => l.name)

export const GROUPS: Group[] = [
  {
    name: 'Signal (source A)',
    place: 'Source A',
    sliders: [
      {
        key: 'invert',
        id: 20,
        label: 'invert (polarity swap)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Negates the composite waveform out of the encoder, as if the video pair were wired backwards. Hue inverts with it: the subcarrier is on the same wire.',
      },
      {
        key: 'deint',
        id: 0,
        label: 'deinterlace',
        min: 0,
        max: 1,
        step: 1,
        unit: '',
        choices: ['off', 'on'],
        help: 'Rebuilds each frame from a single field, like a bob deinterlacer. Fixes comb teeth on an interlaced source, at half the vertical detail.',
      },
      {
        key: 'capLumaMHz',
        id: 1,
        label: 'capture luma band (0 off)',
        min: 0,
        max: 4.2,
        step: 0.1,
        unit: 'MHz',
        help: 'Luma bandwidth the deck passed to the capture card, so the file arrives already soft. VHS manages about 3 MHz at SP. 0 means no deck.',
      },
      {
        key: 'capChromaMHz',
        id: 2,
        label: 'capture chroma band (0 off)',
        min: 0,
        max: 1.5,
        step: 0.05,
        unit: 'MHz',
        help: 'Chroma bandwidth from the same deck. Colour-under carries about 0.5 MHz against 3 MHz of luma, so colour smears sideways under sharp edges.',
      },
      {
        key: 'capNoiseIre',
        id: 4,
        label: 'capture grain',
        min: 0,
        max: 30,
        step: 0.5,
        unit: 'IRE',
        help: "The noise floor of the deck's luma FM path, as fine grain in every frame of the file. It holds still when the deck pauses.",
      },
      {
        key: 'capChromaNoiseIre',
        id: 5,
        label: 'capture chroma noise',
        min: 0,
        max: 60,
        step: 1,
        unit: 'IRE',
        fine: true,
        help: "Noise on the deck's colour-under carrier, which had far less headroom than luma. The narrow chroma band smears it into slow blotches of wrong hue.",
      },
      {
        key: 'capYcDelayNs',
        id: 3,
        label: 'capture y/c delay',
        min: -500,
        max: 500,
        step: 10,
        unit: 'ns',
        fine: true,
        help: "The deck's chroma arriving late (+) or early (-) against its luma, which displaces colour off its edges. A home deck is out by a few hundred nanoseconds.",
      },
      {
        key: 'vbi',
        id: 69,
        label: 'vbi test signals',
        min: 0,
        max: 1,
        step: 1,
        unit: '',
        choices: ['off', 'on'],
        help: `Vertical blanking interval

          - **lines 17-18**: VITS multiburst and staircase, the transmission-test
          signals.
          - **line 19**: a VIR reference.
          - **line 21**: caption data.

          Roll the picture or shrink v size to see it in the black bar.`,
      },
    ],
  },
  // The two generated no-signal sources are one generator with its statistics
  // exposed, rather than two fixed looks: what separates an untuned tuner from
  // blank tape is where the noise is detected (which decides its distribution,
  // and is the source picker's job) and the bandwidth of the path it arrived
  // through — which is this group. Only bites while a slot is showing TV or VHS
  // static, the same way deinterlace only bites on an interlaced source.
  {
    name: 'Noise source (static)',
    place: 'Source A',
    generator: 'noise',
    sliders: [
      {
        key: 'srcNoiseBwMHz',
        id: 6,
        label: 'noise bandwidth',
        min: 0.2,
        max: 7,
        step: 0.05,
        unit: 'MHz',
        help: "The bandwidth of the path the noise came through, which sets its grain. A tuner's IF stops at 4.2 MHz; a head's aperture is tighter, so blank tape smears into streaks.",
      },
      {
        key: 'srcNoiseLevel',
        id: 8,
        label: 'noise power',
        min: 0,
        max: 2,
        step: 0.01,
        unit: '',
        help: 'How much noise the detector receives. On an untuned channel it scales snow against a black floor; on blank tape it swings around mid grey.',
      },
      {
        key: 'srcNoiseLine',
        id: 7,
        label: 'per-sweep level error',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'A gain error lasting one scan line: the AGC hunting, or head contact varying sweep to sweep. It multiplies, so whole lines flicker, which gives blank tape its striped texture.',
      },
      {
        key: 'srcNoiseHz',
        id: 9,
        label: 'field refresh',
        min: 1,
        max: 60,
        step: 0.5,
        unit: 'Hz',
        help: 'How often the noise field changes. Below 60 the set draws each field several times and the boil goes chunky; non-integer ratios hold them unevenly.',
      },
    ],
  },
  // The other generated source, and the only one in the app that makes a
  // picture rather than a failure to have one. Like the noise group it bites
  // only while a slot is showing it, and it describes whichever slot is —
  // the generator is one bench oscillator pair, patched wherever it is patched.
  {
    name: SYNTH_GROUP,
    place: 'Source A',
    generator: 'synth',
    sliders: [
      {
        key: 'synthAHz',
        id: 10,
        label: 'osc A',
        min: 0,
        max: 8000000,
        step: 1,
        curve: 'synth',
        unit: 'Hz',
        vernier: { span: 200 },
        help: "The first oscillator's frequency, read against the raster. One cycle per frame at 60 Hz is a vertical gradient; at the 15734 Hz line rate it turns sideways, and a multiple paints standing bars. A few hertz off leans and creeps them. At 3579545 Hz it lands on the subcarrier and the encoder returns flat colour.",
      },
      {
        key: 'synthBHz',
        id: 11,
        label: 'osc B',
        min: 0,
        max: 8000000,
        step: 1,
        curve: 'synth',
        unit: 'Hz',
        vernier: { span: 200 },
        help: 'The second oscillator, live once the combiner is off "osc A alone". It beats against the first, so a pair a few hertz apart draws a moire drifting at the gap.',
      },
      {
        key: 'synthShape',
        id: 12,
        label: 'waveform',
        min: 0,
        max: 3,
        step: 1,
        unit: '',
        choices: ['ramp', 'triangle', 'sine', 'pulse'],
        help: 'The waveform for both oscillators. Ramp is a sawtooth, triangle folds it symmetric, sine passes the encoder without ringing, and pulse is a comparator output with the most bandwidth to distort.',
      },
      {
        key: 'synthMix',
        id: 13,
        label: 'combiner',
        min: 0,
        max: 3,
        step: 1,
        unit: '',
        choices: ['osc A', 'sum', 'ring mod', 'comparator'],
        help: "How the two oscillators combine. Sum is a mixing amplifier driven into its rails. Ring mod is a balanced multiply, leaving only their sum and difference. Comparator puts B on a slicer's reference input.",
      },
      {
        key: 'synthLevel',
        id: 14,
        label: 'level',
        min: 0,
        max: 4,
        step: 0.01,
        redline: [0, 2],
        unit: 'x',
        fine: true,
        help: 'Output contrast around mid-video, ahead of the colorizer. Past 1 the waveform runs into its rails and squares off.',
      },
      {
        key: 'synthColor',
        id: 15,
        label: 'colorizer',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'One signal into three guns through three phase shifts 120 degrees apart, which is all a colorizer ever was. At 0 the three agree and the pattern is grey.',
      },
      {
        key: 'synthHueDeg',
        id: 16,
        label: 'colorizer phase',
        min: 0,
        max: 360,
        step: 1,
        unit: 'deg',
        fine: true,
        help: 'Rotates all three phase shifts together, sliding the palette around the wheel while the geometry holds still.',
      },
      {
        key: 'synthColorSoftPx',
        id: 278,
        label: 'colorizer input filter',
        min: 0,
        max: 24,
        step: 0.1,
        redline: [0, 12],
        unit: 'px',
        help: "The lowpass ahead of a colorizer's slicers. A sharp input crosses threshold on every detail and posterizes into confetti; a soft one lays down slabs. The picture itself keeps its detail.",
      },
      {
        key: 'synthColorSrc',
        id: 276,
        label: 'colorizer input',
        min: 0,
        max: 1,
        step: 1,
        choices: ['oscillator', 'picture'],
        unit: '',
        help: 'What the colorizer slices: its own oscillator, or the picture. Pointed at the picture it turns brightness into hue, so colour lands in large fields of equal tone. Needs the synth laid over a picture.',
      },
      {
        key: 'synthColorMode',
        id: 277,
        label: 'colorizer type',
        min: 0,
        max: 1,
        step: 1,
        choices: ['phase shifts', 'comparators'],
        unit: '',
        help: 'How the box turns level into colour. Phase shifts sweeps hue continuously through the wheel. Comparators is the cheap way: three slicers switch each gun fully on or off, so the picture posterizes into the eight corners of the colour cube.',
      },
      {
        key: 'synthOver',
        id: 17,
        label: 'over picture (A)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Lays the synth over slot A's picture instead of replacing it. Source A only, and dead while A already shows the synth.",
      },
      {
        key: 'synthFm',
        id: 18,
        label: 'luma → osc A',
        min: 0,
        max: 200000,
        step: 10,
        redline: [0, 60000],
        unit: 'Hz',
        help: "The picture's brightness into oscillator A's frequency input. The wave runs faster through bright picture, so equal-brightness regions fall into step and the image draws itself as contour lines.",
      },
      {
        key: 'synthFmSrc',
        id: 275,
        label: 'that input, patched to',
        min: 0,
        max: 1,
        step: 1,
        choices: ['the deck', 'the loop'],
        unit: '',
        help: "Which picture the frequency input reads. The deck redraws the contours on the source every frame. The loop reads the camera's return, so the contours trace the last generation's and go round again.",
      },
    ],
  },
  // Input A's own deck, cable and head-end, ahead of the mixer. The same faults
  // as the program-bus Cable/Wiring and Scrambling groups further down the
  // chain, but on this one signal — so when B is patched in, the other input,
  // the sync fight and the receiver all react to the difference instead of
  // sharing the damage.
  //
  // On the Source spine rather than in the A/B section, because none of it
  // needs B: this is the cable into input A, and the pass runs whether or not
  // anything is patched into the other input. Filed under 'ab' it vanished the
  // moment source B was switched off, which left a randomize free to park the
  // house deck on pause with no row anywhere to put it back.
  {
    name: FEED_A_GROUP,
    place: 'Source A',
    sliders: [
      {
        key: 'aPause',
        id: 177,
        label: 'A pause (deck held)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The pause button on input A's deck. The drum re-reads one track so the frame holds, but the capstan servo is defeated: lines scatter sideways, the raster hops, and a mistrack stripe of snow creeps through.",
      },
      {
        key: 'aDropoutRate',
        id: 178,
        label: 'A dropouts',
        min: 0,
        max: 400,
        step: 1,
        redline: [0, 60],
        unit: '/frame',
        help: "Dropout events per frame on input A's tape alone. Shed oxide leaves the head reading nothing and the detector outputs snow, with no compensator to hide the gap.",
      },
      {
        key: 'aDropoutLenUs',
        id: 179,
        label: 'A dropout len',
        min: 1,
        max: 60,
        step: 0.5,
        redline: [1, 25],
        unit: 'us',
        help: "How long each of A's dropouts lasts, in microseconds of the 63.5 µs line.",
      },
      {
        key: 'aScramble',
        id: 169,
        label: 'A sync suppression',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Head-end scrambling on input A alone. A's sync tips are lifted toward blanking before the mix, so the receiver has to choose between A's damaged pulses and B's.",
      },
      {
        key: 'aScrambleMode',
        id: 170,
        label: 'A system',
        min: 0,
        max: 2,
        step: 1,
        unit: '',
        choices: ['gated', 'alternate', 'ssavi'],
        help: "Which scrambling system A's channel uses. Gated suppresses every line, alternate every other line, and SSAVI also inverts the active video.",
      },
    ],
  },
  // The wire out of A's deck and the jack at the far end of it. Everything here
  // happens after the deck, on the output raster — which is what separates it
  // from the group above, where the damage is on the tape and a held deck
  // re-reads it in place.
  {
    name: FEED_A_CABLE_GROUP,
    place: 'Source A',
    sliders: [
      {
        key: 'aConnector',
        id: 175,
        label: 'A loose connector',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "How loose the plug in input A's jack is. Bands of lines lose contact, re-rolled every frame, the way a plug hanging on its cable makes and breaks.",
      },
      {
        key: 'aConnectorMode',
        id: 176,
        label: 'A bad contact',
        min: 0,
        max: 2,
        step: 1,
        unit: '',
        choices: ['pin', 'shield', 'both'],
        help: "Which of A's two contacts is intermittent. The centre pin breaks the signal path, so bad bands collapse to noise and lose A's sync. The shell breaks the ground, so hum lands on them instead. Both is a wiggled plug.",
      },
      {
        key: 'aHumIre',
        id: 174,
        label: 'A ground loop',
        min: -40,
        max: 40,
        step: 0.5,
        redline: [-20, 20],
        unit: 'IRE',
        help: "A ground loop on input A's cable alone, this deck's outlet against the mixer's. It lifts A's sync tips with the picture, so the receiver's hold chases the bar. Negative is the other mains leg.",
      },
      {
        key: 'aNoiseIre',
        id: 172,
        label: 'A noise',
        min: 0,
        max: 150,
        step: 0.1,
        redline: [0, 40],
        unit: 'IRE',
        help: "Snow on A's feed alone, from a long antenna run or a bad patch cable ahead of the mixer.",
      },
      {
        key: 'aTermination',
        id: 171,
        label: 'A termination (-1 daisy, +1 open)',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Termination fault on A's cable alone. Negative is double-terminated, so A arrives dim and shallow. Positive is unterminated, so A runs hot and rings with a reflection echo.",
      },
      {
        key: 'aPolarity',
        id: 173,
        label: 'A polarity (flips sync)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "A signal/ground swap on A's own connector, negating A's waveform and its sync before the mixer. B is untouched, so the receiver may latch onto B instead.",
      },
    ],
  },
  // The loops are named for the physics that closes them, because that is the
  // only thing that tells them apart once more than one is running: light
  // around the outside of the set, the composite bus patched back into itself,
  // or a second deck threaded with a loop of tape. The optical one carries a
  // picture that has already been decoded and lit, so it can only do what a
  // lens can; the electrical one carries the subcarrier round with it, so it
  // does things optics cannot; and the mechanical one re-records what it
  // returns, so what circulates ages a generation a lap.
  {
    name: CAMERA_LOOP_GROUP,
    place: 'camera',
    sliders: [
      {
        key: 'fbMix',
        id: 114,
        label: 'mix',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How much of the camera-pointed-at-the-monitor image returns to the input. The fader and the exposure multiply, so raise both until the product passes unity and the picture builds on its own.',
      },
      {
        key: 'fbZoom',
        id: 115,
        label: 'zoom',
        min: 0.2,
        max: 4,
        step: 0.001,
        curve: 'unity',
        redline: [0.7, 1.6],
        unit: 'x',
        vernier: true,
        help: 'How much bigger or smaller the camera frames the screen each lap. Above 1 detail flows outward into tunnels, below 1 it collapses inward, and the distance from 1 sets the speed.',
      },
      {
        key: 'fbRotateDeg',
        id: 116,
        label: 'rotate',
        min: -180,
        max: 180,
        step: 0.01,
        curve: 'zero',
        redline: [-30, 30],
        unit: 'deg',
        vernier: true,
        help: 'Camera tilt on the loop. Each pass rotates again, so structures spiral out instead of expanding straight, and zoom with rotation gives the classic logarithmic spiral. A hundredth of a degree is visible.',
      },
      {
        key: 'fbShiftX',
        id: 117,
        label: 'shift x',
        min: -1,
        max: 1,
        step: 0.001,
        curve: 'zero',
        redline: [-0.3, 0.3],
        unit: '',
        fine: true,
        vernier: true,
        help: "Camera aim off-centre horizontally, which moves the loop's fixed point: the tunnel mouth or spiral core.",
      },
      {
        key: 'fbShiftY',
        id: 118,
        label: 'shift y',
        min: -1,
        max: 1,
        step: 0.001,
        curve: 'zero',
        redline: [-0.3, 0.3],
        unit: '',
        fine: true,
        vernier: true,
        help: 'Camera aim off-centre vertically.',
      },
      {
        key: 'fbGain',
        id: 119,
        label: 'gain',
        min: 0,
        max: 3,
        step: 0.001,
        curve: 'unity',
        redline: [0.5, 1.5],
        unit: 'x',
        fine: true,
        vernier: true,
        help: 'Camera exposure on the loop. Round-trip gain is this times the mix above, so at a mix of 0.6 patterns persist only past 1.67. A collapsing loop concentrates its gain into a shrinking core and holds well above unity; an expanding one goes to white within a second of crossing.',
      },
      {
        key: 'fbIris',
        id: 120,
        label: 'auto-iris hunt',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Puts the camera's exposure on an auto-iris servo, which is metering the monitor it feeds. The loop brightens, the iris clamps a beat late, the loop starves, the iris reopens. Turned up it never settles, and it beats against the beam limiter in Deflection.",
      },
      {
        key: 'fbFocus',
        id: 121,
        label: 'defocus',
        min: 0,
        max: 12,
        step: 0.05,
        redline: [0, 3],
        unit: 'px',
        fine: true,
        help: 'Lens blur radius on the camera. Smoothing each generation keeps the loop on large structures instead of single-pixel speckle.',
      },
      {
        key: 'fbVign',
        id: 122,
        label: 'vignette',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'Lens falloff toward the corners, so loop gain is high in the middle and low at the edges and feedback dies before it reaches the border.',
      },
      {
        key: 'fbBlack',
        id: 123,
        label: 'black cut',
        min: 0,
        max: 0.2,
        step: 0.005,
        unit: '',
        fine: true,
        help: "The camera sensor's black level. Anything dimmer reads as pure black, so trails cut off instead of lingering.",
      },
      {
        key: 'fbKnee',
        id: 124,
        label: 'cam s-curve',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'Sensor highlight compression. Bright areas roll into a shoulder instead of clipping flat, so a runaway loop makes thick glowing bands.',
      },
    ],
  },
  // The gun and the glass, split out of the camera group because none of it is
  // a camera: it is the tube's own transfer curve and faceplate. It sits on the
  // camera loop rather than under Screen because it is that loop's subject —
  // the light the lens is pointed at — so it is what decides which structures
  // survive a trip around and which die, and tuning the loop means reaching for
  // these in the same breath as the lens. The mixer loop taps ahead of the tube
  // and never sees them, which is exactly why these two stages are two: filed
  // together under one 'Feedback' header, the faceplate read as something all
  // three loops went through.
  {
    name: 'Tube face (what the camera shoots)',
    place: 'camera',
    sliders: [
      {
        key: 'crtCutoff',
        id: 125,
        label: 'beam cutoff',
        min: 0,
        max: 0.95,
        step: 0.01,
        redline: [0, 0.6],
        unit: '',
        help: 'The gun bias point. Drive below this emits no light, which gives the tube a true black and sets the floor a feedback pass has to clear.',
      },
      {
        key: 'crtGamma',
        id: 126,
        label: 'beam gamma',
        min: 0.2,
        max: 6,
        step: 0.05,
        redline: [1, 3],
        unit: '',
        help: 'The gun transfer curve, light out against drive in. High gamma deepens shadows and stretches highlights, and in a loop it narrows the range that survives a pass.',
      },
      {
        key: 'crtSat',
        id: 127,
        label: 'beam saturation',
        min: 0,
        max: 6,
        step: 0.01,
        redline: [0, 2],
        unit: '',
        help: 'Colour saturation of the emitted light, after the beam transfer. Feedback multiplies it every pass.',
      },
      {
        key: 'crtBloom',
        id: 130,
        label: 'screen bloom',
        min: 0,
        max: 6,
        step: 0.01,
        redline: [0, 1.5],
        unit: '',
        help: 'Light spreading out of bright phosphor cores: a tight halo that fattens highlights.',
      },
      {
        key: 'crtHalation',
        id: 131,
        label: 'halation (warm halo)',
        min: 0,
        max: 6,
        step: 0.01,
        redline: [0, 1.5],
        unit: '',
        help: 'Light scattering inside the thick glass faceplate and bouncing back: a wide, warm, low-level halo, broader and softer than bloom.',
      },
      {
        key: 'crtHaloKey',
        id: 133,
        label: 'halation ∝ beam current',
        min: 0,
        max: 4,
        step: 0.01,
        redline: [0, 1],
        unit: '',
        help: 'How much the halo widens with local beam drive. Real glass scatter grows with beam current, so peak white throws light much further into the faceplate than mid grey. At 0 the halo is one fixed width.',
      },
      {
        key: 'crtGlow',
        id: 132,
        label: 'phosphor glow',
        min: 0,
        max: 4,
        step: 0.01,
        redline: [0, 1],
        unit: '',
        help: 'Faceplate haze, the dull sheen a powered tube has even in black. It lifts the black floor, which gives a feedback loop a small standing gain.',
      },
    ],
  },
  {
    name: MIXER_LOOP_GROUP,
    place: 'mixer',
    sliders: [
      {
        key: 'cfbMix',
        id: 141,
        label: 'loop mix',
        min: 0,
        max: 1,
        step: 0.01,
        redline: [0, 0.95],
        vernier: true,
        unit: '',
        help: "The crossfader position toward the loop bus, where the mixer patches the previous frame's composite back in. The subcarrier goes round too, so the loop shifts hue as well as geometry. All the way over the program is out and the loop feeds only on itself, decaying to black unless the gain covers the loss.",
      },
      {
        key: 'cfbGain',
        id: 142,
        label: 'loop gain',
        min: -3,
        max: 3,
        step: 0.01,
        redline: [-1.2, 1.2],
        vernier: true,
        unit: 'x',
        help: 'Proc-amp trim on the loop return. Past ±1 the round trip exceeds unity and the loop builds until it clips. Negative inverts each pass, so polarity alternates frame to frame.',
      },
      {
        key: 'cfbDelayUs',
        id: 143,
        label: 'loop delay',
        min: 0,
        max: 63,
        step: 0.001,
        redline: [0, 8],
        unit: 'us',
        vernier: { span: 0.56 },
        help: 'Delay on the loop return. The subcarrier rides the same waveform, so delay is also a hue rotation: one sample, 70 ns, is a 90° spin.',
      },
      {
        key: 'cfbServoUs',
        id: 153,
        label: 'loop timebase pull',
        min: -60,
        max: 60,
        step: 0.01,
        curve: 'zero',
        redline: [-8, 8],
        unit: 'us',
        help: "The loop's delay trimmer replaced by a varactor hanging off the video bus, so the fed-back waveform tunes its own delay. Bright content and sync tips pull opposite ways, and every 70 ns of pull is another 90° of hue. Structures shear apart by brightness and sync walks into neighbouring lines, and none of it repeats.",
      },
      {
        key: 'cfbLines',
        id: 144,
        label: 'v offset',
        min: -240,
        max: 240,
        step: 1,
        redline: [-20, 20],
        unit: 'lines',
        help: 'Vertical offset applied each trip around the loop, so trails stack into ladders.',
      },
      {
        key: 'cfbKey',
        id: 145,
        label: 'loop key',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Keys the loop return, so only part of the picture feeds back and the loop follows a subject instead of flooding the frame. Positive keeps one side of the slice, negative the other. It slices level until the acceptance angle switches it to hue.',
      },
      {
        key: 'cfbKeyLevel',
        id: 146,
        label: 'key level',
        min: 0,
        max: 100,
        step: 0.5,
        unit: 'IRE',
        fine: true,
        help: 'The brightness the loop key slices at, in IRE (0 blanking, 100 peak white).',
      },
      {
        key: 'cfbKeySoft',
        id: 147,
        label: 'key soft',
        min: 1,
        max: 30,
        step: 0.5,
        unit: 'IRE',
        fine: true,
        help: 'How wide the key transition is, in IRE. Narrow cuts a hard edge.',
      },
      {
        key: 'cfbKeyExt',
        id: 267,
        label: 'key input',
        min: 0,
        max: 1,
        step: 1,
        choices: ['self', 'program'],
        unit: '',
        help: "Which connector the keyer's key input is on. Self is the loop return, so the trail draws its own boundary a generation late. Program is the live picture, so a subject moving through the frame carves its shape out of everything the loop has accumulated.",
      },
      {
        key: 'cfbKeyHueDeg',
        id: 268,
        label: 'key hue',
        min: 0,
        max: 360,
        step: 1,
        unit: 'deg',
        fine: true,
        help: 'Which chroma phase the keyer slices at, once the acceptance angle below switches it from level to hue. 241 is where a green backing lands.',
      },
      {
        key: 'cfbKeyAcceptDeg',
        id: 269,
        label: 'key acceptance',
        min: 0,
        max: 180,
        step: 1,
        unit: 'deg',
        help: "Swaps the loop's luma keyer for a chroma one: a wedge this wide either side of the key hue, and at zero no wedge, back to slicing level. The loop delay is a hue rotation, so a region regenerates until its own return spins out of the wedge and whatever spins in takes over.",
      },
      {
        key: 'cfbHold',
        id: 148,
        label: 'strobe hold',
        min: 0,
        max: 60,
        step: 1,
        unit: 'frames',
        fine: true,
        help: "Freezes the loop's frame store for this many frames before it grabs again, like a frame synchronizer stuttering. Motion strobes, and at large values the picture holds while the live signal mixes over it.",
      },
      {
        key: 'cfbTrail',
        id: 149,
        label: 'trails',
        min: 0,
        max: 1,
        step: 0.01,
        redline: [0, 0.98],
        unit: '',
        help: "Peak-hold decay in the loop's frame store: bright areas are retained and fade instead of being replaced. A frame synchronizer's smear, ahead of the tube's own phosphor.",
      },
      {
        key: 'cfbFilterMHz',
        id: 150,
        label: 'loop resonance freq (0 off)',
        min: 0,
        max: 5,
        step: 0.05,
        unit: 'MHz',
        fine: true,
        help: 'A resonant filter in the loop, centred here, like a bent enhancer patched into the feedback. Around 3.58 MHz it rings on the subcarrier; lower down it turns edges into repeating bars.',
      },
      {
        key: 'cfbFilterQ',
        id: 151,
        label: 'loop resonance Q (broad→ringing)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'How selective that resonance is. Broad tilts the loop tonally; narrow rings for a long time after every edge and lays a fixed-frequency pattern across the line.',
      },
      {
        key: 'cfbFilterBoost',
        id: 152,
        label: 'loop resonance boost',
        min: 0,
        max: 16,
        step: 0.05,
        redline: [0, 4],
        unit: 'x',
        fine: true,
        help: 'In-band gain added by the resonance. Push the round trip past unity at that frequency and the loop self-oscillates, generating its own pattern.',
      },
      {
        key: 'cfbRing',
        id: 154,
        label: 'loop ring mod',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The loop bus multiplied instead of summed: a ring modulator with one input patched to the machine's own past. Every product goes round again and is re-multiplied a frame later, so the spectrum folds over itself.",
      },
      {
        key: 'cfbClockPct',
        id: 273,
        label: 'read clock error',
        min: -2,
        max: 2,
        step: 0.001,
        curve: 'zero',
        redline: [-0.3, 0.3],
        vernier: true,
        unit: '%',
        help: "The loop's frame store read out at a clock this far off the one it was written at. The readout re-triggers on each line's sync, so the error restarts every line and the picture stretches sideways from the line start. The subcarrier is in those samples, so hue turns further from the line start — eighty degrees by the right edge at a thousandth off — and each lap re-clocks what the last wrote.",
      },
      {
        key: 'cfbNoiseIre',
        id: 292,
        label: 'loop noise',
        min: 0,
        max: 10,
        step: 0.01,
        vernier: { span: 0.5, step: 0.0005 },
        unit: 'IRE',
        help: "The loop amplifier's own noise floor, added to the return every lap, so each generation carries every earlier one's noise scaled by the loop gain. Below unity it settles into a steady grain; near unity a fraction of an IRE seeds structure for the resonance, ring modulator and keyer to amplify.",
      },
      {
        key: 'cfbGenlock',
        id: 279,
        label: 'frame sync on the return',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Whether the return comes back through a frame synchronizer or down a bare cable. A store genlocked to house reference writes its own sync and burst on the way out, so only the picture circulates and the loop can be driven hard without losing lock. On the cable the loop's sync tip goes round one delay late and lands inside a line, so the separator loses its edge and the flywheel free-runs.",
      },
      {
        key: 'cfbReturn',
        id: 272,
        label: 'return (Y/C split)',
        min: 0,
        max: 2,
        step: 1,
        choices: ['composite', 'chroma', 'luma'],
        unit: '',
        help: "A Y/C separator on the loop return and a recombiner after it, so one wire comes round the loop and the other from the live picture. Composite sends the whole waveform round. Chroma sends the loop's colour over live brightness, so hue accumulates while the picture under it stays sharp. Luma sends brightness and the sync tip round under live colour, so trails stack in grey and still pull at where each line starts.",
      },
      {
        key: 'cfbRingSrc',
        id: 270,
        label: 'ring carrier',
        min: 0,
        max: 1,
        step: 1,
        choices: ['program', 'oscillator'],
        unit: '',
        help: "Which connector the ring modulator's other input is on. Program is the live picture, so both sides carry the same crystal and chroma against chroma lands at DC and 7.16 MHz, outside the chroma band, as brightness structure. Oscillator patches the box's own subcarrier generator there, making the bridge a chroma modulator: the return's brightness is translated onto 3.58 MHz and read as colour, its colour down to brightness, and each lap swaps the two.",
      },
      {
        key: 'cfbCarrierKHz',
        id: 271,
        label: 'ring carrier detune',
        min: -200,
        max: 200,
        step: 0.01,
        curve: 'zero',
        redline: [-40, 40],
        unit: 'kHz',
        help: 'How far that oscillator sits off the house 3.579545 MHz. At zero it agrees with the encoder, so brightness comes back as a single hue. Detuned, the phase it writes ramps through the frame, so the manufactured colour turns along every line, faster the further off it is, and nothing pulls it back.',
      },
    ],
  },
  {
    name: 'A/B Mixer',
    place: 'Mix',
    sliders: [
      {
        key: 'bGenlock',
        id: 200,
        label: 'genlock',
        min: 0,
        max: 1,
        step: 1,
        unit: '',
        choices: ['dirty sum', 'clean dissolve'],
        help: "Whether source B is genlocked to house reference. Off, B free-runs and is summed into the composite — a wiring fault — so its detune, roll and skew produce fighting sync and chroma beats. On, B is re-encoded on A's carrier and raster and the combine is a clean switcher dissolve, with B gain as the fader and nothing for the detune controls to do.",
      },
      {
        key: 'aGain',
        id: 190,
        label: 'A gain',
        min: -3,
        max: 3,
        step: 0.01,
        redline: [-1.2, 1.2],
        unit: 'x',
        // Not a trim: it is one of the two faders this stage exists to be, and
        // the disclosure it was folded into is gone with B's proc-amp trio.
        help: "A's level on the summing bus, on the dirty sum only: the clean dissolve sets A to (1 − B gain), leaving B gain as the only fader. 1 is full program, down fades A out under B, and negative inverts A into a difference key that cancels against B.",
      },
      {
        key: 'bGain',
        id: 191,
        label: 'B gain',
        min: -3,
        max: 3,
        step: 0.01,
        redline: [-1.2, 1.2],
        unit: 'x',
        help: "How much of source B reaches the composite line. With genlock off it is the level B is summed in at, and negative inverts B's whole signal, sync tips included. With genlock on it is the crossfade fader: 0 full A, 1 full B, and below 0 a closed fader.",
      },
      {
        key: 'bRing',
        id: 192,
        label: 'ring mod',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Multiplies the two composite signals instead of adding them. Two subcarriers multiplied land at their sum and difference, so colour arrives that neither source carries.',
      },
      {
        key: 'busClip',
        id: 274,
        label: 'bus overload',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How little headroom the summing amplifier has. At 0 the sum is pure arithmetic. Open it and the stage runs out of volts: gain falls away toward the rail, and falling gain multiplies the two signals sharing the bus, so a detuned B beats against A and lands products inside the chroma band. Sync tips squash with everything else, so a deeper tip wins the sync contest by less.',
      },
      {
        key: 'bLineHz',
        id: 193,
        label: 'line offset',
        min: -60,
        max: 60,
        step: 0.01,
        curve: 'zero',
        redline: [-8, 8],
        unit: 'Hz',
        help: "How far B's line rate sits from A's. The two horizontal oscillators are unlocked, so B skews a little more on each line and slides sideways. At zero it stops where it drifted to.",
      },
      {
        key: 'bDetuneHz',
        id: 194,
        label: 'sc detune',
        min: -3000,
        max: 3000,
        step: 0.01,
        curve: 'zero',
        redline: [-400, 400],
        unit: 'Hz',
        help: "How far B's colour subcarrier sits from A's 3.579545 MHz. The decoder locks to A's burst, so B's hue cycles continuously: the rainbow crawl of a non-genlocked source.",
      },
      {
        key: 'bRollLps',
        id: 195,
        label: 'frame roll',
        min: -30,
        max: 30,
        step: 0.01,
        curve: 'zero',
        redline: [-3, 3],
        unit: 'l/f',
        help: "B's vertical drift in lines per frame, from its field rate not matching A's.",
      },
    ],
  },
  // What B *is*, as against what the mixer does with it — the mirror of Signal
  // (source A) at the head of the trunk, and the reason the two inputs finally
  // read as one kind of thing. These three rode in the mixer group because the
  // mixer group was the only place B had, which left the panel saying that A's
  // polarity is a property of the signal and B's is a property of the mix. They
  // are the same proc-amp on the same bench.
  //
  // None of them are `fine` any more either: they were folded away to keep a
  // ten-row mixer scannable, and a three-row group has nothing to hide behind a
  // disclosure.
  {
    name: 'Signal (source B)',
    place: 'b',
    sliders: [
      {
        key: 'bHueDeg',
        id: 196,
        label: 'B hue',
        min: -180,
        max: 180,
        step: 1,
        unit: 'deg',
        help: 'Proc-amp hue trim on B before the mix: a static phase offset on its subcarrier, which holds where you set it.',
      },
      {
        key: 'bVidGain',
        id: 197,
        label: 'B video gain',
        min: 0,
        max: 6,
        step: 0.01,
        redline: [0, 2],
        unit: 'x',
        help: 'Proc-amp video gain on B: contrast of the B picture before mixing, without changing how much of B is patched in.',
      },
      {
        key: 'bInv',
        id: 198,
        label: 'B invert',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Inverts B's picture. Mixed against A it reads as a difference key: where the two agree they cancel toward grey.",
      },
      {
        key: 'deintB',
        id: 266,
        label: 'B deinterlace',
        min: 0,
        max: 1,
        step: 1,
        unit: '',
        choices: ['off', 'on'],
        help: "The bob deinterlacer from source A, on B's own picture. Combing is a property of the source, so a progressive camera in A and an interlaced dongle in B need opposite settings.",
      },
    ],
  },
  // B's own deck and cable, ahead of the mix — the mirror of the Feed A pair
  // over on the Source A stage, listing the same faults in the same order so
  // the two channels read alike and a difference between them is visible as a
  // difference. Only B's pair is contextual: A's feed is A's cable whether or
  // not anything is patched into B.
  {
    name: FEED_B_GROUP,
    place: 'b',
    sliders: [
      {
        key: 'bPause',
        id: 199,
        label: 'B pause (deck held)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The pause button on the B deck, at how badly the deck copes. The drum re-reads one track so the frame holds, but the capstan servo is defeated: B's timebase scatters line to line, a mistrack stripe of snow creeps down the frame, and B's hue flickers at frame rate. Genlock implies a time-base corrector, so on the clean path this just freezes the frame.",
      },
      {
        key: 'bDropoutRate',
        id: 188,
        label: 'B dropouts',
        min: 0,
        max: 400,
        step: 1,
        redline: [0, 60],
        unit: '/frame',
        help: "Dropout events per frame on B's own tape. The streaks land on B's raster, so they slip and roll with B's picture.",
      },
      {
        key: 'bDropoutLenUs',
        id: 189,
        label: 'B dropout len',
        min: 1,
        max: 60,
        step: 0.5,
        redline: [1, 25],
        unit: 'us',
        help: "How long each of B's dropouts lasts, in microseconds of the 63.5 µs line.",
      },
      {
        key: 'bScramble',
        id: 180,
        label: 'B sync suppression',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Head-end scrambling on input B alone. B's sync tips are lifted toward blanking before it is summed in, so B stops contributing to the sync contest while its picture still beats through the mix.",
      },
      {
        key: 'bScrambleMode',
        id: 181,
        label: 'B system',
        min: 0,
        max: 2,
        step: 1,
        unit: '',
        choices: ['gated', 'alternate', 'ssavi'],
        help: "Which scrambling system B's channel uses. Gated suppresses every line, alternate every other line, and SSAVI also inverts B's active video.",
      },
    ],
  },
  {
    name: FEED_B_CABLE_GROUP,
    place: 'b',
    sliders: [
      {
        key: 'bConnector',
        id: 186,
        label: 'B loose connector',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "How loose the plug in input B's jack is. Bands of lines lose contact, re-rolled every frame. B is the input the receiver is not locked to, so a break decides whether B's bands stop contributing picture or sync.",
      },
      {
        key: 'bConnectorMode',
        id: 187,
        label: 'B bad contact',
        min: 0,
        max: 2,
        step: 1,
        unit: '',
        choices: ['pin', 'shield', 'both'],
        help: "Which of B's two contacts is intermittent. The centre pin breaks the signal path, so bad bands of B collapse to noise and B stops pushing sync there. The shell breaks the ground instead, so hum lands on those bands and B arrives on a shifting pedestal. Both is a wiggled plug.",
      },
      {
        key: 'bHumIre',
        id: 185,
        label: 'B ground loop',
        min: -40,
        max: 40,
        step: 0.5,
        redline: [-20, 20],
        unit: 'IRE',
        help: "A ground loop on input B's cable alone, B's deck and the mixer on different outlets. The bar rides B's own raster, so it slips and rolls with B's picture, and it lifts B's sync tips, so how hard B fights for the line start varies at 60 Hz. Negative is the other mains leg.",
      },
      {
        key: 'bNoiseIre',
        id: 183,
        label: 'B noise',
        min: 0,
        max: 150,
        step: 0.1,
        redline: [0, 40],
        unit: 'IRE',
        help: "Snow on B's feed only. It rides B's own raster, so it tears and rolls with B's picture.",
      },
      {
        key: 'bTermination',
        id: 182,
        label: 'B termination (-1 daisy, +1 open)',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Termination fault on B's cable alone. Negative halves B into a dim ghost under A. Positive runs B hot and ringing, so its sync and burst push harder against a clean A.",
      },
      {
        key: 'bPolarity',
        id: 184,
        label: 'B polarity (flips sync)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "A signal/ground swap on B's own connector, negating B's waveform and sync before the summing bus. Level and polarity stay independent, so this holds whatever B gain reads.",
      },
    ],
  },
  {
    // The other end of the caption's own words, and the reason it takes no text
    // of its own: an open caption and a closed one were the same sentence down
    // two paths. This box keys it into the picture at the plant, so it is
    // torn, smeared and rainbowed by everything downstream and never
    // misspelled; line 21 carries it as data, so it is spelled wrong and never
    // moves. Running both is what makes the difference legible.
    //
    // It stands in the Mix stage because that is where the box stood — after the
    // switcher, ahead of the loop and the tape, so what it keys in ages with the
    // picture instead of being laid over a finished frame.
    name: 'Character generator (chyron)',
    place: 'Mix',
    sliders: [
      {
        key: 'cgMix',
        id: 251,
        label: 'cg over program',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: `A character generator at the switcher, keying caption text into the
          picture: the box every lower third and station ident came out of.

          A CG puts out **two wires**: a fill, which is video, and a key, which
          is a matte cut at the characters' own edges. Everything below changes
          the relationship between them.

          It keys onto the composite bus ahead of the loops and the deck, so the
          tape ages the type along with the picture.`,
      },
      {
        key: 'cgKeyDelayNs',
        id: 255,
        label: 'key timing',
        min: -600,
        max: 600,
        step: 10,
        unit: 'ns',
        help: 'The trim every keyer has, because the key path and the video path are different lengths of circuit. Mis-set on a glyph it puts background through one side of every stem and a hard shadow down the other; far enough out it leaves an outline with no letter in it. One sample is 70 ns.',
      },
      {
        key: 'cgClip',
        id: 256,
        label: 'key clip',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Where the slicer cuts the processed key. On type it is stroke weight: down, thin strokes fuse; up, stems drop out of the middle of words. Its range depends on the key bandwidth below.',
      },
      {
        key: 'cgKeyMHz',
        id: 257,
        label: 'key bandwidth',
        min: 0.3,
        max: 8,
        step: 0.1,
        unit: 'MHz',
        help: 'The key-processing amplifier ahead of the slicer, narrower than the video path, which is the only reason a key has a soft edge. Horizontal only: this is a line of signal, so there is no vertical neighbour on the wire.',
      },
      {
        key: 'cgInvert',
        id: 261,
        label: 'key invert',
        min: 0,
        max: 1,
        step: 1,
        unit: '',
        choices: ['normal', 'inverted'],
        help: 'Which side of the key is cut. Inverted, the box fills the raster and the letters are holes in it.',
      },
      {
        key: 'cgEdgeX',
        id: 258,
        label: 'edge offset x',
        min: -24,
        max: 24,
        step: 1,
        unit: 'smp',
        fine: true,
        help: 'A CG drew its border and drop shadow by delaying the key a sample and a line and OR-ing it back under the fill. This is that delay; far past the sample it was meant to be, the shadow detaches from the type.',
      },
      {
        key: 'cgEdgeY',
        id: 259,
        label: 'edge offset y',
        min: -24,
        max: 24,
        step: 1,
        unit: 'ln',
        fine: true,
        help: 'The other half of the drop shadow, in lines.',
      },
      {
        key: 'cgFill',
        id: 260,
        label: 'fill level',
        min: 0,
        max: 120,
        step: 1,
        unit: 'IRE',
        fine: true,
        help: 'How bright the characters are laid in, in IRE on the composite. 100 is peak white; past that the box overmodulates, and the receiver AGC, the tape and the sound detector all react to it.',
      },
      {
        key: 'cgX',
        id: 252,
        label: 'cg x',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: "The block's left edge across the picture.",
      },
      {
        key: 'cgY',
        id: 253,
        label: 'cg y',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: "The block's top edge down the picture. The stock value is a lower third, clear of the caption decoder's block.",
      },
      {
        key: 'cgScale',
        id: 254,
        label: 'cg size',
        min: 1,
        max: 6,
        step: 0.25,
        unit: '',
        fine: true,
        help: 'Picture samples per font dot. The glyphs are dots on a grid, so the type stays as blocky as the ROM made it.',
      },
      {
        key: 'cgRomAddr',
        id: 262,
        label: 'cg rom address line',
        min: 0,
        max: 11,
        step: 1,
        unit: '',
        fine: true,
        help: "A pin held high on this box's font ROM. Low lines carry the row inside the cell, so every glyph grows a seam; high lines carry the character code, so the whole font is substituted.",
      },
      {
        key: 'cgRomData',
        id: 263,
        label: 'cg rom data line',
        min: -8,
        max: 8,
        step: 1,
        unit: '',
        fine: true,
        help: 'The data bus of the same chip: eight dots across one row, so holding one stripes a column down every character. Positive holds it high, negative low.',
      },
      {
        key: 'cgRomCross',
        id: 284,
        label: 'cg rom crossed lines',
        min: 0,
        max: 10,
        step: 1,
        unit: '',
        fine: true,
        help: "Two adjacent address lines of this box's font ROM transposed. Low in the bus it shuffles the scan lines inside every cell; high in the bus it permutes the font in blocks.",
      },
      {
        key: 'cgRomSlip',
        id: 290,
        label: 'cg rom counter slip',
        min: -4,
        max: 4,
        step: 0.05,
        unit: '/frame',
        fine: true,
        help: "The vertical reset failing on this box's character-address counter, so the whole page is out by the same count and further out every frame. Twelve counts is one whole character.",
      },
      {
        key: 'cgRomLineSlip',
        id: 294,
        label: 'cg rom slip per line',
        min: -0.25,
        max: 0.25,
        step: 0.001,
        unit: '/line',
        fine: true,
        help: 'The horizontal reset failing on the same counter. The count grows on every scan line and the vertical reset still clears it, so the damage runs down the lower third and each row comes off a different part of the font.',
      },
      {
        key: 'cgRomStride',
        id: 285,
        label: 'cg rom cell strap',
        min: -11,
        max: 12,
        step: 1,
        unit: 'rows',
        fine: true,
        help: "The cell-height jumper in the wrong hole. A glyph's first row is at its code times the cell height, and the raster keeps stepping 12 rows whatever the strap says, so each scan line comes off a different character and the text shears into a diagonal slice of the font.",
      },
      {
        key: 'cgRomRot',
        id: 286,
        label: 'cg rom bit rot',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: "Charge leaked off this box's array. Decayed cells read back as the erased state: positive erases to a lit dot and the letters thicken, negative to a dark one and they crumble. The pattern is in the die, so a letter is damaged identically everywhere it appears.",
      },
      {
        key: 'cgPageAddr',
        id: 287,
        label: 'cg page address line',
        min: 0,
        max: 7,
        step: 1,
        unit: '',
        fine: true,
        help: "A line held on the counter that walks this box's page memory instead of its font. Low lines are the column, high lines the row, so characters keep their shapes and lose their places.",
      },
      {
        key: 'cgPageSlip',
        id: 291,
        label: 'cg page counter slip',
        min: -4,
        max: 4,
        step: 0.05,
        unit: '/frame',
        fine: true,
        help: 'The same slip on the page-memory counter, so the block walks diagonally through itself a cell at a time.',
      },
    ],
  },
  {
    name: 'Wipe (A/B)',
    place: 'Mix',
    sliders: [
      {
        key: 'wipeMode',
        id: 201,
        label: 'pattern',
        min: 0,
        max: 4,
        step: 1,
        unit: '',
        choices: ['off', 'h', 'v', 'box', 'diamond'],
        help: "Which switcher wipe pattern decides where B shows. It shapes the picture only — on the dirty path B's sync and burst keep summing across the whole raster.",
      },
      {
        key: 'wipePos',
        id: 202,
        label: 'position',
        min: 0,
        max: 1,
        step: 0.001,
        unit: '',
        help: 'The wipe lever: where the A/B boundary sits, 0 full A to 1 full B.',
      },
      {
        key: 'wipeSoft',
        id: 203,
        label: 'softness',
        min: 0,
        max: 0.5,
        step: 0.005,
        unit: '',
        help: 'Width of the blended border along the wipe edge. 0 is a hard switcher cut.',
      },
      {
        key: 'wipeRate',
        id: 204,
        label: 'sweep',
        min: 0,
        max: 2,
        step: 0.01,
        unit: 'Hz',
        help: 'Drives the wipe lever back and forth at this rate. Locks to MIDI clock with the ♩ icon.',
      },
    ],
  },
  {
    name: 'PiP inset (source B)',
    place: 'Mix',
    sliders: [
      {
        key: 'pipMix',
        id: 205,
        label: 'inset key',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Squeezes source B into a positionable window over the program, like a switcher DVE. The inset is re-encoded genlocked to the house raster, so it dot-crawls like real video and holds still.',
      },
      {
        key: 'pipX',
        id: 206,
        label: 'center x',
        min: 0,
        max: 1,
        step: 0.005,
        unit: '',
        help: 'Horizontal centre of the inset window across the active picture.',
      },
      {
        key: 'pipY',
        id: 207,
        label: 'center y',
        min: 0,
        max: 1,
        step: 0.005,
        unit: '',
        help: 'Vertical centre of the inset window down the active picture.',
      },
      {
        key: 'pipW',
        id: 208,
        label: 'width',
        min: 0.1,
        max: 1,
        step: 0.005,
        unit: '',
        help: 'Width of the inset window, as a fraction of the active picture.',
      },
      {
        key: 'pipH',
        id: 209,
        label: 'height',
        min: 0.1,
        max: 1,
        step: 0.005,
        unit: '',
        help: 'Height of the inset window, as a fraction of the active picture.',
      },
      {
        key: 'pipBorder',
        id: 210,
        label: 'border',
        min: 0,
        max: 0.03,
        step: 0.001,
        unit: '',
        fine: true,
        help: 'Thickness of the matte border a switcher draws around a squeezed source.',
      },
      {
        key: 'pipSoft',
        id: 211,
        label: 'edge soft',
        min: 0,
        max: 0.05,
        step: 0.001,
        unit: '',
        fine: true,
        help: 'Softness of the inset window edge.',
      },
      {
        key: 'pipKey',
        id: 212,
        label: 'luma key (- inverts)',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Keys the inset against its own brightness, so a subject drops in without its rectangle. Positive keeps the bright parts of B, negative the dark.',
      },
      {
        key: 'pipKeyLevel',
        id: 213,
        label: 'key level',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'The brightness the inset key slices at, 0 black to 1 white.',
      },
      {
        key: 'pipKeySoft',
        id: 214,
        label: 'key soft',
        min: 0.01,
        max: 0.4,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'Width of the inset key transition. Narrow cuts a hard matte.',
      },
    ],
  },
  // The keyer is a box across the mixer, so it goes on the Mix stage beside the
  // wipe and the fader rather than on B's branch: it is a thing the mixer does
  // with two signals, not a property of one of them. It also composes with both
  // — a wipe shapes where the key is allowed to act, and the fader still sets
  // how much of what survives the key reaches the bus.
  {
    name: 'Chroma key (A through B)',
    place: 'Mix',
    sliders: [
      {
        key: 'bKey',
        id: 215,
        label: 'key (- inverts)',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: "A chroma keyer across the mixer with B as the foreground: B's backing colour is cut away so A shows through. Negative inverts which side survives. It slices the chroma the encoder made, so the matte comes out soft across and sharp down, the lopsided edge every composite key had.",
      },
      {
        key: 'bKeyHueDeg',
        id: 216,
        label: 'backing hue',
        min: 0,
        max: 360,
        step: 1,
        unit: 'deg',
        help: 'Which chroma phase counts as the backing. 241 is where a pure green screen lands, 347 a blue one. These are angles on the wheel the subcarrier carries, so anything sharing a hue with the backing disappears too.',
      },
      {
        key: 'bKeyAcceptDeg',
        id: 217,
        label: 'acceptance',
        min: 0,
        max: 180,
        step: 1,
        unit: 'deg',
        help: 'How wide a wedge of hue either side of the backing counts as backing. Narrow leaves every shadow and fold on the backing opaque; wide starts eating skin on a warm-lit subject. Past about 90 it keys half the wheel.',
      },
      {
        key: 'bKeyClip',
        id: 218,
        label: 'clip',
        min: 0,
        max: 0.3,
        step: 0.005,
        unit: '',
        fine: true,
        help: 'The saturation a sample must reach before the keyer acts on its hue. A demodulator given an unsaturated sample reports an arbitrary phase, so without this greys key out at random.',
      },
      {
        key: 'bKeySoft',
        id: 219,
        label: 'gain (edge)',
        min: 0,
        max: 0.4,
        step: 0.005,
        unit: '',
        help: 'How fast the keyer swings between keep and cut, in hue and saturation at once: the gain knob on the front of the box. At 0 the comparator snaps and the composite edge shows as steps; open it and the subject feathers, taking backing colour with it unless spill is up.',
      },
      {
        key: 'bKeySpill',
        id: 220,
        label: 'spill kill',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Cancels the backing colour reflecting off the subject. Luma and chroma are the same wire, so the box does what the hardware did and reinjects the backing's own subcarrier in antiphase. It nulls fully on the genlocked path, where B's carrier phase is known; on the dirty path B's carrier drifts, so the cancellation runs late and leaves a residue.",
      },
      {
        key: 'bKeyDelayUs',
        id: 221,
        label: 'key delay',
        min: -1.5,
        max: 1.5,
        step: 0.01,
        unit: 'us',
        fine: true,
        help: 'The registration trim, because the key path and the video path are different lengths of circuit. Off zero the matte lies beside the subject: one edge keeps a rim of backing colour and the other removes a rim of subject.',
      },
      {
        key: 'bKeyFill',
        id: 222,
        label: 'fill',
        min: 0,
        max: 2,
        step: 1,
        unit: '',
        choices: ['program A', 'matte', 'loop bus'],
        help: "What shows through the hole the key cut, the connector on the back of a real keyer. Program A is the other input. Matte is the box's own generator, a flat colour encoded on the house carrier, so it dot-crawls like any other colour. Loop bus patches the mixer's last frame in, so feedback regenerates only inside the keyed shape. Genlocked path only.",
      },
      {
        key: 'bKeyMatteY',
        id: 223,
        label: 'matte level',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'How bright the matte generator sits. This is the luma of a real encoded line, so peak white with saturation up puts the sum past 100 IRE and the AGC, the tape and the beam limiter all react.',
      },
      {
        key: 'bKeyMatteHueDeg',
        id: 224,
        label: 'matte hue',
        min: 0,
        max: 360,
        step: 1,
        unit: 'deg',
        fine: true,
        help: 'The matte colour, as a phase on the subcarrier, off the same wheel as the backing hue above. Set near the backing hue it lands inside the acceptance wedge, so a loop keys its own fill away again next generation.',
      },
      {
        key: 'bKeyMatteSat',
        id: 225,
        label: 'matte saturation',
        min: 0,
        max: 0.6,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'How much chroma the matte generator puts on the carrier. At 0 there is no subcarrier at all, which is the correct way to get a black or white fill.',
      },
    ],
  },
  {
    // The Tape stage used to be one 22-control group called 'Tape / Channel'
    // plus a spray of two- and four-row ones, which is the worst of both: the
    // big group opened onto thirteen visible rows covering the recording, the
    // noise floor, mains interference, ghosting, hum, the sound carrier and
    // dropouts, while five of its neighbours cost a header each to reveal less
    // than a header's worth. Split here into four groups whose names say what is
    // in them, and merged below into two where the neighbours were too small to
    // be worth finding. Same nine headers on the stage, but nothing over nine
    // rows and nothing under four.
    //
    // This first one is what the recording itself did to the signal: the
    // bandwidth it passed, the sharpener that faked it back, the amplifier's two
    // brightness-dependent errors, and the FM fold.
    name: 'Recording (luma & FM)',
    place: 'Channel',
    sliders: [
      {
        key: 'lumaMHz',
        id: 59,
        label: 'luma bandwidth',
        min: 0.3,
        max: 6,
        step: 0.05,
        redline: [1.2, 6],
        unit: 'MHz',
        help: 'How much brightness detail the recording or channel passes. Broadcast is about 4.2 MHz, VHS roughly 3, EP less. Vertical edges smear while the picture stays sharp top to bottom.',
      },
      {
        key: 'lumaPeak',
        id: 77,
        label: 'peaking',
        min: 0,
        max: 12,
        step: 0.05,
        redline: [0, 3],
        unit: '',
        help: 'The sharpness boost VCRs and TVs apply to fake back the detail the bandwidth limit removed. It overshoots every edge, laying a bright ringing outline against a dark one.',
      },
      {
        key: 'diffGain',
        id: 106,
        label: 'differential gain',
        min: -0.5,
        max: 1,
        step: 0.01,
        unit: '',
        // Both differential errors are trims on the amplifier the three rows
        // above set up, and neither is a look on its own — no preset in the
        // table reaches for either.
        fine: true,
        help: "The video amplifier's gain is not flat against the brightness it is amplifying, so a subcarrier riding bright picture comes through smaller than the same colour on dark picture. Saturation drains out of the highlights. Spec sheets list it as DG%. Negative is the opposite misdesign, colour swelling in the brights.",
      },
      {
        key: 'diffPhaseDeg',
        id: 107,
        label: 'differential phase',
        min: -60,
        max: 60,
        step: 0.5,
        unit: 'deg',
        fine: true,
        help: "The same amplifier's delay moves with brightness, and a delay at 3.58 MHz is a phase shift, so hue swings with the luma underneath it: a face turns one way in the light and the other in the shadow. The burst sits at blanking level where the shift is zero, so the decoder's reference never moves.",
      },
      {
        key: 'fmOverdev',
        id: 108,
        label: 'FM over-deviation',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "A VHS deck records brightness as pre-emphasized FM, and a white-clip circuit is supposed to stop bright edges overshooting the deviation the tape can carry. Set too hot, the overshoot runs past the response cliff and the discriminator folds back: more frequency out as less video. Every sharp dark-to-bright edge trails a black streak that boils, because the fold sits on a threshold the demod's noise keeps re-deciding. Colour-under passes through untouched, carrying saturated colour over black.",
      },
      {
        key: 'fmStreakUs',
        id: 109,
        label: 'inversion streak',
        min: 0.1,
        max: 0.7,
        step: 0.01,
        unit: 'us',
        fine: true,
        help: 'How long the demodulator takes to recover from a fold: the deemphasis time constant, which smears the inversion rightward. Short is a hairline shadow on every hard edge.',
      },
    ],
  },
  {
    // Everything arriving on top of the picture rather than through it: the
    // broadband noise floor, and the impulsive interference that comes in bursts
    // — arcing contacts, ignition, lightning, a dimmer chopping the mains.
    name: 'Noise & interference',
    place: 'Channel',
    sliders: [
      {
        key: 'noiseIre',
        id: 78,
        label: 'noise',
        min: 0,
        max: 150,
        step: 0.1,
        redline: [0, 40],
        unit: 'IRE',
        help: 'Additive noise on the waveform, in IRE: tape grain and RF snow. It lands on the whole signal, so enough of it disturbs sync and confuses the colour burst.',
      },
      {
        key: 'noiseTilt',
        id: 79,
        label: 'noise spectrum (RF ↔ FM)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: "Where the noise floor comes from, which decides its colour. At 0 it is the RF path: noise through the tuner's IF, flat across the video band. At 1 it is the deck's FM demodulator, where recovering frequency from phase differentiates the noise, so the floor rises toward the top of the band — into the chroma bandpass near 3.58 MHz, where it decodes as crawling coloured speckle. The level stays put, so only the character changes.",
      },
      {
        key: 'impulseRate',
        id: 80,
        label: 'impulse noise (arcs)',
        min: 0,
        max: 24,
        step: 0.1,
        redline: [0, 8],
        unit: '/frame',
        help: 'Impulse interference: ignition, an arcing thermostat, a dying flyback next door. Each event is a run of signal time at carrier-scale amplitude, and its duration sets its shape: tens of microseconds is a ringing streak the decoder colours, hundreds a stepped diagonal across a few lines, milliseconds a torn slab of hash. The long ones land on sync tips and the beam-load measurement, so the whole rig reacts to every hit.',
      },
      {
        key: 'impulseHz',
        id: 82,
        label: 'ignition train',
        min: 0,
        max: 2000,
        step: 5,
        unit: 'Hz',
        help: 'A periodic impulse source, such as spark plugs or a commutator motor, firing at this rate. Periodic hits against the 15.734 kHz line rate land a fixed step sideways from the last, so the dashes line up in drifting diagonal lattices. The rate wanders like an engine revving, which shears the lattice live.',
      },
      {
        key: 'strikeRate',
        id: 84,
        label: 'big strikes',
        min: 0,
        max: 20,
        step: 0.05,
        redline: [0, 3],
        unit: '/s',
        help: 'Millisecond-scale events: lightning, an arcing breaker, a compressor starting. Dozens of full lines of dense hash with a DC lift, decaying down the raster. A strike spans whole lines, so it lands on sync tips and the beam-load measurement: the PLL tears, HV sag lurches the geometry, and the limiter dims and blooms back.',
      },
      {
        key: 'impulseIre',
        id: 81,
        label: 'impulse strength',
        min: 20,
        max: 400,
        step: 1,
        redline: [20, 140],
        unit: 'IRE',
        fine: true,
        help: 'Peak amplitude of each impulse. Real impulses saturate the front end, so the range is large; past 100 IRE every hit drags the AGC.',
      },
      {
        key: 'impulseMains',
        id: 83,
        label: 'dimmer lock',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'A triac dimmer fires twice per mains cycle at its set angle, so the random hits concentrate into two bands of hash that roll with the hum bar. They share the same mains, so they move together.',
      },
    ],
  },
  {
    // Coherent things leaking onto the signal, as against the noise above: a
    // reflection of the picture itself, the mains, and the sound carrier beating
    // against the vision one. All three put structure on the picture that came
    // from somewhere else in the same building.
    name: 'Ghosting & leakage',
    place: 'Channel',
    sliders: [
      {
        key: 'ghostDelayUs',
        id: 92,
        label: 'ghost delay',
        min: 0,
        max: 50,
        step: 0.05,
        redline: [0, 12],
        unit: 'us',
        vernier: { span: 0.56, step: 0.001 },
        help: "Multipath: a reflected copy of the broadcast arriving this many microseconds late, as an echo to the right. The reflection carries its own subcarrier, so every 70 ns of delay turns the ghost's hue 90° against the picture it lands on.",
      },
      {
        key: 'ghostGain',
        id: 93,
        label: 'ghost gain',
        min: -2,
        max: 2,
        step: 0.01,
        redline: [-0.6, 0.6],
        unit: '',
        help: 'Strength of that reflection. Negative means it arrives phase-inverted, so the echo is a dark outline instead of a bright one.',
      },
      {
        key: 'humAmp',
        id: 94,
        label: 'hum',
        min: 0,
        max: 120,
        step: 0.1,
        redline: [0, 30],
        unit: 'IRE',
        help: 'Mains hum riding on the video from a ground loop: 60 Hz on the signal, in IRE. It is not quite locked to the field rate, so the bar drifts slowly up the picture.',
      },
      {
        key: 'humMod',
        id: 95,
        label: 'hum modulation',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: "The same mains ripple in the supply of an amplifier the signal passes through, such as a failing line amp, so it moves that stage's gain instead of adding to its output. Colour saturates and fades in bands as well as brightening. Sync is scaled too, so its depth varies and the receiver's AGC and hold chase the hum. Mostly 120 Hz, from the rectified supply.",
      },
      {
        key: 'soundIre',
        id: 85,
        label: 'sound carrier',
        min: 0,
        max: 40,
        step: 0.1,
        redline: [0, 10],
        unit: 'IRE',
        fine: true,
        help: 'The 4.5 MHz intercarrier sound leaking past the trap that should remove it, as a fine herringbone over the picture.',
      },
      {
        key: 'buzzLevel',
        id: 86,
        label: 'sound buzz',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'The same leak, as audio out of your speakers. The sound detector recovers the 4.5 MHz beat between the picture and sound carriers, and a limiter that cannot keep the picture off it passes video through as audio: the vertical interval buzzes at 60 Hz, line structure whines, snow hisses. Bright scenes buzz louder because peak white overmodulates. Silent until the Sound stage is switched to buzz out loud.',
      },
    ],
  },
  {
    // Where the head reads nothing, the circuit that tries to cover for it, and
    // the generation count that stacks the whole stage on itself. Four rows, none
    // folded: the compensator's two modes are the interesting part of a dropout
    // and the length is what decides whether you see a speck or a streak.
    name: 'Dropouts & dubs',
    place: 'Channel',
    sliders: [
      {
        key: 'dropoutRate',
        id: 99,
        label: 'dropouts',
        min: 0,
        max: 400,
        step: 1,
        redline: [0, 60],
        unit: '/frame',
        help: 'How many dropout events happen per frame. Shed oxide or a clogged head leaves the head reading nothing for a moment: white streaks, and on a bad one a line the decoder cannot reconstruct.',
      },
      {
        key: 'dropoutComp',
        id: 101,
        label: 'dropout compensator',
        min: 0,
        max: 2,
        step: 1,
        unit: '',
        choices: ['none', '1-line', '2-line'],
        help: 'The circuit that patches a dropout from a delay line holding what played a line or two ago. A line of NTSC is 227.5 subcarrier cycles, so one line back arrives exactly out of phase: invisible in brightness, and in the complementary hue — the coloured streak a cheap deck leaves down a worn tape. Two lines back is a whole number of cycles, so the hue is right and the patch is two lines stale.',
      },
      {
        key: 'dropoutLenUs',
        id: 100,
        label: 'dropout len',
        min: 1,
        max: 60,
        step: 0.5,
        redline: [1, 25],
        unit: 'us',
        help: 'How long each dropout lasts. A line is 63.5 µs, so 25 µs is a streak across a third of the picture.',
      },
      {
        key: 'dubGens',
        id: 113,
        label: 'dub generations',
        min: 1,
        max: 4,
        step: 1,
        unit: 'x',
        help: 'Runs the whole tape/channel stage this many times over: a copy of a copy. Each generation adds its own noise, dropouts and timebase wander on top of the last, which is why a third-generation dub falls apart faster than one pass at triple the damage.',
      },
    ],
  },
  {
    name: 'RF / Tuner',
    place: 'Channel',
    sliders: [
      {
        key: 'rfAdjacent',
        id: 87,
        label: 'adjacent channel',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "How much of the next channel up the cable gets through the IF trap. The detector turns the neighbour's carriers into beats: their sound carrier lays a 1.5 MHz weave over everything, and their vision carrier's beat is modulated by their raster, so their blanking crosses as slanted dark bars and their vertical interval as the broad sweeping windshield-wiper band. Their line rate is not ours and wanders, so the bars slant, sweep and reverse.",
      },
      {
        key: 'rfMistuneMHz',
        id: 88,
        label: 'fine tuning',
        min: -1,
        max: 4,
        step: 0.01,
        redline: [-1, 1],
        unit: 'MHz',
        help: "The fine-tuning knob pulled off channel. Positive moves the 4.5 MHz sound carrier out of its trap, so the detector multiplies the loose carrier against the video: chroma comes back at 920 kHz as a coarse beat, and 920 kHz detail comes back at 3.58 MHz as rainbow crawl. Negative slides the picture carrier down the IF's Nyquist slope, so detail softens, saturation dies, and the burst starves until the colour killer cuts colour.",
      },
      {
        key: 'rfSnow',
        id: 89,
        label: 'weak signal (snow)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'IF noise into the envelope detector, which is what weak-signal snow is. The picture rides a negative-modulation carrier, with sync at peak power and white at 12.5%, so the noise lands unevenly: whites boil first, blacks stay quiet longest, and sync goes last. Turn it up and the sync tips go unreliable and the set loses the station.',
      },
      {
        key: 'ingress',
        id: 90,
        label: 'CB ingress',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'A two-way radio getting into the cable through a cracked shield or corroded fitting. The carrier is unrelated to any NTSC frequency, so its beat draws a herringbone at no fixed angle, wandering as the transmitter drifts. It arrives in transmissions, with silence between, and the program audio stands in for the speech, so the weave swells when someone talks.',
      },
    ],
  },
  // The program bus: the wire the mixed signal travels down, and what the
  // head-end and the copy-protection stamper did to it on the way. Filed with
  // the tape and the tuner because that is literally where they run — cable,
  // scrambling and macrovision are all the `channel` pass, downstream of mixB,
  // so drawn at the head of the chain they claimed to damage input A alone when
  // they damage the mix. The per-input versions of the same faults are the two
  // Feed groups, which really are ahead of the mixer.
  {
    name: 'Cable / Wiring',
    place: 'Channel',
    sliders: [
      {
        key: 'polarityFlip',
        id: 60,
        label: 'hard polarity (flips sync)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'A signal/ground swap at the connector: the whole composite waveform is negated, sync pulses included. The receiver has to find sync in what used to be peak white, so the picture tears and rolls while it hunts.',
      },
      {
        key: 'termination',
        id: 61,
        label: 'termination (-1 daisy, +1 open)',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Composite video expects a single 75 Ω load. Negative is double-terminated, a monitor daisy-chained with its loop-through on, which halves the signal and starts the colour killer cutting in. Positive is unterminated, so the line reflects: the signal runs hot and rings.',
      },
      {
        key: 'chromaPinOnly',
        id: 62,
        label: 'chroma-pin only',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        // The one miswiring in the group that is a party trick rather than a
        // fault you would meet: it takes sync and luma away entirely.
        fine: true,
        help: 'S-video miswired into a composite input, so only the chroma pin arrives. With no luma and no sync the receiver free-runs on a bare subcarrier.',
      },
      {
        key: 'connectorGlitch',
        id: 63,
        label: 'loose connector',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How loose the plug is. Bands of lines lose contact, re-rolled every frame, the way a plug hanging on its own cable weight makes and breaks.',
      },
      {
        key: 'connectorMode',
        id: 64,
        label: 'bad contact',
        min: 0,
        max: 2,
        step: 1,
        unit: '',
        choices: ['pin', 'shield', 'both'],
        help: `Which contact of the plug is intermittent.

          - **pin**: the centre breaks the signal path, so those bands collapse to
          the input stage's noise floor, sync included, which is why they tear.
          - **shield**: the shell breaks the ground reference, so return current
          runs to the mains earth and hum lands on the bad bands while the
          picture and its sync survive.
          - **both**: a wiggled plug, with the two faults on independent bands.`,
      },
      // Scrambling and macrovision were two more groups of two, sitting directly
      // below this one and running on the same pass over the same wire. Three
      // headers to reveal nine rows, none of which could be found without
      // opening all three — and 'Cable Scrambling' and 'Copy Protection' are the
      // same fact from the head-end's side and the stamper's.
      {
        key: 'scramble',
        id: 65,
        label: 'sync suppression',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How hard the head-end suppresses sync on a premium channel. The scrambler lifts the carrier during each sync pulse, so a set without a decoder box finds a shallow tip or none. Under about half depth the set only mismeasures it and the AGC washes the picture out bright; past that the line oscillator free-runs. The broad field pulses are wider than the line-rate gate, so the frame shears instead of tumbling.',
      },
      {
        key: 'scrambleMode',
        id: 66,
        label: 'system',
        min: 0,
        max: 2,
        step: 1,
        unit: '',
        choices: ['gated', 'alternate', 'ssavi'],
        help: "Which scrambling system. Gated suppresses every line, so the oscillator free-runs all the way down and the raster shears continuously. Alternate suppresses every other line, so the flywheel is pulled back half the time and the drift shows as a ragged line-pair zigzag. SSAVI is Zenith's: suppression plus inversion of the active video. Burst sits in the back porch and is untouched, so hue survives the inversion.",
      },
      {
        key: 'macrovision',
        id: 67,
        label: 'agc pulses (macrovision)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Macrovision's AGC poisoning, stamped on vertical-interval lines 12-19, exactly the window this receiver averages its sync depth over. A pulse parked on the back porch makes the measured depth balloon, so with agc up the set crushes gain on a signal that was never hot. The pulse level walks a slow staircase, so the gain never settles.",
      },
      {
        key: 'mvStripeDeg',
        id: 68,
        label: 'colorstripe',
        min: 0,
        max: 180,
        step: 1,
        unit: 'deg',
        // A trim on the row above: colourstripe is the second half of macrovision
        // and does nothing without it.
        fine: true,
        help: "The colorstripe half: bursts on moving bands of lines are rotated off the house phase by this much. The decoder corrects each line's hue by the burst it just gated, so the poisoned bands come out rotated the other way and hue banding crawls down the frame. A set that trusts its burst less, or averages bursts over lines, is barely affected.",
      },
    ],
  },
  {
    // Both halves of what makes a VHS look like VHS rather than like a weak
    // broadcast: the colour-under conversion, and the head failing to follow the
    // track it recorded. They were two four-row groups in a row, and 'VHS Chroma'
    // / 'VHS Tracking' are the same deck.
    name: 'VHS colour & tracking',
    place: 'Channel',
    sliders: [
      {
        key: 'colorUnderMix',
        id: 96,
        label: 'color-under',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "VHS cannot record 3.58 MHz colour, so it heterodynes chroma down to 629 kHz, records it under the luma and converts it back on playback. Raising this routes colour through that path, which collapses colour bandwidth to a fraction of luma's.",
      },
      {
        key: 'chromaNoiseIre',
        id: 97,
        label: 'chroma noise',
        min: 0,
        max: 120,
        step: 0.1,
        redline: [0, 30],
        unit: 'IRE',
        help: "Noise on the colour-under carrier, before it is converted back up. The 629 kHz carrier gets a fraction of the luma FM's headroom, which is why VHS colour is blotchy while its luma is merely grainy. It returns through the narrow chroma bandpass, so it arrives as slow smears of wrong hue. Needs colour-under raised.",
      },
      {
        key: 'underJitterDeg',
        id: 98,
        label: 'phase jitter',
        min: 0,
        max: 180,
        step: 0.1,
        redline: [0, 25],
        unit: 'deg/line',
        // Both of this group's gated controls fold: each shapes the character of
        // an effect the row above it turns on (phase jitter rides colour-under,
        // band position rides tracking error), which is exactly what the tier is
        // for. Takes the merged group from eight rows on show to six.
        fine: true,
        help: 'Per-line phase error in that down/up conversion, so hue wanders line to line and the picture picks up a coloured venetian-blind texture. Needs colour-under raised.',
      },
      {
        key: 'ycDelayNs',
        id: 105,
        label: 'Y/C delay',
        min: -3360,
        max: 3360,
        step: 70,
        redline: [-840, 840],
        unit: 'ns',
        help: 'The chroma path through a deck or proc amp runs its own filters and delay lines, and mistrimmed against the luma path the colour arrives late or early, bleeding out of one side of objects and falling short of the other. The burst travels the same path, so hue stays correct: the colour is displaced, not rotated. Steps are whole samples, about 70 ns.',
      },
      {
        key: 'trackAmt',
        id: 226,
        label: 'tracking error',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'The head is not following the recorded track. It reads partly off-track, so a band of noise appears where the signal is weakest and the picture tears and bends through it.',
      },
      {
        key: 'trackPos',
        id: 227,
        label: 'band position',
        min: 0,
        max: 1,
        step: 0.005,
        unit: '',
        fine: true,
        help: 'Where that mistracked band sits vertically, 0 top to 1 bottom. With the servo hunting, it is where the servo is trying to sit.',
      },
      {
        key: 'trackHunt',
        id: 228,
        label: 'servo hunt',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The deck's auto-tracking servo searching for the track instead of holding it. It reads the RF envelope and steps until the envelope peaks, with less damping the higher this goes, so every correction overshoots and rings. A scene change, coming out of shuttle, a transition cut or a thump through the cabinet knocks it off the peak. It draws the band by itself; tracking error above adds a floor.",
      },
      {
        key: 'trackKick',
        id: 229,
        label: 'servo kick',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'How hard each of those events unseats the servo. Needs servo hunt above 0.',
      },
      {
        key: 'headClog',
        id: 104,
        label: 'head clog',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Oxide packed into the gap of one of the two spinning heads, so that head reads weak or nothing. The heads take turns, one sweep each, so picture and snow alternate at field rate: a hard 30 Hz flicker. The head switch near the bottom is where the other head is already reading, so a few last lines always belong to the opposite head.',
      },
      {
        key: 'shuttleX',
        id: 230,
        label: 'shuttle (1 = play)',
        min: -32,
        max: 32,
        step: 0.05,
        // Bipolar, so pause is mid-track and review and cue are the two
        // directions out of it. Linear, this row put play at 51.5% of the
        // travel and the whole watchable range — 0 to 2 — inside 3% of it.
        curve: 'shuttle',
        redline: [-8, 8],
        unit: 'x',
        help: 'Tape speed as a multiple of play: cue past 1, pause at 0, review negative. Off play speed the head no longer follows one recorded track — each sweep crosses several, the RF nulls at every crossing, and that many noise bars sweep the frame. Each strip between bars is a different track with its own timing and colour-under phase, so the picture tears and rainbows at the boundaries.',
      },
    ],
  },
  {
    name: 'Timebase',
    place: 'Channel',
    sliders: [
      {
        key: 'tbJitterNs',
        id: 110,
        label: 'flutter',
        min: 0,
        max: 4000,
        step: 5,
        redline: [0, 800],
        unit: 'ns',
        help: 'Fast timebase error from capstan flutter, in nanoseconds: each line starts a slightly different moment late, so edges shimmer. Signal-domain, so the burst moves with the picture and hue wobbles too.',
      },
      {
        key: 'tbWowNs',
        id: 111,
        label: 'wow',
        min: 0,
        max: 10000,
        step: 10,
        redline: [0, 2000],
        unit: 'ns',
        help: 'Slow timebase error from tape or capstan wow. Flutter shakes line to line; wow drifts over many lines, so whole regions lean and breathe sideways together.',
      },
      {
        key: 'tbStickNs',
        id: 112,
        label: 'sticky shed',
        min: 0,
        max: 15000,
        step: 10,
        redline: [0, 3000],
        unit: 'ns',
        help: 'Binder hydrolysis making the tape grab the head drum. Tension builds until the patch breaks free, snaps forward and re-sticks: a relaxation oscillator, chaotic rather than periodic, and the mechanism behind squealing tapes. Bands of shear lean further line by line, snap back, and hang where a strong patch holds on.',
      },
      {
        key: 'headSwitchShiftUs',
        id: 103,
        label: 'head switch',
        min: -30,
        max: 30,
        step: 0.05,
        redline: [-3, 3],
        unit: 'us',
        help: 'A helical-scan VCR swaps between two heads a few lines before the bottom of the picture, and the two do not agree on timing. That mismatch is the torn hook at the very bottom of every VHS frame.',
      },
      {
        key: 'headSwitchNoise',
        id: 102,
        label: 'switch noise',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How much noise hash fills the few lines during the head switch, before the servo settles on the new head. Usually hidden under the overscan.',
      },
    ],
  },
  {
    name: 'Enhancer (bent)',
    place: 'Channel',
    sliders: [
      {
        key: 'enhClampUs',
        id: 70,
        label: 'clamp gate',
        min: -60,
        max: 600,
        step: 0.1,
        redline: [-8, 50],
        unit: 'us',
        fine: true,
        help: "How far the box's DC-restoration gate has slid off the back porch. A clamp pins one sample per line to blanking and the rest of the line rides on that, so dragged into active video the black level is whatever the picture happened to be at that instant and bounces line to line. Negative puts the gate on the sync tip, and the whole line lifts by the depth of sync.",
      },
      {
        key: 'enhDroopUs',
        id: 71,
        label: 'clamp droop',
        min: 0,
        max: 2000,
        step: 1,
        redline: [0, 400],
        unit: 'us',
        fine: true,
        help: 'Time constant of the coupling capacitor between the gates. Short enough and the level sags back toward blanking within the line: bright content drags a dark streak to the right edge. The low-frequency smear of an undersized cap, with vertical edges untouched.',
      },
      {
        key: 'enhPeakMHz',
        id: 72,
        label: 'detail freq (0 off)',
        min: 0,
        max: 5,
        step: 0.05,
        unit: 'MHz',
        help: "Centre of the peaking stage the detail knob drives, with the bend's own feedback around it. A composite box has no Y/C split, so one knob does two jobs: down around 1-2 MHz it rings on picture detail and lays bars behind every edge, up at 3.58 it boosts the subcarrier and saturation climbs with detail.",
      },
      {
        key: 'enhPeakQ',
        id: 73,
        label: 'detail regen (0.75+ howls)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "How much of the peaking stage's output the bend feeds back into it. Low rings for a few samples, ordinary edge overshoot; approaching 0.75 the ring lasts most of a line. Past it the stage is regenerative: excited by the sync pulse at the head of every line it climbs until it hits the rails, so bars build left to right.",
      },
      {
        key: 'enhPeakBoost',
        id: 74,
        label: 'detail boost',
        min: 0,
        max: 16,
        step: 0.02,
        redline: [0, 4],
        unit: 'x',
        fine: true,
        help: 'How much of the peaking stage is mixed back into the video. With the regen low it is a sharpness control; with it past unity it is how loud the howl is, and past about 1 the bars swamp the picture.',
      },
      {
        key: 'enhSync',
        id: 75,
        label: 'sync regen',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'The stabilizer half of the box: a sync separator slices the signal and stamps a clean 4.7 µs pulse at every crossing it finds. This is how much of the regenerated pulse train reaches the output.',
      },
      {
        key: 'enhSliceIre',
        id: 76,
        label: 'sync slice',
        min: -40,
        max: 60,
        step: 0.5,
        unit: 'IRE',
        fine: true,
        help: 'The level the separator calls sync, in IRE. Blanking is 0 and the real tip is -40, so anything under about -10 only finds real pulses. Raise it into picture territory and dark content produces pulses of its own, mid-line and mid-field, so the set is given a line rate the image is writing. The separator slices its own lowpassed copy, so only sustained dark areas can trip it.',
      },
    ],
  },
  {
    name: 'Sync',
    place: 'Receiver',
    sliders: [
      {
        key: 'hHold',
        id: 34,
        label: 'horizontal hold',
        min: 0.02,
        max: 2,
        step: 0.01,
        redline: [0.02, 0.8],
        unit: '',
        help: "How hard the receiver's horizontal PLL pulls toward each sync pulse it finds. Low is a loose flywheel that ignores noise but drifts and skews; high snaps to every edge including the false ones. Sync-domain: the burst gate moves with it, so a large enough error throws colour off too.",
      },
      {
        key: 'vHold',
        id: 35,
        label: 'vertical hold',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "How much authority the incoming vertical sync has over the receiver's own field oscillator. At 1 the picture locks solid; as it falls the oscillator wins and the frame rolls. This is the old vertical hold knob.",
      },
      {
        key: 'vFreqHz',
        id: 36,
        label: 'vertical osc (60 = locked)',
        min: 10,
        max: 180,
        step: 0.05,
        redline: [50, 70],
        unit: 'Hz',
        vernier: { span: 4 },
        help: "The free-running frequency of the receiver's vertical oscillator. At 60 Hz it agrees with the signal; detuned, the frame rolls at the difference. Only bites once vertical hold is loose enough to let the oscillator win.",
      },
      {
        key: 'syncBendUs',
        id: 37,
        label: 'retrace flag',
        min: 0,
        max: 60,
        step: 0.05,
        redline: [0, 12],
        unit: 'us',
        help: 'A kick to the horizontal PLL at the vertical seam, where the equalizing pulses upset it. The first few lines of the frame start late and settle back over the next dozen: the hooked, flagging top edge.',
      },
      {
        key: 'hDetuneHz',
        id: 45,
        label: 'horizontal osc detune',
        min: -3000,
        max: 3000,
        step: 1,
        curve: 'zero',
        redline: [-500, 500],
        unit: 'Hz',
        help: "Free-run drift of the receiver's horizontal oscillator away from 15.734 kHz. The PLL keeps pulling it back, so the picture leans into a diagonal skew; past the pull-in range it gives up and shears into bars.",
      },
    ],
  },
  {
    // The one group here that is not a setting on the rig: it is a hand on it.
    // Every other control says what the set is like; these five say what
    // somebody is repeatedly doing to it, which is why the rate is the first
    // row and 0 means the hand is off the board.
    name: 'Paperclip',
    place: 'Receiver',
    sliders: [
      {
        key: 'clipHz',
        id: 46,
        label: 'contacts',
        min: 0,
        max: 12,
        step: 0.1,
        redline: [0, 6],
        unit: '/s',
        help: 'How often the metal touches the board, per second. 0 is off. The gaps are drawn at random rather than counted off a clock, so two land together and then nothing happens for a second.',
      },
      {
        key: 'clipPoint',
        id: 47,
        label: 'contact point',
        min: 0,
        max: 4,
        step: 1,
        unit: '',
        choices: [
          'sync separator',
          'vertical oscillator',
          'EHT / beam supply',
          'chroma demodulator',
          'video output stage',
        ],
        help: 'Which point inside the set the clip is bridging, and which domain it damages. **sync separator** removes where the line starts, so the picture tears and takes hue with it. **vertical oscillator** collapses the scan toward a band and lets it spring back, decoded correctly throughout. **EHT / beam supply** droops the high-tension rail, so the raster swells and the limiter pulls the drive down late. **chroma demodulator** shorts the reference network, so the two axes stop being 90° apart and hue shears without the picture moving. **video output stage** runs the guns out of headroom.',
      },
      {
        key: 'clipBite',
        id: 48,
        label: 'bite',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How far the short goes while the metal is down: a fingertip on a pin, or a paperclip laid flat across it. The controls the point names travel this far from wherever they rest, so a look already leaning that way has less distance to go.',
      },
      {
        key: 'clipDwellMs',
        id: 49,
        label: 'dwell',
        min: 8,
        max: 800,
        step: 4,
        redline: [8, 250],
        unit: 'ms',
        help: "How long one contact lasts. How fast the damage arrives and clears is the receiver's, not the clip's: a bite lands over two or three frames and takes five or six to let go, because what is decaying is the flywheel finding sync and the level loop finding the tip. Under about 40 ms the contact is gone before the picture has finished reacting.",
      },
      {
        key: 'clipChatter',
        id: 50,
        label: 'chatter',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How much the contact breaks up while it is down. Bare metal on a pin bounces and scrapes, and each break takes the contact off entirely. The set takes five or six frames to let go of a short, so a single bounce inside a long contact dips the damage rather than cancelling it. Turned right up the clip is barely touching.',
      },
    ],
  },
  {
    // Not 'Audio': the stage this hangs off is the sound arriving, and a group
    // of the same name inside it stacked two headers saying one word. These are
    // the routings — where that sound is patched into the receiver.
    name: 'Audio routings',
    place: 'audio',
    sliders: [
      {
        key: 'audioRoll',
        id: 57,
        label: 'bass → vertical hold',
        min: 0,
        max: 32,
        step: 0.05,
        redline: [0, 8],
        unit: 'Hz',
        help: 'Bass energy detunes the vertical oscillator, so kick drums shove the frame vertically and it settles back. The field rate itself is moving.',
      },
      {
        key: 'audioTear',
        id: 58,
        label: 'level → horizontal hold',
        min: -3000,
        max: 3000,
        step: 1,
        curve: 'zero',
        redline: [-400, 400],
        unit: 'Hz',
        help: 'Overall audio level pulls the horizontal oscillator off frequency, so loud passages skew and tear the picture sideways. Negative leans the tear the other way.',
      },
      {
        key: 'audioSagUs',
        id: 56,
        label: 'bass → HV sag',
        min: 0,
        max: 160,
        step: 0.5,
        redline: [0, 40],
        unit: 'us',
        fine: true,
        help: 'Bass loads the high-voltage supply as if the beam were drawing current, so the scan collapses on each hit and springs back. Needs supply ring (in Deflection) above zero.',
      },
      {
        key: 'audioBendUs',
        id: 52,
        label: 'waveform into deflection',
        min: -80,
        max: 80,
        step: 0.1,
        curve: 'zero',
        redline: [-20, 20],
        unit: 'us',
        help: "The audio waveform patched into the horizontal deflection, one sample per scan line, so the deflection draws the scope trace of the sound into the picture's geometry. Deflection-domain, so hue stays put while the glass bends.",
      },
      {
        key: 'audioLoad',
        id: 53,
        label: 'audio into HV tank',
        min: 0,
        max: 12,
        step: 0.01,
        redline: [0, 3],
        unit: '',
        fine: true,
        help: 'Drives the audio into the high-voltage tank alongside the beam current, so the supply rings with the music instead of just sagging. Needs bass → HV sag above zero.',
      },
      {
        key: 'audioIre',
        id: 54,
        label: 'audio into video in',
        min: 0,
        max: 150,
        step: 0.5,
        redline: [0, 60],
        unit: 'IRE',
        help: 'The audio patched straight into the video input, in IRE. Loud passages land on the sync tips and the burst as well as the picture: brightness bands, shifting colour and tearing sync, the classic wrong-cable result.',
      },
      {
        key: 'audioHueDeg',
        id: 55,
        label: 'waveform into hue',
        min: -180,
        max: 180,
        step: 1,
        unit: 'deg',
        help: "The audio waveform driven into the colour demodulator's reference oscillator, one sample per scan line — the same wire the tint control sits on, so the sound turns the tint knob 15,734 times a second. The reference is in the receiver, so the hue bands stay on the glass while a rolling picture slides through them.",
      },
      {
        key: 'audioGain',
        id: 51,
        label: 'input trim',
        min: 0,
        max: 16,
        step: 0.01,
        redline: [0, 4],
        unit: '',
        fine: true,
        help: 'Input trim on the waveform routings, into deflection and into video in. The envelope routings (the two hold oscillators and HV sag) normalize against a decaying peak, so this trim does not move them.',
      },
    ],
  },
  {
    name: 'Deflection',
    place: 'Receiver',
    sliders: [
      {
        key: 'bendUs',
        id: 38,
        label: 'bend amount',
        min: -120,
        max: 120,
        step: 0.1,
        curve: 'zero',
        redline: [-30, 30],
        unit: 'us',
        help: "How far the tube's own scan is displaced sideways, in microseconds of line time. Deflection-domain: the beam bends after decoding, so geometry warps while hue stays put and a rolling picture slides through the bend.",
      },
      {
        key: 'bendShape',
        id: 39,
        label: 'shape',
        min: 0,
        max: 3,
        step: 1,
        unit: '',
        choices: ['flag', 'skew', 'bow', 'ripple'],
        help: 'How that displacement is distributed down the frame: 0 flag (a hook at the top that decays away), 1 skew (a straight lean), 2 bow (a barrel curve), 3 ripple (a wave down the screen).',
      },
      {
        key: 'bendPeriod',
        id: 40,
        label: 'decay / ripple period',
        min: 1,
        max: 480,
        step: 1,
        redline: [4, 480],
        unit: 'lines',
        help: 'How many scan lines the shape takes: the decay length for the flag hook, or the wavelength for the ripple.',
      },
      {
        key: 'vSize',
        id: 41,
        label: 'v size (underscan)',
        min: 0.2,
        max: 4,
        step: 0.01,
        redline: [0.5, 1.2],
        unit: 'x',
        help: 'Vertical deflection amplitude, the service knob on the yoke. Below 1 the scan shrinks and the raster comes into view past the picture: the vertical interval with whatever is parked in it, the head-switch band, and beam-off black beyond the retrace. Above 1 is overscan, which is how consumer sets shipped.',
      },
      {
        key: 'hvSagUs',
        id: 42,
        label: 'HV sag',
        min: -100,
        max: 100,
        step: 0.1,
        curve: 'zero',
        redline: [-25, 25],
        unit: 'us',
        help: 'A bright picture draws beam current, which loads the high-voltage supply and lets the scan widen, so bright content stretches the geometry around it. It follows the content, so it moves with the picture.',
      },
      {
        key: 'hvRing',
        id: 43,
        label: 'supply ring (0 droop, 1 chaos)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How well damped that supply is. At 0 it droops smoothly and recovers; toward 1 the tank rings, so a bright edge sets off a decaying wobble down the lines below it.',
      },
      {
        key: 'abl',
        id: 44,
        label: 'beam limiter',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The automatic beam limiter. The flyback can only source so much average beam current, so past a threshold the set pulls video drive down to protect it, and the sense loop's time constant lands the dimming after the bright content that caused it. The knob undersizes the flyback and strips the servo's damping, so the correction overshoots and the picture pumps at a couple of Hz.",
      },
    ],
  },
  {
    name: 'Decoder',
    place: 'Receiver',
    sliders: [
      {
        key: 'combMode',
        id: 33,
        label: 'Y/C comb',
        min: 0,
        max: 2,
        step: 1,
        unit: '',
        choices: ['trap', '2-line', '3-line'],
        help: `How the TV separates brightness from colour, which share one wire.

          - **trap**: a notch filter. Cheap, and it mistakes fine detail for
          colour (rainbow fringing on stripes) and colour for detail (dot crawl
          on edges).
          - **2-line** and **3-line**: combs, which use the line-to-line
          subcarrier alternation and largely remove both artifacts.`,
      },
      {
        key: 'svideoBleed',
        id: 32,
        label: 'S-video bleed',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'Chroma crossing into the luma path, as if the Y and C wires were shorted, so the subcarrier appears in the picture as a dense moving dot pattern over anything coloured.',
      },
      {
        key: 'demodMHz',
        id: 21,
        label: 'chroma bandwidth',
        min: 0.05,
        max: 6,
        step: 0.01,
        redline: [0.15, 3],
        unit: 'MHz',
        help: "The colour demodulator's low-pass, which decides how fast colour may change across a line. Real sets are around 0.5 MHz, which is why colour bleeds past its edges while brightness stays crisp. Past about 1.5 the passband starts admitting luma detail, so every fine texture arrives as cross-colour.",
      },
      {
        key: 'chromaTail',
        id: 22,
        label: 'chroma trail',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'Asymmetric colour smear, trailing to the right only. A lagging chroma path drags colour behind the edge, which is the direction real sets and tapes smear.',
      },
      {
        key: 'chromaCoarse',
        id: 23,
        label: 'chroma upsample error',
        min: 1,
        max: 8,
        step: 1,
        unit: 'px',
        fine: true,
        help: 'How coarsely the demodulated colour is sampled before being stretched back up. Coarse sampling lands on the subcarrier lattice at intervals, so moving detail rainbows in blocks.',
      },
      {
        key: 'chromaGain',
        id: 24,
        label: 'chroma gain',
        min: 0,
        max: 16,
        step: 0.01,
        redline: [0, 3],
        unit: 'x',
        help: 'The colour control on the set: how much the demodulated chroma is amplified. Past 1 saturation blooms and clips against the edge of the gamut.',
      },
      {
        key: 'tintDeg',
        id: 26,
        label: 'tint',
        min: -180,
        max: 180,
        step: 1,
        unit: 'deg',
        help: "The tint knob, which rotates the demodulator's reference against the incoming colour. Every hue turns together, so flesh goes green one way and magenta the other. At ±180 the reference is backwards and the picture comes out in complementary colour with its brightness untouched. The knob sits after burst lock's correction, so turning it never un-corrects itself.",
      },
      {
        key: 'burstLock',
        id: 25,
        label: 'burst lock',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How much the decoder trusts the colour burst it measured. At 1 it follows the burst, so phase errors in the incoming signal are corrected out. At 0 it runs on its own crystal, so any subcarrier error shows up as wrong, drifting hue.',
      },
      {
        key: 'demodAxisDeg',
        id: 27,
        label: 'demod axis',
        min: 0,
        max: 180,
        step: 0.5,
        unit: 'deg',
        help: "The angle between the set's two synchronous colour demodulators, 90° apart only because the reference network says so. Cheap sets used non-quadrature X/Z axes deliberately, and a drifted network lands anywhere. It shears the colour wheel: hues that were opposite stop being opposite, so the picture keeps some of its colours and loses others. Toward 0 both demodulators read the same phase and every hue collapses onto one axis.",
      },
      {
        key: 'scDetuneKHz',
        id: 29,
        label: 'subcarrier detune',
        min: -200,
        max: 200,
        step: 0.001,
        curve: 'zero',
        redline: [-20, 20],
        unit: 'kHz',
        help: "The decoder's reference crystal pulled off 3.579545 MHz, the classic circuit-bend. The demodulation axis rotates continuously against the incoming colour, so hue sweeps the whole wheel. Turn burst lock down to let it run.",
      },
      {
        key: 'killThresh',
        id: 30,
        label: 'color killer',
        min: 0,
        max: 100,
        step: 0.1,
        redline: [0, 15],
        unit: 'IRE',
        fine: true,
        help: 'The burst amplitude below which the set decides the broadcast is monochrome and shuts colour off, in IRE. Raise it and anything that weakens the burst makes colour cut in and out in patches.',
      },
      {
        key: 'accLagLines',
        id: 31,
        label: 'chroma AGC lag',
        min: 0,
        max: 240,
        step: 1,
        redline: [0, 32],
        unit: 'lines',
        fine: true,
        help: "The time constant of the chroma AGC's control voltage, in scan lines of burst memory. At 0 the set corrects colour gain instantly per line, which no real ACC can. Raised, gain and the colour killer respond to burst damage tens of lines late, so colour blooms back after a dropout band, overshoots on a scene change, and a marginal burst makes the killer chatter down the frame.",
      },
      {
        key: 'vir',
        id: 264,
        label: 'VIR correction',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How far the set trusts the reference stamped on line 19. A VIR receiver decoded that line, compared it against what it knew was sent, and trimmed its own hue and saturation until the two agreed: a closed loop around the demodulator, only as accurate as the reference arriving. A weak reference makes the set turn colour up, so a dub the tape path has been eating comes back garish. Needs the VBI test signals on.',
      },
      {
        key: 'virLag',
        id: 265,
        label: 'VIR lag',
        min: 1,
        max: 240,
        step: 1,
        redline: [8, 120],
        unit: 'frames',
        fine: true,
        help: "The corrector's time constant, in frames. Short and it chases the reference line by line, so damage that comes and goes makes the picture flicker. A real corrector was slow, responding over a second or more, so a bent reference drags the whole frame somewhere wrong and leaves it there.",
      },
      {
        key: 'matrixClip',
        id: 28,
        label: 'output stage clip',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'How the RGB output amplifiers run out of headroom. At 0 the matrix is fitted back into gamut without moving the hue, so overdriven colour stays saturated. At 1 the three guns hit their rails one at a time, and the first to clip drags the hue toward the two still in range, so saturated areas migrate toward the primaries as they blow out.',
      },
      {
        key: 'agc',
        id: 91,
        label: 'agc',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How aggressively the receiver normalizes signal level off the sync tip. At 1 it corrects for weak or hot signals; at 0 the gain is fixed, so anything that changes signal amplitude changes picture brightness directly.',
      },
      {
        key: 'encChromaMHz',
        id: 19,
        label: 'encoder chroma bw',
        min: 0.1,
        max: 4,
        step: 0.01,
        redline: [0.3, 2],
        unit: 'MHz',
        fine: true,
        help: "Colour bandwidth at the encode end, the camera's own limit, before the signal is ever transmitted. Wide enough and the chroma sidebands spill into the luma band and generate their own cross-colour.",
      },
    ],
  },
  {
    // The caption decoder is a box inside the set, which is why it sits here and
    // not beside `vbi` in the source stage. That control puts characters on line
    // 21; this one is the thing at the far end trying to read them back, and
    // everything the chain does in between happens to the words.
    //
    // The text itself is not a control — it is words, not a quantity, so a
    // preset or a random nudge has no business rewriting it. The box that types
    // it is rendered over these rows (CaptionContext, ControlGroup's FRAMES).
    name: 'Captions',
    place: 'Receiver',
    sliders: [
      {
        key: 'cc',
        id: 247,
        label: 'caption decoder',
        min: 0,
        max: 1,
        step: 1,
        unit: '',
        choices: ['off', 'on'],
        help: `The set's own caption decoder, slicing line 21 off the signal it
          received.

          The caption is *data*, and it has been through everything the picture
          has. Snow, a narrow channel, tape noise and generation loss arrive as
          misspellings: dropped characters, wrong ones, and a solid block
          wherever parity caught an error.

          The set paints the page on its own timing, so the picture can roll and
          tear underneath a caption that sits perfectly still. Needs vbi test
          signals on.`,
      },
      {
        key: 'ccBox',
        id: 248,
        label: 'caption box',
        min: 0,
        max: 1,
        step: 0.05,
        unit: '',
        help: 'How black the box behind the characters is. Broadcast captions sat in a solid one because type keyed straight over picture is unreadable once the picture is bright.',
      },
      {
        key: 'ccRomAddr',
        id: 249,
        label: 'rom address line',
        min: 0,
        max: 11,
        step: 1,
        unit: '',
        help: "A pin held high on the character generator's font ROM, a literal circuit bend. Low lines carry the row inside the cell, so holding one makes every glyph repeat a scan line. High lines carry the character code, so holding one substitutes the whole font for its neighbour a fixed distance away in the ROM. The font fills the low 1152 bytes of a 2 KiB part, so a line held high enough pushes the address into cells nobody programmed, which read all ones: a solid block.",
      },
      {
        key: 'ccRomData',
        id: 250,
        label: 'rom data line',
        min: -8,
        max: 8,
        step: 1,
        unit: '',
        fine: true,
        help: "The other bus. A font ROM's data lines are the eight dots across one row, so holding one lights or kills the same column of every character on the page. Positive holds the line high, negative low.",
      },
      {
        key: 'ccRomCross',
        id: 280,
        label: 'rom crossed lines',
        min: 0,
        max: 10,
        step: 1,
        unit: '',
        fine: true,
        help: "Two adjacent address lines transposed — a chip seated a pin over, or two traces swapped. Low in the bus the two lines carry the row inside the cell, so every glyph gets its scan lines shuffled. High in the bus they carry the character code, so the font is permuted in blocks and the text reads as somebody else's alphabet.",
      },
      {
        key: 'ccRomSlip',
        id: 288,
        label: 'rom counter slip',
        min: -4,
        max: 4,
        step: 0.05,
        unit: '/frame',
        help: `The vertical blanking reset arriving late on the
          character-address counter, so the whole page is out by the same count
          and nothing puts it back: the address is further out every frame.
          Twelve counts is one whole character, so a slow rate crawls the font
          upward through the cells and a fast one churns the page through the
          alphabet. Negative slips the other way.`,
      },
      {
        key: 'ccRomLineSlip',
        id: 293,
        label: 'rom slip per line',
        min: -0.25,
        max: 0.25,
        step: 0.001,
        unit: '/line',
        help: `The horizontal reset failing instead, so the count grows on
          every scan line and the vertical still clears it: the damage runs
          down the block, and the shear grows inside a character as well as
          between rows.

          Twelve counts is one whole character and the block is ninety-six scan
          lines tall, so an eighth of a count a line walks the font one
          character from the top row to the bottom. The count restarts at the
          top of every field, so the pattern holds still. Run the frame slip
          under it and the page crawls through the font while the shear
          stays.`,
      },
      {
        key: 'ccRomStride',
        id: 281,
        label: 'rom cell strap',
        min: -11,
        max: 12,
        step: 1,
        unit: 'rows',
        help: "The cell-height strap on the row counter, in the wrong hole: one chip served 7-, 9- and 12-line cells and the board picked by a jumper. A glyph's first row is at its code times the cell height, and the raster keeps stepping 12 rows whatever the strap says, so each scan line comes off a different character and the text shears into a diagonal slice of the font.",
      },
      {
        key: 'ccRomRot',
        id: 282,
        label: 'rom bit rot',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'Charge that has leaked off the array over thirty years. A cell that has lost it reads back as the erased state, and which state depends on how the font was masked into the part: positive erases to a lit dot and the letters thicken, negative to a dark one and they crumble. The pattern is in the die, so the same letter is damaged identically everywhere it appears.',
      },
      {
        key: 'ccPageAddr',
        id: 283,
        label: 'page address line',
        min: 0,
        max: 7,
        step: 1,
        unit: '',
        fine: true,
        help: 'A line held high on the counter that walks the page memory as the raster crosses the block. Low lines are the column, so holding one repeats columns in blocks of two, four, eight; high lines are the row, so holding one puts one row of text in for the row above. Every character is spelled correctly, from an undamaged font, and in the wrong place.',
      },
      {
        key: 'ccPageSlip',
        id: 289,
        label: 'page counter slip',
        min: -4,
        max: 4,
        step: 0.05,
        unit: '/frame',
        help: 'The same slip on the counter walking page memory. Every character keeps its shape and the whole page walks diagonally through itself, a cell at a time, wrapping off one row onto the next.',
      },
    ],
  },
  {
    // The tube split into the three things you look *at* — how the beam is
    // written, what the coating does with it, and what the glass in front of it
    // is made of — plus where your eye is, which is not the tube at all. It was
    // one group called 'Display' holding all twenty-four: the stage's only
    // group, so the map's stage → group step bought nothing, and it opened onto
    // sixteen visible rows spanning beam, phosphor, mask, convergence, purity,
    // SVM and the magnifier. No name in the panel predicted where anything was.
    name: 'Beam',
    place: 'Screen',
    sliders: [
      {
        key: 'strobeHz',
        id: 231,
        label: 'blanking strobe',
        min: 0,
        max: 20,
        step: 0.1,
        unit: 'Hz',
        help: 'Holds the beam-blanking gate on, so the guns are cut for most of each cycle and let through in flashes. The gate sits one line above the phosphor, so light already on the glass keeps decaying through the dark. Everything downstream with memory sees the dark frames too, so the beam limiter surges on the first field back and a feedback loop pumps at the strobe rate. Lock it to the beat with ♩.',
      },
      {
        key: 'strobeMs',
        id: 232,
        label: 'flash length',
        min: 1,
        max: 200,
        step: 1,
        unit: 'ms',
        help: 'How long the beam is let through each cycle. An absolute length, so speeding the strobe up does not shorten the flash and the strength of the hit stays where you set it. Under one frame it is one frame.',
      },
      {
        key: 'scanBeam',
        id: 233,
        label: 'beam profile',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'The electron beam is a spot of finite height, so it does not quite fill the gap between scan lines. Raise it for a tighter spot and visible dark gaps; lower it for a fat spot that fills in.',
      },
      {
        key: 'scanBloom',
        id: 234,
        label: 'beam bloom',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The spot grows with beam current, so bright lines are fatter than dark ones. Scanlines show in the shadows and close up in the highlights, which is why a real CRT's scanline structure comes and goes with the picture.",
      },
      {
        key: 'crtSpot',
        id: 128,
        label: 'beam spot',
        min: 0,
        max: 12,
        step: 0.05,
        redline: [0, 3],
        unit: 'px',
        help: 'How wide a spot the gun writes on the phosphor. The beam is a smooth blob, so light from one sample lands partly on its neighbours and every edge arrives as a ramp. It applies to dim picture too, so the image never resolves into hard pixels.',
      },
      {
        key: 'crtGrain',
        id: 129,
        label: 'phosphor grain',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'The coating is a granular deposit of crystallites, so its emission is mottled. Fixed on the glass, and strongest in the mid tones: black grains have nothing to vary and fully driven ones have no headroom left.',
      },
      {
        key: 'crtSharp',
        id: 239,
        label: 'reconstruction (bilinear→cubic)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        fine: true,
        help: 'How the sampled line is reconstructed into continuous light. Toward 0 is linear interpolation, which loses high frequencies; toward 1 is a cubic that stays flat past the subcarrier, so fine patterns hold as they move.',
      },
      // Scan velocity modulation is a deflection trick played on the beam, so it
      // files with the beam rather than with the glass — it used to sit between
      // the purity patch and the magnifier, which is to say between two things
      // it has nothing to do with.
      {
        key: 'crtSvm',
        id: 134,
        label: 'scan velocity mod',
        min: -4,
        max: 4,
        step: 0.01,
        redline: [-1, 1],
        unit: '',
        help: 'Consumer sets faked sharpness by patching differentiated luma into an extra deflection coil, slowing the beam through a dark-to-bright transition and speeding it through a bright-to-dark one. Emission follows dwell time, so light is moved across the edge rather than added: a white overshoot on one side, a black notch on the other. Negative wires the coil backwards.',
      },
      {
        key: 'crtSvmWidth',
        id: 135,
        label: 'svm aperture',
        min: 0.25,
        max: 24,
        step: 0.05,
        redline: [0.5, 6],
        unit: 'px',
        fine: true,
        help: 'How wide a span the differentiator looks across. Narrow gives a tight edge-liner on fine detail; wide reaches past the detail and shades whole objects, which reads as relief.',
      },
    ],
  },
  {
    name: 'Phosphor',
    place: 'Screen',
    sliders: [
      {
        key: 'phosphorMode',
        id: 236,
        label: 'phosphors',
        min: 0,
        max: 3,
        step: 1,
        unit: '',
        choices: ['sRGB', 'P22', '1953', 'green'],
        help: `Which phosphors the tube is coated with, which sets its
          primaries.

          - **sRGB**: no conversion.
          - **P22**: SMPTE-C, a normal colour TV.
          - **1953**: the wide NTSC primaries nobody ever built.
          - **green**: a long-persistence monochrome monitor.`,
      },
      {
        key: 'phosphor',
        id: 235,
        label: 'phosphor persistence',
        min: 0,
        max: 0.9995,
        // Finer than the eye needs across most of the track, but the last
        // decade of trail length lives inside the last thousandth of the
        // value: 0.999 is a tail of seconds and 0.9995 twice that.
        step: 0.0001,
        curve: 'persistence',
        redline: [0, 0.995],
        unit: '',
        help: 'How long the layer keeps glowing after the beam has passed: afterglow in the glass. The decay is second-order, so the bright core of a trail loses almost all of itself at once and only the dim remainder lingers. A real picture-tube phosphor is gone well inside one field, so a visible trail is already into oscilloscope-tube territory at the top of the range.',
      },
      {
        key: 'phosphorSkew',
        id: 237,
        label: 'trail tint',
        min: 0,
        max: 6,
        step: 0.05,
        redline: [0, 2],
        unit: '',
        help: 'The three phosphors do not decay at the same rate: red and blue die faster than green, so trails tint green as they fade.',
      },
      {
        key: 'phosphorBleed',
        id: 238,
        label: 'trail scatter',
        min: 0,
        max: 1,
        step: 0.01,
        redline: [0, 0.5],
        unit: '',
        help: 'Held light does not leave through the grain that emitted it. It scatters sideways through the layer and the glass, into phosphor that is still glowing, so the spread compounds along a trail: the fresh edge stays sharp while old light gets wider and softer.',
      },
    ],
  },
  {
    // Where the three beams land on the triads: the grille they land through,
    // the registration error that grows toward the corners, and a magnetised
    // patch that bends all three at once. The patch is drawn on a miniature
    // (FRAMES in ControlGroup), which is why its three placement controls carry
    // no `fine` — they sit behind the miniature's own ▸ sliders instead. Before
    // that they were the reverse of usable: the *strength* was on show while
    // where-and-how-big were folded away, so the visible row moved a stain you
    // could neither see nor place.
    name: 'Mask & convergence',
    place: 'Screen',
    sliders: [
      {
        key: 'maskAmt',
        id: 240,
        label: 'aperture grille',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Strength of the shadow mask or aperture grille, the vertical stripes of R, G and B phosphor the beam lands on. Raise it and the picture is visibly built out of coloured stripes.',
      },
      {
        key: 'maskPitch',
        id: 241,
        label: 'grille pitch',
        min: 1,
        max: 48,
        step: 0.5,
        redline: [1.5, 12],
        unit: 'px',
        help: 'Spacing of those phosphor triads in screen pixels. Fine pitch is a high-end monitor at a distance; coarse is a cheap tube with your nose against it. Pitches near a small whole number of pixels alias into moiré.',
      },
      {
        key: 'crtConverge',
        id: 136,
        label: 'convergence error',
        min: -12,
        max: 12,
        step: 0.05,
        redline: [-3, 3],
        unit: 'px',
        help: 'Three guns fire through one mask from three different positions, so they can only be registered over part of the screen. Nulled in the middle and worsening toward the corners, which is why an old tube is sharp in the centre and fringes red and blue at the edges. Negative crosses the guns the other way.',
      },
      {
        key: 'crtPurity',
        id: 137,
        label: 'purity (magnetised patch)',
        min: -3,
        max: 3,
        step: 0.01,
        redline: [-1, 1],
        unit: '',
        help: 'A patch of the shadow mask left magnetised by a speaker set too close. The field bends all three beams together, but a triad is three dots 120° apart, so the same nudge over-excites the dot it moves toward and starves the one opposite. The stain turns hue across itself, and it is fixed on the glass, so a rolling picture travels through it.',
      },
      {
        key: 'crtPurityX',
        id: 138,
        label: 'patch x',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Where the magnetised patch sits across the glass.',
      },
      {
        key: 'crtPurityY',
        id: 139,
        label: 'patch y',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Where the magnetised patch sits down the glass.',
      },
      {
        key: 'crtPuritySize',
        id: 140,
        label: 'patch size',
        min: 0.02,
        max: 2,
        step: 0.01,
        redline: [0.05, 0.8],
        unit: 'h',
        help: 'Radius of the magnetised patch as a fraction of picture height. Small is a screwdriver left on the cabinet. Large is a set that spent a year next to a loudspeaker.',
      },
    ],
  },
  {
    // Not the tube: where your eye is and how fast the clock runs. These are the
    // VIEW_KEYS, the controls a mutate is forbidden to touch. Splitting them out
    // of the phosphor group was half the fix — they were still placed on Screen,
    // which is a stage of the signal path, so the panel went on counting them as
    // signal: magnify the picture and the Screen box lit amber with `• 1` and
    // "This look" grew a row, for a change the tube never saw. `atRest` has no
    // idea a control is a view control (src/controls.ts), and it should not have
    // to — the placement is where that belongs.
    name: 'View',
    place: 'view',
    sliders: [
      {
        key: 'crtZoom',
        id: 242,
        label: 'magnifier',
        min: 0.25,
        max: 12,
        step: 0.01,
        // Creeping in slightly is the common move; going all the way to the
        // grille is the rare one, so it gets the last sliver of travel.
        curve: 'magnifier',
        unit: '×',
        help: 'Where your eye is, up against the glass. Everything that lives on the screen rather than in the image magnifies with it: scanline structure, the beam spot, phosphor grain, the grille triads.',
      },
      {
        key: 'crtZoomX',
        id: 243,
        label: 'magnifier x',
        min: 0,
        max: 1,
        step: 0.005,
        unit: '',
        help: 'Which part of the glass is under the magnifier, across. Ignored at 1×.',
      },
      {
        key: 'crtZoomY',
        id: 244,
        label: 'magnifier y',
        min: 0,
        max: 1,
        step: 0.005,
        unit: '',
        help: 'Which part of the glass is under the magnifier, down. Ignored at 1× and below.',
      },
      {
        key: 'timeScale',
        id: 245,
        label: 'slow motion (1 = realtime)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: 'x',
        help: "Steps the whole simulation at a fraction of display rate. Noise, rolls, sweeps, feedback loops and phosphor all slow together, and 0 freezes the frame. Modulation stays live, so an LFO or audio envelope here warps time itself. A source's own speed control, under its transport, slows the footage to match.",
      },
      {
        key: 'frameLock',
        id: 246,
        label: 'frame rate lock',
        min: 0,
        max: 4,
        step: 1,
        unit: '',
        choices: ['off', '1/2 rate', '1/3 rate', '1/4 rate', 'auto'],
        help: `Renders every second, third or fourth display refresh. A path that costs
          slightly more than a refresh interval otherwise wavers between full rate
          and half, which reads as stutter; a fixed lower rate holds steady.

          - **off**: render every refresh.
          - **1/2 rate**, **1/3 rate**, **1/4 rate**: a fixed rate. Skipped
          refreshes do no work. The simulation steps once per rendered frame, so
          rolls and noise move proportionally slower.
          - **auto**: sustained missed refreshes engage the half-rate lock, and it
          retries full rate with a lengthening pause.`,
      },
    ],
  },
]

// A control that is physically inert until another control opens its path —
// e.g. phase jitter rides the color-under conversion, so with color-under at 0
// there is nothing for it to jitter. Encoding the gate as data (it used to live
// only in the help prose) lets the panel flag the dead knob and offer the
// prerequisite in one click, instead of letting exploration die on a slider
// that does nothing.
export interface SliderNeed {
  key: ControlKey
  ok: (v: number) => boolean
  fix: number
  hint: string
}

const above0 = (v: number) => v > 0
const below1 = (v: number) => v < 1
const nonzero = (v: number) => v !== 0

const fb: SliderNeed = {
  key: 'fbMix',
  ok: above0,
  fix: 0.5,
  hint: 'mix above 0',
}
const cfb: SliderNeed = {
  key: 'cfbMix',
  ok: above0,
  fix: 0.5,
  hint: 'loop mix above 0',
}
const cfbKeyed: SliderNeed = {
  key: 'cfbKey',
  ok: nonzero,
  fix: 0.6,
  hint: 'luma key nonzero',
}
const dirtyPath: SliderNeed = {
  key: 'bGenlock',
  ok: below1,
  fix: 0,
  hint: 'genlock on "dirty sum"',
}
// Line 21 is only on the wire while the broadcast furniture is, so the decoder
// with `vbi` off is a box wired to nothing.
const chyroning: SliderNeed = {
  key: 'cgMix',
  ok: above0,
  fix: 0.9,
  hint: 'the cg faded up',
}
const carrying: SliderNeed = {
  key: 'vbi',
  ok: above0,
  fix: 1,
  hint: 'vbi test signals on, which is what puts line 21 on the wire',
}
const captioned: SliderNeed = {
  key: 'cc',
  ok: above0,
  fix: 1,
  hint: 'the caption decoder on',
}
const wiping: SliderNeed = {
  key: 'wipeMode',
  ok: above0,
  fix: 1,
  hint: 'a wipe pattern selected',
}
const pip: SliderNeed = {
  key: 'pipMix',
  ok: above0,
  fix: 0.7,
  hint: 'inset key above 0',
}
const enhPeaking: SliderNeed = {
  key: 'enhPeakMHz',
  ok: above0,
  fix: 1.5,
  hint: 'detail freq above 0',
}
const pipKeyed: SliderNeed = {
  key: 'pipKey',
  ok: nonzero,
  fix: 0.6,
  hint: 'luma key nonzero',
}
const keyed: SliderNeed = {
  key: 'bKey',
  ok: nonzero,
  fix: 1,
  hint: 'the chroma key nonzero',
}
// The matte generator's three trims only address anything while the fill
// selector is actually pointed at it.
const matteFill: SliderNeed = {
  key: 'bKeyFill',
  ok: (v: number) => v > 0.5 && v < 1.5,
  fix: 1,
  hint: 'the fill set to "matte"',
}
// The combiner has to be off "osc A alone" before the second oscillator is in
// circuit at all — patched to nothing, its frequency is a knob wired nowhere.
const combined: SliderNeed = {
  key: 'synthMix',
  ok: above0,
  fix: 2,
  hint: 'a combiner other than "osc A"',
}
// present.wgsl discards the lens centre outright below 1× (`select(vec2f(0.5),
// …, zoom > 1.0)`) — pulled back the whole picture is in view, so there is
// nothing to aim. Enough magnification to see the structure, not so much that
// the fix lands you in the grille.
const magnified: SliderNeed = {
  key: 'crtZoom',
  ok: (v: number) => v > 1,
  fix: 3,
  hint: 'the magnifier past 1×',
}

export const NEEDS: Partial<Record<ControlKey, SliderNeed>> = {
  cc: carrying,
  vir: {
    key: 'vbi',
    ok: above0,
    fix: 1,
    hint: 'vbi test signals on, which is what stamps the reference on line 19',
  },
  virLag: {
    key: 'vir',
    ok: above0,
    fix: 1,
    hint: 'the corrector trusting the reference',
  },
  ccBox: captioned,
  ccRomAddr: captioned,
  ccRomData: captioned,
  ccRomCross: captioned,
  ccRomSlip: captioned,
  ccRomLineSlip: captioned,
  ccRomStride: captioned,
  ccRomRot: captioned,
  ccPageAddr: captioned,
  ccPageSlip: captioned,
  cgX: chyroning,
  cgY: chyroning,
  cgScale: chyroning,
  cgKeyDelayNs: chyroning,
  cgClip: chyroning,
  cgKeyMHz: chyroning,
  cgEdgeX: chyroning,
  cgEdgeY: chyroning,
  cgFill: chyroning,
  cgInvert: chyroning,
  cgRomAddr: chyroning,
  cgRomData: chyroning,
  cgRomCross: chyroning,
  cgRomSlip: chyroning,
  cgRomLineSlip: chyroning,
  cgRomStride: chyroning,
  cgRomRot: chyroning,
  cgPageAddr: chyroning,
  cgPageSlip: chyroning,
  fbZoom: fb,
  fbRotateDeg: fb,
  fbShiftX: fb,
  fbShiftY: fb,
  fbGain: fb,
  fbFocus: fb,
  fbVign: fb,
  fbBlack: fb,
  fbKnee: fb,
  cfbGain: cfb,
  cfbDelayUs: cfb,
  cfbLines: cfb,
  cfbKey: cfb,
  cfbHold: cfb,
  cfbTrail: cfb,
  cfbFilterMHz: cfb,
  cfbKeyLevel: cfbKeyed,
  cfbKeySoft: cfbKeyed,
  cfbKeyExt: cfbKeyed,
  cfbKeyAcceptDeg: cfbKeyed,
  cfbKeyHueDeg: {
    key: 'cfbKeyAcceptDeg',
    ok: above0,
    fix: 40,
    hint: 'key acceptance above 0',
  },
  cfbReturn: cfb,
  cfbClockPct: cfb,
  cfbNoiseIre: cfb,
  cfbGenlock: cfb,
  cfbRingSrc: {
    key: 'cfbRing',
    ok: above0,
    fix: 0.8,
    hint: 'loop ring mod above 0',
  },
  cfbCarrierKHz: {
    key: 'cfbRingSrc',
    ok: above0,
    fix: 1,
    hint: 'the ring carrier on "oscillator"',
  },
  cfbFilterQ: {
    key: 'cfbFilterMHz',
    ok: above0,
    fix: 3.58,
    hint: 'resonance freq above 0',
  },
  cfbFilterBoost: {
    key: 'cfbFilterMHz',
    ok: above0,
    fix: 3.58,
    hint: 'resonance freq above 0',
  },
  enhPeakQ: enhPeaking,
  enhPeakBoost: enhPeaking,
  enhSliceIre: {
    key: 'enhSync',
    ok: above0,
    fix: 1,
    hint: 'sync regen above 0',
  },
  aGain: dirtyPath,
  bRing: dirtyPath,
  busClip: dirtyPath,
  bLineHz: dirtyPath,
  bDetuneHz: dirtyPath,
  bRollLps: dirtyPath,
  wipePos: wiping,
  wipeSoft: wiping,
  wipeRate: wiping,
  pipX: pip,
  pipY: pip,
  pipW: pip,
  pipH: pip,
  pipBorder: pip,
  pipSoft: pip,
  pipKey: pip,
  pipKeyLevel: pipKeyed,
  pipKeySoft: pipKeyed,
  bKeyHueDeg: keyed,
  bKeyAcceptDeg: keyed,
  bKeyClip: keyed,
  bKeySoft: keyed,
  bKeySpill: keyed,
  bKeyDelayUs: keyed,
  // Genlocked as well as keyed: on the dirty sum there is no layer behind the
  // foreground for a fill to be, so the selector addresses nothing there.
  bKeyFill: {
    key: 'bGenlock',
    ok: above0,
    fix: 1,
    hint: 'genlock on "clean dissolve"',
  },
  bKeyMatteY: matteFill,
  bKeyMatteHueDeg: matteFill,
  bKeyMatteSat: matteFill,
  synthFm: {
    key: 'synthOver',
    ok: above0,
    fix: 1,
    hint: 'the synth over the picture',
  },
  synthColorSoftPx: {
    key: 'synthColorSrc',
    ok: above0,
    fix: 1,
    hint: 'the colorizer input on "picture"',
  },
  synthColorSrc: {
    key: 'synthColor',
    ok: above0,
    fix: 0.9,
    hint: 'colorizer above 0',
  },
  synthColorMode: {
    key: 'synthColor',
    ok: above0,
    fix: 0.9,
    hint: 'colorizer above 0',
  },
  synthFmSrc: {
    key: 'synthFm',
    ok: above0,
    fix: 40000,
    hint: 'luma into osc A above 0',
  },
  strobeMs: {
    key: 'strobeHz',
    ok: above0,
    fix: 4,
    hint: 'a strobe rate above 0',
  },
  synthBHz: combined,
  synthHueDeg: {
    key: 'synthColor',
    ok: above0,
    fix: 1,
    hint: 'the colorizer above 0',
  },
  dropoutLenUs: {
    key: 'dropoutRate',
    ok: above0,
    fix: 10,
    hint: 'dropouts above 0',
  },
  aDropoutLenUs: {
    key: 'aDropoutRate',
    ok: above0,
    fix: 10,
    hint: "A's dropouts above 0",
  },
  bDropoutLenUs: {
    key: 'bDropoutRate',
    ok: above0,
    fix: 10,
    hint: "B's dropouts above 0",
  },
  dropoutComp: {
    key: 'dropoutRate',
    ok: above0,
    fix: 10,
    hint: 'dropouts above 0',
  },
  // The patch has to be magnetised before where-and-how-big mean anything. All
  // three sit behind the miniature's ▸ sliders, so these notes are only read by
  // somebody who opened that fold — the frame itself carries the same offer.
  crtPurityX: { key: 'crtPurity', ok: nonzero, fix: 0.6, hint: 'purity off 0' },
  crtPurityY: { key: 'crtPurity', ok: nonzero, fix: 0.6, hint: 'purity off 0' },
  crtPuritySize: {
    key: 'crtPurity',
    ok: nonzero,
    fix: 0.6,
    hint: 'purity off 0',
  },
  underJitterDeg: {
    key: 'colorUnderMix',
    ok: above0,
    fix: 0.8,
    hint: 'color-under above 0',
  },
  trackPos: {
    key: 'trackAmt',
    ok: above0,
    fix: 0.4,
    hint: 'tracking error above 0',
  },
  vFreqHz: {
    key: 'vHold',
    ok: below1,
    fix: 0.5,
    hint: 'vertical hold below 1',
  },
  scDetuneKHz: {
    key: 'burstLock',
    ok: below1,
    fix: 0,
    hint: 'burst lock below 1',
  },
  audioSagUs: {
    key: 'hvRing',
    ok: above0,
    fix: 0.5,
    hint: 'supply ring above 0 (in Deflection)',
  },
  crtZoomX: magnified,
  crtZoomY: magnified,
  audioLoad: {
    key: 'audioSagUs',
    ok: above0,
    fix: 10,
    hint: 'bass → HV sag above 0',
  },
}

// One line per stage for the spine's hover text — the role of the stage in the
// signal path, so the map explains itself without opening anything.
const PHASE_BLURBS: Record<Phase, string> = {
  'Source A':
    'input A becoming a composite waveform: the encoder, the static generator, and the deck and cable this one signal arrives on',
  Mix: 'where the two signals meet: the mixer that combines them, the wipe and the PiP inset. Needs a source B to do anything',
  Channel:
    'everything between the encoder and the aerial socket: the tape it was recorded on, the tuner it came through, and the cable it came down',
  Receiver:
    'a TV finding sync and decoding colour from whatever arrives: hold, deflection, the decoder',
  Screen: 'the tube itself: beam profile, phosphor persistence, shadow mask',
}

// The signal-path phases, in order — the spine the panel is browsed along.
// The browsable spine, derived straight from each group's `place` so a group's
// stage lives in one spot (the group) and can't drift from a parallel list.
// The 'b' and 'audio' groups carry no phase: both are branches that join the
// trunk from below rather than divisions of it, and they are named below.
export const PHASES = PHASE_ORDER.map(name => ({
  name,
  blurb: PHASE_BLURBS[name],
  groups: GROUPS.filter(g => g.place === name),
}))

// The head of the trunk, named here as well as in PHASE_ORDER because it is the
// one stage something asks for by identity without knowing the chain: it holds
// A's picker, so it is where a session with nothing patched in yet has to land.
//
// `satisfies` rather than a `: Phase` annotation, which would widen it to the
// whole union and take the literal type off `PICKER_STAGE_NAMES` below — the
// point of that list being that it names three stages and not any six.
export const SOURCE_A_STAGE = 'Source A' satisfies Phase

// The mixer's own stage, on the trunk: everything downstream of it carries both
// signals, so it is something the picture passes through rather than a fork off
// it. Named here as well as in PHASE_ORDER because two other things ask about
// it by identity — the map, which draws it inert while there is no B to mix,
// and the diagram, which opens the panel at it.
export const MIX_STAGE = 'Mix'

// The stretch between the encoder and the aerial socket, and the widest stage
// on the map: nine groups, where no other trunk stage has more than five. It
// was called 'Tape' until the count made the case against it — the tape is one
// of the things a recording came through, and RF / Tuner, Cable / Wiring and
// Ghosting & leakage are three of the others, so a box marked TAPE was a stage
// named after a third of itself and the reason a hunt for 'snow' or 'ghosting'
// went to the search box instead of the map.
//
// 'Channel' is the word docs/graphviz/pipeline-simple.dot already teaches for
// this block, so the diagram a reader meets first and the box they press now
// agree. Named here as well as in PHASE_ORDER because the stored-state
// migration in usePanelNav asks for it by identity.
export const CHANNEL_STAGE = 'Channel' satisfies Phase

// Input B, which is a stage of the panel without being a Phase: the second
// signal joins the trunk rather than dividing it, so it hangs *below* the trunk
// on its own row and is opened by the same click. A sixth entry in PHASE_ORDER
// would have drawn B as something the picture passes through on its way from A.
//
// Where it joins is not a choice: feedA / feedB → mixB, so B arrives at Mix.
export const SOURCE_B_STAGE = 'Source B'
export const SOURCE_B_BLURB =
  'input B, the same rig again — what B is on its own, and the deck and cable it arrives on, before either reaches the mixer'

// Sound, which is a second branch off the trunk for the same reason B is one:
// it is something patched *in*, not something the picture passes through. Where
// it joins is not a choice either — every routing in the group lands inside the
// receiver (the two hold oscillators, the HV supply, the deflection yoke, the
// colour reference, the video input), so it climbs into the Receiver box rather
// than arriving at the head of the chain like a signal would.
//
// It used to be a section of its own at the foot of the sidebar, which is what a
// control group gets when the map has nowhere to put it: an entry you find by
// scrolling rather than by following the signal. Nothing about the mechanism
// asked for that — the map just had no vocabulary for a second thing joining.
export const SOUND_STAGE = 'Sound'
export const SOUND_JOIN: Phase = 'Receiver'
export const SOUND_BLURB =
  'a mic, a track, a clip’s own audio, or whatever this machine is playing, patched into the receiver. It detunes both hold oscillators, loads the HV supply, drives the deflection and turns the colour reference, so the sound disturbs the set and the picture moves with it'

// Where the picture is watched from, which is the one box on the map that is not
// a piece of the rig. It sits at the end because that is where it is: the signal
// leaves the glass and reaches an eye, and the magnifier is the lens in between.
// The clock controls ride with it because "how fast the rig is stepped" is the
// same kind of answer as "how close you are standing" — a viewing condition, not
// a fault. Nothing here is in the path, and that is the whole point of drawing
// it apart from the path.
export const VIEW_STAGE = 'View'
// The one stage it hangs off, named like SOUND_JOIN above rather than spelled
// out at the drawing: the arrow points *out* of the chain into it, because the
// picture the glass makes is what feeds it.
export const VIEW_JOIN: Phase = 'Screen'
export const VIEW_BLURB =
  'where the picture is watched from: the magnifier and where it is pointed, how fast the whole simulation is stepped, and the frame-rate lock. Nothing in here changes the signal, and a mutate is forbidden to touch any of it'

// The modulation bay, which is a stage of the panel and not a piece of the rig
// at all. Everything else on the map is somewhere the signal goes; this is a
// hand on the knobs — LFOs, drift and the audio envelope wiggling controls that
// are scattered down every one of the other stages.
//
// So it is drawn floating, wired to nothing. The honest drawing is a dotted line
// to all two hundred controls, which is a drawing of nothing; the honest
// simplification is a box that visibly does not touch the chain. That is also
// exactly what it is: a routing leaves the resting value where it is and moves
// the picture by moving the control, so no wire on this map is the one it takes.
//
// It was a section at the foot of the sidebar, under the map and above MIDI —
// permanently on screen, and folded shut for the session it wasn't wanted in.
// A box on the map costs the panel nothing while it is closed, which is the
// whole reason it moved: the map is where you go looking for a thing to open.
export const MOD_STAGE = 'Modulation'
export const MOD_BLURB =
  'the hand on the knobs: LFOs, drift, sample-and-hold and the audio envelope wiggling any control around wherever you left its slider, the beat they lock to, and the stab gate, which cuts the whole board between the look you are dialing and a second one — stock, or a look you held there. A slot is patched at the control it drives (the + mod button on any control row); this is where the eight read as a bay'

// What the bay answers to beyond its name and its blurb. Only the words a
// searcher would actually type that the prose above does not already carry —
// the blurb is matched in full, exactly as a slider's help text is.
//
// 'strobe' is the one this list exists for. It is what most people call the
// gate, it is the app's third thing by that name (the beam's blanking strobe on
// Screen, the mixer loop's strobe hold), and it is the only one of the three
// that lives in no group — so before this it was the one word that found two
// strobes and hid the one being asked for.
// 'stabs' as well as 'stab', because the row is *labelled* "stabs" and the word
// somebody types is the one they can see. `freeMatches` asks whether a keyword
// contains the query, so the longer form has to be the one listed — a search for
// "stabs" against the entry 'stab' finds nothing, which is the failure this list
// is here to stop rather than an instance of it.
export const MOD_KEYWORDS: readonly string[] = [
  'strobe',
  'stabs',
  'tempo',
  'bpm',
  'wobble',
  'flip',
  'held look',
]

// The deck: the panel's second organization of controls it already has, filed by
// the gesture that moves them instead of by the mechanism that breaks. See
// Deck.tsx for the case — the short version is that the signal path is the right
// axis for almost everything and the wrong one for the twenty controls a hand
// moves *during* a take, which are scattered across three stages (Mix, Channel
// and the view) and want to be under one hand.
//
// So it is the second free box on the map, beside the bay, and for a reason that
// rhymes with the bay's: both are the hand rather than the rig. The bay is the
// hand you set running and leave; the deck is the hand that is on it now. Wiring
// either into the chain would be a lie of the same kind — what the deck is
// patched into is Mix, Channel and the view at once, which is three wires
// saying less than none.
//
// It was a section immediately above the map, folded shut by default, which put
// the performance surface behind a fold in the one part of the panel a
// performance never scrolls to. On the map it costs the resting sidebar nothing
// and sits where you already look for something to open.
export const DECK_STAGE = 'Deck'
export const DECK_BLURB =
  'the hand on it now: the transition lever and its wipe patterns, the DVE inset, the tape transport, the tracking knob and the hold that stops the frame dead. Every row here is the real row from the stage that owns it, with its MIDI bind and its help — gathered by the gesture that moves it rather than by where the fault happens'

// The stages headed by a picker — the three things that can be patched in, and
// so the three that decide what everything downstream of them is working on.
// Named as a set because two separate questions are answered off it and would
// otherwise be answered twice: which stages render a picker above their groups,
// and which boxes stay pressable while nothing is patched into them. A box you
// press to patch something in has to open even while it is drawn inert — that is
// the entire reason to press it.
//
// Mix is the stage this excludes and the reason the set is worth writing down:
// with no source B its every control is inert exactly like B's own, but there is
// no picker for "a second signal" to offer, only B's. So it is drawn inert and
// opens nothing, and it is the only box in the app that is both.
// Two shapes of the same list, because two different questions are asked of it.
// The names keep their literal types so `PickerStage` can key the record app.tsx
// builds its pickers in: adding a fourth picker there without adding it here is
// then a compile error rather than a fourth box that draws inert and never
// opens. The set is for the drawings, which hold a stage name as a plain string.
const PICKER_STAGE_NAMES = [
  SOURCE_A_STAGE,
  SOURCE_B_STAGE,
  SOUND_STAGE,
] as const
export type PickerStage = (typeof PICKER_STAGE_NAMES)[number]
export const PICKER_STAGES: ReadonlySet<string> = new Set(PICKER_STAGE_NAMES)

// What a box says while nothing is patched into it, in place of its blurb. One
// per inert stage, here rather than at either drawing, because the miniature and
// the full diagram both draw the same dead branch and had drifted into
// describing it two different ways — one of them still pointing at an `Input`
// section that no longer exists.
//
// Two of these are instructions and one is an explanation, which is the same
// division `PICKER_STAGES` makes: you press SOURCE B or SOUND to fix the state
// the hint describes, and there is nothing to press on Mix.
export const OFF_HINT: Readonly<Record<string, string>> = {
  [SOURCE_B_STAGE]:
    'no source B — click to pick one and mix a second signal into the chain',
  [SOUND_STAGE]:
    'no sound reaching it — click and pick a mic, a track, or the clip’s own audio, and it drives the receiver',
  [MIX_STAGE]:
    'nothing to mix — the mixer, the wipe and the inset all need a second signal, so pick a source B',
}

// The groups behind an openable stage name — trunk, branch or loop. One lookup
// rather than four, so anything that opens a stage (the map, the palette, the
// panel's own nav) reaches one without knowing it is not a Phase.
export function stageGroups(name: string): Group[] {
  if (name === SOURCE_B_STAGE) return B_GROUPS
  if (name === SOUND_STAGE) return AUDIO_GROUPS
  if (name === VIEW_STAGE) return VIEW_GROUPS
  const loop = LOOP_STAGES.find(l => l.name === name)
  if (loop !== undefined) return loopGroups(loop.loop)
  return PHASES.find(p => p.name === name)?.groups ?? []
}

// Every control, in signal-path order. The one flattening of GROUPS.
export const ALL_SLIDERS = GROUPS.flatMap(g => g.sliders)

// Span/step lookup for the code that maps external values onto controls —
// MIDI CC scaling, modulation depth, mutation — none of which have the group
// walk in hand.
export const SLIDER_BY_KEY = new Map<ControlKey, SliderDef>(
  ALL_SLIDERS.map(s => [s.key, s]),
)

// Every control has exactly one slider (controls.test.ts holds that), so the
// lookup is total: callers get a SliderDef, not a maybe they have to paper over
// with the control key as a stand-in label.
export function sliderFor(key: ControlKey): SliderDef {
  const def = SLIDER_BY_KEY.get(key)
  if (def === undefined) throw new Error(`no slider defined for ${key}`)
  return def
}

// A value landed on a control's own step grid and inside its range. One
// definition, because the four call sites that need it (MIDI CC scaling, the
// mutator, preset blending, the magnifier's curved travel) had grown two
// conventions: half anchored the grid at `min`, half at zero. They agree only
// because every slider's bounds happen to be multiples of its step — a control
// that broke that would have quietly produced values the UI cannot show.
export function snapToStep(
  def: Pick<SliderDef, 'min' | 'max' | 'step'>,
  value: number,
): number {
  const stepped =
    def.step > 0
      ? def.min + Math.round((value - def.min) / def.step) * def.step
      : value
  // Trim the float dust the multiply leaves: matchPreset compares controls with
  // ===, so a 0.30000000000000004 reads as a look someone edited.
  return Number(clamp(stepped, def.min, def.max).toFixed(6))
}

// Controls that move where you are looking rather than what the signal does.
// Still bindable, but they rank last: a knob spent on the magnifier is a knob not
// spent on the picture. The frame lock belongs here for the same reason the
// magnifier does: it shapes how the picture is watched, and a mutate that
// randomly halved the frame rate would be yanking the viewer, not the signal.
//
// Every key in the View group, and it has to stay that way — the group said "these
// are the VIEW_KEYS" for a year while `timeScale` was not one of them, so the one
// control that stops the rig was the one thing in the group a mutate could reach.
// At `wild` that is 0.3 of its whole span per hit and the range bottoms out at a
// frozen frame, which presents exactly like the lost rendering step in ADR 0004:
// a still picture in a healthy tab, sending you after the GPU instead of a knob.
// The invariant is asserted in controls.test.ts rather than left to this comment.
export const VIEW_KEYS = new Set<ControlKey>([
  'crtZoom',
  'crtZoomX',
  'crtZoomY',
  'timeScale',
  'frameLock',
])

// Every control a jitter may touch: all of them but the view.
//
// Mutate shakes the signal path, not where you are looking at it — the
// magnifier's zoom and pan stay put, so a roll never yanks the frame. Here
// rather than beside either caller because there are two of them now, and they
// have to shake the same set: the panel's mutate verbs (`useMix`) and a strip
// row whose filling is a shake (`useStrip`). A second copy of the filter is how
// the button and the row would come to mean different things.
//
// Below `VIEW_KEYS` and not beside `ALL_SLIDERS`, which is where it reads more
// naturally: a `const` is in its temporal dead zone until its own line runs, so
// evaluating this any earlier throws at import time — as every test in the app
// said at once when it was up there.
export const MUTATE_SLIDERS = ALL_SLIDERS.filter(s => !VIEW_KEYS.has(s.key))

// The same set again, kept in its circuits rather than flattened, and under the
// name of the circuit it came out of.
//
// Two callers want the grouping and one of them wants the name with it. The
// roll that crosses two looks (ui/mutate.ts › `crossover`) decides per circuit
// which look answers for that stage, so what it needs is the grouping, and the
// flat list above throws exactly that away. A stage's drift switch
// (ui/drift.ts) needs the same list for one named group, and a second copy of
// this filter is how the roll and the switch would come to disagree about what
// a stage is.
//
// Empty groups drop out — the view group is nothing but view keys, so filtering
// leaves it with no sliders, and a circuit with nothing in it is a coin flipped
// over nothing and a switch that would set nothing wandering.
export const MUTATE_CIRCUIT_BY_GROUP: ReadonlyMap<
  string,
  readonly SliderDef[]
> = new Map(
  GROUPS.map(
    g => [g.name, g.sliders.filter(s => !VIEW_KEYS.has(s.key))] as const,
  ).filter(([, sliders]) => sliders.length > 0),
)

export const MUTATE_CIRCUITS: readonly (readonly SliderDef[])[] = [
  ...MUTATE_CIRCUIT_BY_GROUP.values(),
]

// The two branches' groups — off the spine, but on the map: each hangs under
// the trunk and joins the stage it actually feeds. The mixer is no longer among
// them: it is the Mix stage, always drawn, so only what is patched into each
// branch decides whether the branch opens.
export const B_GROUPS = GROUPS.filter(g => g.place === 'b')
export const AUDIO_GROUPS = GROUPS.filter(g => g.place === 'audio')
export const VIEW_GROUPS = GROUPS.filter(g => g.place === 'view')

// A loop's own groups, in table order — one or two apiece, which is the whole
// point of the loops being three stages instead of one: pressing the run you
// can see running now brings up that machine and nothing else, where before it
// brought up all five groups of 'Feedback' and left you to find which two were
// the camera's.
export function loopGroups(loop: LoopPlace): Group[] {
  return GROUPS.filter(g => g.place === loop)
}

// The loops are deliberately *not* in here. They are off the spine as a
// placement, but every one of them is a look-maker of the first order, so they
// keep their place in the leading band of the auto-map ranking — where they sat
// as part of 'Feedback', in the same order.
const OFF_SPINE = new Set<Placement>(['b', 'audio', 'view'])
const automapSliders = [
  ...GROUPS.filter(g => !OFF_SPINE.has(g.place)),
  ...B_GROUPS,
  ...AUDIO_GROUPS,
  ...VIEW_GROUPS,
].flatMap(g => g.sliders)

// Controls in auto-map priority order. A controller has far fewer knobs than
// there are controls, so the ranking decides what a 64-knob device actually
// reaches: every look-maker first, then the fine trims, then the view. Within
// each band the signal-path spine leads and the contextual source-B and audio
// groups follow, so the low banks land on what is always on screen. Bindings are
// stored by key, so re-ranking only changes what a fresh sweep assigns.
export const AUTOMAP_KEYS: ControlKey[] = [
  ...automapSliders.filter(s => s.fine !== true && !VIEW_KEYS.has(s.key)),
  ...automapSliders.filter(s => s.fine === true && !VIEW_KEYS.has(s.key)),
  ...automapSliders.filter(s => VIEW_KEYS.has(s.key)),
].map(s => s.key)

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
  // Offer the minor-adjustment card: a second track, revealed under the row on
  // hover, that moves the value in hundredths of `step` (vernier.ts). For the
  // controls where the row's own resolution is a floor rather than a limit of
  // the mechanism — the loop's geometry, where a notch of track near stock is
  // one step and the offsets worth hunting are smaller than one. Nothing about
  // the row changes: the step, the curve and the shared readout column are all
  // as they were, and the card is what carries the extra digits.
  vernier?: true
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
      'optical — a camera on the tube’s face, its picture mixed back in ahead of the encoder, plus the gun and glass it is pointed at',
    what: 'light rather than wire — a camera on the tube’s face, its picture mixed back into the input ahead of the encoder. It carries an image that has already been decoded and lit, so it can only do what a lens can: zoom, shift, defocus, cut a black level. Past unity gain it breeds structure on its own',
    mix: 'fbMix',
  },
  {
    loop: 'mixer',
    name: MIXER_LOOP_STAGE,
    short: 'Mixer',
    blurb:
      'electrical — the composite off the bus, crossfaded back against the live signal, subcarrier and all',
    what: 'the composite itself, patched off the bus into an input and crossfaded against the live signal. The subcarrier rides round with it, so each sample of cable delay spins fed-back hue 90° a generation and colour does things optics cannot',
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
        help: 'Negates the composite waveform coming out of the encoder, as if the video pair were fed in backwards. At 1 the picture is a full negative; halfway lands on the solarized midpoint where bright and dark both fold toward grey. Hue inverts with it, since the colour subcarrier rides on the same wire.',
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
        help: 'Rebuilds each frame from a single field instead of both, the way a bob deinterlacer does. Use it when an interlaced source (a captured video or webcam) shows comb teeth on horizontal motion. Costs half the vertical detail, which is exactly the trade a real deinterlacer makes.',
      },
      {
        key: 'capLumaMHz',
        id: 1,
        label: 'capture luma band (0 off)',
        min: 0,
        max: 4.2,
        step: 0.1,
        unit: 'MHz',
        help: 'The file was digitised off a tape, and the deck that played it could only hand the capture card this much luma bandwidth: VHS manages about 3 MHz at SP, EP less, a camcorder on a tired head under 2. Whatever the chain does from here lands on a picture that was already soft, the way a tape dubbed from a tape is. 0 means the file never went through a deck.',
      },
      {
        key: 'capChromaMHz',
        id: 2,
        label: 'capture chroma band (0 off)',
        min: 0,
        max: 1.5,
        step: 0.05,
        unit: 'MHz',
        help: 'The colour band the same deck handed the capture card. Color-under records chroma on a 629 kHz carrier, so a home deck passes about 0.5 MHz of it against 3 MHz of luma — colour that smears sideways across many pixels while the edges under it stay put. That smear is in the file, so colour-under on the chain here stacks on it as a second deck would.',
      },
      {
        key: 'capNoiseIre',
        id: 4,
        label: 'capture grain',
        min: 0,
        max: 30,
        step: 0.5,
        unit: 'IRE',
        help: "The noise floor of the deck's luma FM path, as the capture card saw it: fine grain baked into every frame of the file. Held with the picture when the deck is paused, because it was on the tape, not in the chain.",
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
        help: "Noise on the deck's colour-under carrier, which had a fraction of the luma path's headroom. It reaches the file through the narrow chroma band above, so it arrives as slow blotches of wrong hue and saturation rather than speckle — bring the capture chroma band down to make it blotchier.",
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
        help: "The deck's chroma path arriving at the capture card late (+) or early (-) against its luma: colour displaced off the edges it belongs to, a few hundred nanoseconds on a home deck. One sample is 70 ns.",
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
        help: `The furniture broadcasters parked in the vertical blanking
          interval:

          - **lines 17-18** — VITS multiburst and a modulated staircase, the
            transmission-test signals engineers measured the plant with.
          - **line 19** — a VIR reference.
          - **line 21** — caption data: a clock run-in and dashes that change
            every frame, because captions are live.

          Invisible in normal framing; roll the picture or shrink v size and the
          black bar turns out to have all of this in it. On by default because a
          broadcast signal genuinely carried it — switch it off for a bare
          studio feed.`,
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
        help: "The bandwidth of the path the noise arrived through, which is what sets the size of the grain: noise cannot change faster than the circuit carrying it allows. A tuner's IF stops at 4.2 MHz, so broadcast snow is fine but not infinitely fine — per-pixel noise is sharper than any real receiver could deliver. Wind it down and the grain coarsens into the smeared streaks of a deck reading unmagnetised tape, since a playback head's own aperture is a second bandwidth in series with this one. Less bandwidth also means less noise power, so the field dims as it coarsens — that is the physics, not a compensation to dial back out.",
      },
      {
        key: 'srcNoiseLevel',
        id: 8,
        label: 'noise power',
        min: 0,
        max: 2,
        step: 0.01,
        unit: '',
        help: 'How much noise the detector is handed. On an untuned channel this scales the snow against a black floor, because an envelope detector with no carrier has nothing to lift the dark end off zero; on blank tape it scales the swing around mid grey instead, since the deemphasis network still sets the DC level whatever the demodulator is doing. Past 1 the field clips, which a real front end would only reach with the AGC wound fully open.',
      },
      {
        key: 'srcNoiseLine',
        id: 7,
        label: 'per-sweep level error',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "A gain error that lasts exactly one scan line: the tuner's AGC hunting on the noise it is trying to measure, or a playback head's contact varying sweep to sweep. It multiplies rather than adds, so it shows on the noise it is amplifying, and because a sweep is a whole line the result is horizontal banding that flickers — the difference between snow and blank tape's restless venetian texture. At zero every line is independent and the field reads as flat fuzz.",
      },
      {
        key: 'srcNoiseHz',
        id: 9,
        label: 'field refresh',
        min: 1,
        max: 60,
        step: 0.5,
        unit: 'Hz',
        help: 'How often the noise field re-rolls. At 60 it boils at display rate, which is what a live signal does; below it the source is handing over fields more slowly than the set is drawing them, so each one is held for several frames and the boil goes chunky. Non-integer ratios hold fields unevenly — the same cadence 3:2 pulldown has, out of the same arithmetic. A held field is noise you can see the frame rate of, and everything downstream then carries it: the mixer loop breeds structure out of a field that stays still long enough to feed back.',
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
        help: "The first oscillator's frequency, and the whole instrument in one knob — because what it draws is where it sits against the raster, not a shape anyone chose. At 60 Hz it fits one cycle down the frame and reads as a vertical gradient. At 15734 Hz — line rate — it fits one cycle across a line and the gradient stands up sideways. On an exact multiple it paints that many standing bars; a few hertz off and every line starts the wave a little later than the last, so the bars lean and creep, and how fast is the error. At 3579545 Hz it lands on the colour subcarrier, so the encoder downstream reads the whole screen as chroma and hands back flat colour — detune from there and hue turns across the picture.",
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
        help: 'The second oscillator, on the same scale. It does nothing until the combiner is off "osc A alone", and what it does then is beat against the first: two free-running oscillators put their difference frequency on screen, so a pair a few hertz apart draws a moire whose own drift rate is neither knob but the gap between them.',
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
        help: 'The waveform selector, on both oscillators at once. Ramp is the one to reach for first: a sawtooth is what a ramp generator makes, so at low frequencies it is a clean gradient and at high ones a stack of hard edges. Triangle folds it symmetric, sine rounds it into something the encoder passes without ringing, and pulse is a comparator output — two levels, hard edges, and the most bandwidth for the rest of the chain to mangle.',
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
        help: 'How the two oscillators are patched together. Sum is a mixing amplifier into its rails, so the two patterns lie over each other and clip where they agree. Ring mod is a balanced multiply — both carriers suppressed, only their sum and difference left — which is where plaid and moire come from. Comparator puts oscillator B on the reference input of a slicer, so A comes out two-level with its duty cycle modulated everywhere the two cross.',
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
        help: 'Output contrast about mid-video, before the colorizer. Past 1 the waveform runs into its rails and the shape squares off — a sine becomes a pulse with soft corners — so this doubles as a coarse waveshaper.',
      },
      {
        key: 'synthColor',
        id: 15,
        label: 'colorizer',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'One signal into three guns through three phase shifts 120 degrees apart, which is all a colorizer ever was. At 0 the three agree and the pattern comes out the grey it is; opened up, signal level becomes hue, so a ramp turns through the whole wheel and a pulse lands on two opposite colours.',
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
        help: 'Rotates all three phase shifts together, which slides the whole palette round the wheel without changing how the pattern is coloured. Modulate it and the picture cycles colour while the geometry holds still.',
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
        help: "The lowpass a colorizer box has ahead of its slicers, and the control that decides how large the colour fields are. A slicer handed a sharp picture finds a threshold crossing on every piece of detail and posterizes into confetti; handed a soft one it finds a few long boundaries and the picture arrives in slabs. It filters the colorizer's input alone — the picture that reaches the screen keeps every bit of its own detail, so what comes back is a sharp image wearing flat colour. Both axes, unlike the capture band above it, which is a tape loss and so is horizontal only.",
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
        help: "What the colorizer is slicing. Its own oscillator is one connector; the picture is the other, and the second is the arrangement a colorizer box was actually sold as — video in, colour out, the oscillators out of circuit behind it. Pointed at the picture it turns the image's own brightness into hue, so two areas at the same brightness come back the same colour however far apart they are on screen. That is what lays colour down in large fields: an encoder puts colour on detail, and this puts it on tone. Needs the synth over a picture to have anything to read, since a synth patched in as a source has nothing in front of it.",
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
        help: 'How the box makes colour out of level. Phase shifts is one signal into three guns through three shifts 120 degrees apart, so level turns continuously through the wheel and a gradient comes back as a smooth sweep of hue. Comparators is how the cheap boxes did it before anyone put a phase shifter in one: three slicers at three different levels, each gun switched fully on or fully off at its own threshold. The output can then only be one of eight corners of the colour cube, so the picture arrives posterized into flat areas of saturated primary with hard edges between them, and the hue knob slides the three thresholds together to walk those edges through the tonal range.',
      },
      {
        key: 'synthOver',
        id: 17,
        label: 'over picture (A)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Lays the synth over slot A's picture rather than replacing it, so it becomes a module in the chain instead of a source. Source A only — slot B's pass writes its texture rather than reading one, so there is no picture on that side to lay anything over. Does nothing while A is already showing the synth, since then the synth is what the picture is.",
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
        help: "The picture's own brightness into oscillator A's frequency input — the patch every video synth was bought for. It pulls the frequency rather than offsetting the phase, so the wave genuinely runs faster through bright picture and slower through dark: the spacing of the bars becomes the brightness, and equal-brightness regions fall into step, so the image draws itself as contour lines nobody traced. Needs something over the picture to read, so it does nothing until the control above is up.",
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
        help: "Which picture the frequency input is reading. The deck is the slot's own, so the contours land on the source and are drawn again from scratch every frame. The loop is the camera's return — the picture this stage wrote a frame ago with the synth already in it — so the contours are traced on the last generation's contours and the result goes round again: the frequency at a point is set by how bright the oscillator's own drawing was there last time. Nothing in the patch decides what that settles into, and it does not settle. With the camera loop out it reads the same picture the deck does, since there is no return to read.",
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
        help: "The pause button on the deck feeding input A, at how badly the deck copes with it. The frame holds — the drum keeps re-reading one track — but pause defeats the capstan servo, so every line of the program's own signal scatters sideways on its own around a slow wander, the raster hops when the servo hunts vertically, and a mistrack stripe of snow creeps through the picture. A is the house reference, so the receiver's PLL hunts on every line and hue wobbles with the displacement — and if B is up, B's clean sync starts winning fights it used to lose.",
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
        help: 'Dropout events per frame on the tape feeding input A alone. Shed oxide means the head reads nothing for a moment and the detector hands back snow — and this feed has no delay-line compensator, so every gap stays a raw streak. B sums in over the scars untouched.',
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
        help: "Head-end scrambling on input A alone — a premium channel is scrambled per channel, not per set. A's sync tips are lifted toward blanking before the mix, so the receiver is left choosing between A's mutilated pulses and whatever B is offering — mixing in a little clean B is exactly the pirate trick of feeding a decoder substitute sync.",
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
        help: "Which scrambling system A's channel uses. Gated suppresses every line, alternate every other line, and SSAVI also inverts the active video — so A leaks through as a negative while B stays a positive.",
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
        help: "How loose the plug in input A's jack is: bands of lines lose contact, re-rolled every frame the way a plug hanging on its own cable weight makes and breaks. Which contact is failing is the row below, and on a per-input feed that choice matters more than it does on the program bus — a break that takes A's sync leaves the receiver B's pulses to lock to.",
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
        help: "Which of A's two contacts is intermittent. The centre pin breaks the signal path, so those bands collapse to the input's own noise and take A's sync tips with them — and with B patched in, the receiver locks to B's pulses for the length of the band and hands the line start back when contact returns, so the picture snaps between two geometries with nothing drawing the switch. The shell breaks the ground reference instead and leaves the signal alone: the return current goes hunting through the mains earth, so a ground loop's hum lands on the bad bands and A's level walks and buzzes while its picture and sync survive. Both is a genuinely wiggled plug, the two on independent bands.",
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
        help: "A ground loop on input A's cable alone. A loop needs two earthed boxes joined by a shield, so it belongs to one run — this deck's outlet against the mixer's — which is why a hum bar on the program bus cannot say which cable is carrying it and this can. It lifts A's sync tips along with A's picture, so the receiver's AGC and hold chase A sixty times a second while B sits still; which of the two wins the sync fight then alternates with the hum phase, and the picture rolls in sympathy with the bar instead of merely wearing it. Negative is the other leg of a split-phase service — the same bar 180° round — so two feeds on opposite legs push against each other rather than together.",
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
        help: "Snow on A's feed only — a long antenna run or a bad patch cable ahead of the mixer. B sums in clean over the top, which is what tells a noisy input apart from a noisy program bus.",
      },
      {
        key: 'aTermination',
        id: 171,
        label: 'A termination (-1 daisy, +1 open)',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Termination fault on A's cable alone. Negative is double-terminated: A arrives dim and shallow, so it loses the sync fight against a healthy B. Positive is unterminated: A runs hot and rings with a short reflection echo while B stays clean.",
      },
      {
        key: 'aPolarity',
        id: 173,
        label: 'A polarity (flips sync)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "A signal/ground swap on A's own connector: A's waveform is negated, sync included, before it reaches the mixer. Unlike pulling A gain negative this holds even when the mixer path is idle, and unlike the program-bus hard polarity it leaves B's signal — and B's sync, which the receiver may latch onto instead — untouched.",
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
        help: 'How much of the camera-pointed-at-the-monitor image is fed back into the input. This is the classic video feedback loop, and it is half of the round trip: the fader and the exposure below multiply, so a mix of 0.6 costs the loop 40 percent a lap that no exposure under 1.67 makes back. Raise the two together until the product passes unity and the picture starts breeding structure on its own. Everything below shapes what the loop does on each trip around.',
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
        help: 'How much bigger or smaller the camera frames the screen each time around. Above 1 detail flows outward and tunnels form; below 1 it collapses inward. The distance from 1 sets how fast the loop marches, and tiny offsets are usually the most interesting.',
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
        help: 'Camera tilt on the loop. Each pass rotates the image again, so structures spiral instead of expanding straight out. Combines with zoom into the classic logarithmic-spiral feedback. A hundredth of a degree is a visible difference in how fast the spiral winds, which is why the track is fine around zero and coarse out at the ends.',
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
        help: 'Camera aim off-centre horizontally. Moves where the feedback fixed point sits, which is what decides where the tunnel mouth or spiral core lands on screen.',
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
        help: 'Camera aim off-centre vertically. Same as shift x on the other axis — together they steer the centre of the loop.',
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
        help: 'Camera exposure on the loop. The round trip is this times the mix above, not this alone — at a mix of 0.6 the knife edge where patterns persist is an exposure of 1.67, and everything under it is a smear a few frames deep however far past 1 the exposure reads. Which side of that edge is safe depends on the zoom: a loop collapsing inward concentrates what it gains into a shrinking core and holds a picture well above unity, while one expanding outward spreads it over the whole raster and walks to white within a second of crossing.',
      },
      {
        key: 'fbIris',
        id: 120,
        label: 'auto-iris hunt',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Puts the camera's exposure on its own auto-iris servo instead of the fixed gain above. The camera is metering the monitor it feeds, so the servo is inside the loop it is trying to steady: the loop brightens, the iris clamps a beat later, the loop starves, the iris reopens. Wound up, the mechanical lag outruns the damping and it never settles — bloom, clamp, collapse, reopen, at the servo's own rhythm. Runs at a different natural frequency from the beam limiter (in Deflection), so with both engaged the two pumps beat against each other.",
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
        help: 'Lens blur radius on the camera. A little defocus is what keeps a feedback loop from going straight to pixel noise: it smooths each generation, so the loop favours large soft structures over single-pixel speckle.',
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
        help: 'Lens falloff toward the corners. Loop gain becomes position-dependent — high in the middle, low at the edges — so feedback lives in the centre of frame and dies before it reaches the border.',
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
        help: 'The camera sensor black level. Anything dimmer than this reads as pure black, so trails do not linger forever at low level — they thin and snap off once they fall under the cut.',
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
        help: 'Sensor highlight compression. Bright areas roll off into a shoulder instead of clipping flat, which stabilizes a runaway loop into thick glowing bands rather than a white-out.',
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
        help: 'The gun bias point: drive below this emits no light at all. It gives the tube a true black background and, in a feedback loop, sets the floor everything has to stay above to survive another pass.',
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
        help: 'The gun transfer curve — light out versus drive in. High gamma deepens shadows and stretches highlights, which is much of what gives a CRT its contrast; in a feedback loop it sharpens the boundary between what survives and what dies.',
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
        help: 'Colour saturation of the emitted light, applied after the beam transfer. Feedback multiplies it every pass, so a small boost here compounds into wildly saturated bands.',
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
        help: 'Light spreading out of bright phosphor cores. A tight halo that fattens highlights, and in a loop it is how a bright point grows into a blob over successive passes.',
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
        help: 'Light scattering inside the thick glass faceplate and bouncing back — a wide, warm, low-level halo around highlights. Broader and softer than bloom, and the reason bright CRT images look like they are glowing through the screen rather than off it.',
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
        help: 'How much the halo widens with local beam drive. At 0 the halo is one fixed width, which is the tell — real glass scatter grows with beam current, so a peak white throws light much further into the faceplate than a mid grey. Raise it and highlights bloom disproportionately while ordinary picture keeps a tight halo.',
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
        help: 'Faceplate haze: the dull ambient sheen a powered tube has even in black areas. Lifts the black floor slightly, which in a feedback loop gives the whole frame a small standing gain.',
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
        unit: '',
        help: "Feedback through a video mixer instead of a camera: the previous frame's composite waveform is patched back into the input, electrically. This is the crossfader position toward that loop bus. The subcarrier goes around the loop too, so colour does things optics cannot. All the way over the crossfader is past the loop bus rather than on it: the program is fully out, so the loop has only itself left to feed on, and the delay and the filters take a little off every lap. Below unity gain that decays to black in about a second. It stays a picture only if the loop makes back what it loses, which is what the gain beside it is for.",
      },
      {
        key: 'cfbGain',
        id: 142,
        label: 'loop gain',
        min: -3,
        max: 3,
        step: 0.01,
        redline: [-1.2, 1.2],
        unit: 'x',
        help: 'Proc-amp trim on the loop return. Past ±1 the round trip exceeds unity and the loop builds until it clips. Negative inverts each pass, so the picture alternates polarity frame to frame and edges buzz.',
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
        help: 'Delay on the loop return, in microseconds. Because the colour subcarrier rides the same waveform, delay is also a hue rotation — one sample (70 ns) is a 90° spin. Sub-microsecond moves smear the picture sideways and repaint it in a different colour at the same time.',
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
        help: "The loop's delay trimmer replaced by a varactor hanging off the video bus, so the fed-back waveform tunes the delay it is riding through. Bright content and sync tips pull opposite ways from mid-video, and every 70 ns of pull is another 90° of hue — so each lap the picture rewrites its own timing and colour, and that rewritten picture does the pulling on the next lap. Structures shear apart by brightness, sync walks into neighbouring lines and tears, and none of it can repeat, because the displacement field is the picture itself one generation late. Sign chooses which way brightness pulls.",
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
        help: 'Vertical offset applied each trip around the loop. Every generation slides a few lines up or down, so trails walk vertically and stack into ladders instead of sitting still.',
      },
      {
        key: 'cfbKey',
        id: 145,
        label: 'loop key',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Keys the loop return, so only part of the picture feeds back. Positive keeps the side of the slice the key is set to, negative inverts the polarity and keeps the other. This is what makes feedback follow the subject instead of flooding the frame. What the box slices is the level below, until the acceptance angle opens and it slices hue instead.',
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
        help: 'The brightness the loop key slices at, in IRE (0 is blanking, 100 is peak white). Sets where the boundary between fed-back and not falls.',
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
        help: 'How wide the key transition is, in IRE. Narrow gives a hard-edged cut-out; wide gives a gradual blend that follows the picture gradient.',
      },
      {
        key: 'cfbKeyExt',
        id: 267,
        label: 'key input (self / program)',
        min: 0,
        max: 1,
        step: 1,
        unit: '',
        help: "Which connector the keyer's key input is on. Self is the loop return itself, so the loop's own past decides where it is allowed to carry on — the trail draws its own boundary and the boundary is a generation old. Program is the live picture, so what decides is what is in front of the camera now: a subject moving through the frame carves its own shape out of everything the loop has accumulated, and the accumulation cannot follow it.",
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
        help: 'Which chroma phase the keyer slices at, once the acceptance angle below has taken it off level and put it on hue. 241 is where a green backing lands; in a loop the number matters less than where it sits relative to the hue the delay is spinning the return through.',
      },
      {
        key: 'cfbKeyAcceptDeg',
        id: 269,
        label: 'key acceptance',
        min: 0,
        max: 180,
        step: 1,
        unit: 'deg',
        help: 'Swaps the luma keyer in the loop for a chroma one: a wedge this wide either side of the key hue, and at zero there is no wedge and the box goes back to slicing level. A loop keyed on its own colour is self-limiting, because the loop delay is a hue rotation — a region regenerates until its own return has spun out of the wedge, gives up, and hands the territory to whatever has spun into it. Nothing draws the boundary and nothing holds it still.',
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
        help: "Freezes the loop's frame store for this many frames before it grabs again — a frame synchronizer stuttering. At small values motion strobes; at large ones the picture holds still while the live signal keeps mixing over it.",
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
        help: "Peak-hold decay in the loop's frame store: bright areas are retained and fade rather than being replaced. This is the smeary luminance trail of a frame synchronizer left in the loop, distinct from the tube's own phosphor persistence.",
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
        help: 'Puts a resonant filter in the loop, centred here — a bent video enhancer patched into the feedback. Around 3.58 MHz it rings on the colour subcarrier itself; lower down it rings on picture detail and turns edges into repeating bars.',
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
        help: 'How selective that resonance is. Broad gives the loop a gentle tonal tilt; narrow makes it ring for a long time after every edge, laying a fixed-frequency pattern across the line.',
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
        help: 'In-band gain added by the resonance. Push it far enough that the round trip exceeds unity at that frequency and the loop self-oscillates: the filter starts generating its own pattern out of nothing.',
      },
      {
        key: 'cfbRing',
        id: 154,
        label: 'loop ring mod',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The loop bus multiplied instead of just summed with what it meets — a ring modulator with one input patched to the machine's own past. Every product goes round again and is re-multiplied a frame later, so the spectrum folds over itself generation after generation. What is on the other input is the row below, and it decides whether any of that arrives as colour.",
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
        help: "The loop's frame store read out at a clock this far off the one it was written at. A store re-triggers its readout on the output's line sync, so the error starts again every line rather than accumulating down the frame: the picture is stretched or squeezed sideways from the line start, and past the end of a line the read walks into the store's next one. What makes it a colour control is that the subcarrier is in the samples being re-clocked — a thousandth off, and the carrier comes back a thousandth off the lattice the decoder measures against, so hue turns further the further a sample sits from where the line began: eighty degrees by the right-hand edge. Each lap re-clocks what the last one wrote, so the fan opens wider every generation. No lens can do it and no delay can either; both of those move a picture without rewriting where its carrier sits.",
      },
      {
        key: 'cfbGenlock',
        id: 279,
        label: 'frame sync on the return',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Whether the return comes back through a frame synchronizer or down a bare cable. A store genlocked to house reference writes its own sync and burst on the way out, so what circulates is picture: the delay, the offsets and the varactor can be run as far as they go and the receiver still finds every line start, which is what lets a loop be pushed hard and stay a picture. On the cable the loop's own sync tip goes round with the video, one delay late, and lands somewhere inside a line — the separator loses the edge it was hunting for, the flywheel free-runs, and a second's worth of accumulated structure is thrown across a raster that is no longer under it. Both are things a rack does; this is which one is patched.",
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
        help: "A Y/C separator on the loop return and a recombiner after it, so one wire comes round the loop and the other comes from the live picture. Composite is the whole waveform going round, which is what a loop normally is. Chroma sends the loop's colour over the live brightness: hue accumulates and keeps turning through the delay's rotation while the picture under it stays sharp and current, so what builds up is colour that has come loose from the thing that cast it. Luma is the reverse — brightness and the sync tip go round underneath the live colour, so trails stack up in grey and still drag at where the receiver thinks each line starts.",
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
        help: "Which connector the ring modulator's other input is on. Program is the live picture, and both sides then carry their subcarrier on the same crystal — so chroma against chroma lands at DC and at 7.16 MHz, the chroma filter keeps neither, and what the multiply makes is brightness structure and pulses minted mid-line. Oscillator patches the box's own subcarrier generator there instead, which makes the bridge an encoder's chroma modulator: the return's brightness is translated up onto 3.58 MHz where the decoder reads it as colour, and the return's colour is translated down to brightness. Each lap swaps the two, so a picture's light comes back as its hue and that hue comes back as light.",
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
        help: 'How far that oscillator sits off the house 3.579545 MHz. At zero it agrees with the encoder, so the colour it makes out of brightness lands on one phase and the picture comes back in a single hue. Detuned, the phase it writes with ramps continuously through the frame, so the manufactured colour turns along every line and down the picture, and how fast is how far off. It is a second crystal in a second box, so nothing pulls it back — the hue keeps turning for as long as it is running.',
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
        help: "Whether source B is genlocked to the house reference. Off (0): B free-runs and is summed into the composite — a wiring fault, so its detune, roll and skew below drive fighting sync and chroma beats. On (1): B is re-encoded on A's carrier and raster and the combine becomes a clean crossfade — a production switcher dissolve, with B gain as the fader and the wipe as a clean B-replaces-A wipe. The detune/roll/skew and ring mod do nothing on this path.",
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
        help: "A's own level on the summing bus (dirty path only). 1 is full program; pull it down to fade A out under B for a manual crossfade, or take it negative to invert A into a difference key that cancels against B. Does nothing on the genlocked clean-dissolve path, where A is implied by (1 − B gain).",
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
        help: "How much of source B reaches the composite line. With genlock off this is the level B is summed in at — a wiring fault, not a clean dissolve — and negative inverts B's whole signal, sync tips included, the same hard polarity trick A gain plays. With genlock on it is the crossfade fader: 0 full A, 1 full B, and anything below 0 is simply a closed fader, since a dissolve has nothing to invert. Everything below detunes B's timebase relative to A (dirty path only).",
      },
      {
        key: 'bRing',
        id: 192,
        label: 'ring mod',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Multiplies the two composite signals instead of adding them. The product of two subcarriers lands at sum and difference frequencies, so the picture comes back in colours neither source contained.',
      },
      {
        key: 'busClip',
        id: 274,
        label: 'bus overload',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How little headroom the summing amplifier has. Two full composites added is twice the amplitude one was designed to carry, and at 0 the sum goes into the channel as arithmetic — a bus that never meets its own supply. Open it and the stage runs out: its gain falls away toward the rail rather than clipping flat, and a falling gain multiplies the two signals sharing the bus by each other. A detuned B then beats against A and lands products at their difference, inside the chroma band, so colour arrives that neither source is carrying — what the ring mod beside this does deliberately, happening because the box ran out of volts. Sync tips are squashed with everything else, so the fight for the line start changes character too: a deeper tip stops winning by as much once both are against the rail.',
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
        help: "How far B's line rate sits from A's. B slides sideways continuously, skewing a little more on each successive line, because the two horizontal oscillators are not locked. At zero it stops but stays where it drifted to.",
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
        help: "How far B's colour subcarrier sits from A's 3.579545 MHz. The decoder locks to A's burst, so B's colour beats against it and its hue cycles continuously — the rainbow crawl of a non-genlocked source.",
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
        help: "B's vertical drift in lines per frame, from its field rate not matching A's. B creeps up or down through the frame independently of the picture A is painting.",
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
        help: "Proc-amp hue trim on B before it is mixed — a static phase offset on its subcarrier. Unlike sc detune this does not drift; it just parks B's colours somewhere else.",
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
        help: "Inverts B's picture. Mixed against A this reads as a difference key — where the two agree they cancel toward flat grey, where they differ the mix lights up.",
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
        help: "The same bob deinterlacer source A has, on B's own picture: each frame rebuilt from one field instead of both, at half the vertical detail. B is where the second grabber goes, and a deck's combing is its own — a progressive camera in A and an interlaced dongle in B want opposite answers, which is why this is a switch per source rather than one on the bus.",
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
        help: "The pause button on the B deck, at how badly the deck copes with it. The frame holds — the drum keeps re-reading one track — but pause defeats the capstan servo, so B's timebase wanders aperiodically and scatters line to line; the head sweeps off the parked track through a mistrack stripe of snow that creeps down the frame on its own; and the drum's two reads never had their colour-under phase interleaved, so B's hue flickers at frame rate. All of it lands on B's own raster and then rides the dirty sum, which is the classic rig: a paused VCR into a mixer, two fighting syncs, one of them broken. When the stripe drifts through B's vertical interval it takes B's field pulses with it and the fight turns into rolls nobody scheduled. Genlock implies a time-base corrector, so on the clean-dissolve path the button just freezes the frame.",
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
        help: "Dropout events per frame on B's own tape. The streaks land on B's raster, so they slip, skew and roll with B's picture through the mix — which is what tells B's worn tape apart from damage on the program bus.",
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
        help: "Head-end scrambling on input B alone: B's sync tips are lifted toward blanking before it is summed in. B's contribution to the sync fight goes toothless — its picture still beats and rolls through the mix, but the receiver only ever hears A's pulses.",
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
        help: "Which scrambling system B's channel uses. Gated suppresses every line, alternate every other line, and SSAVI also inverts B's active video — a negative picture drifting through a positive one.",
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
        help: "How loose the plug in input B's jack is: bands of lines lose contact, re-rolled every frame. Which contact is failing is the row below. B is the input the receiver is not locked to, so a break here decides whether B's bands merely stop contributing picture or stop contributing sync — which are two different fights.",
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
        help: "Which of B's two contacts is intermittent. The centre pin breaks the signal path, so those bands of B collapse to the input's own noise and B stops pushing sync at all there — the mix goes quiet and steady for a band, then B's pulses come back and the fight resumes. The shell breaks the ground instead and leaves B's signal alone: a ground loop's hum lands on the bad bands, so B arrives on a walking pedestal that rides B's own raster through the slip and roll. Both is a genuinely wiggled plug, the two on independent bands.",
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
        help: "A ground loop on input B's cable alone — B's deck and the mixer on different outlets, the loop current landing in series with B's video. The bar rides B's own raster, so unlike a program-bus hum it slips and rolls with B's picture instead of standing still on the glass. It lifts B's sync tips with it, so how hard B fights for the line start breathes at 60 Hz. Negative is the other leg of the mains: set against A's ground loop it pushes the opposite way, which is the difference between two hum bars that agree and two that beat.",
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
        help: "Snow on B's feed only. It rides B's own raster through the slip and roll, so the noise tears and rolls with B's picture instead of sitting still on the screen the way program-bus noise does.",
      },
      {
        key: 'bTermination',
        id: 182,
        label: 'B termination (-1 daisy, +1 open)',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Termination fault on B's cable alone. Negative halves B toward a dim ghost of a signal under A; positive runs B hot and ringing, so its sync and burst bully their way into the fight against a clean A.",
      },
      {
        key: 'bPolarity',
        id: 184,
        label: 'B polarity (flips sync)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "A signal/ground swap on B's own connector: B's waveform is negated, sync included, before it reaches the summing bus. The same trick as pulling B gain negative, but as a fault in the cable rather than the fader — level and polarity stay independent knobs.",
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
        help: `A character generator at the switcher, keying the caption text
          into the picture — the box every lower third, score bug and station
          ident came out of.

          What makes it a CG rather than an overlay is that it puts out **two
          wires**: a fill, which is video, and a key, which is a matte cut at
          the characters' own edges. Everything below bends the relationship
          between those two, which is what every bent chyron is doing.

          Because it keys onto the composite bus ahead of the loops and the
          deck, what it writes is signal from here on: full-swing type is the
          harshest thing a composite path carries, so the AGC pumps on it, the
          sound detector hands it back as a whine that changes with what it
          says, and the tape ages it along with the picture.`,
      },
      {
        key: 'cgKeyDelayNs',
        id: 255,
        label: 'key timing',
        min: -600,
        max: 600,
        step: 10,
        unit: 'ns',
        help: 'The trim every real keyer has, because the key path and the video path are different lengths of circuit. Mis-set on a photograph it slides a soft matte a few samples and nobody notices. Mis-set on a glyph it puts background through one side of every stem and a hard shadow down the other — and far enough out it leaves an outline with no letter inside it. One sample is 70 ns.',
      },
      {
        key: 'cgClip',
        id: 256,
        label: 'key clip',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Where the slicer cuts the processed key. On type this is stroke weight rather than an edge position: down, and thin strokes fuse and the whole line grows a halo; up, and stems drop out of the middle of words. How much range it has depends on the key bandwidth below — a key with no soft edge has nothing for a clip to slide along.',
      },
      {
        key: 'cgKeyMHz',
        id: 257,
        label: 'key bandwidth',
        min: 0.3,
        max: 8,
        step: 0.1,
        unit: 'MHz',
        help: 'The key-processing amplifier ahead of the slicer, which is narrower than the video path and is the only reason a key has a soft edge at all. Horizontal only — the same lopsided edge the chroma keyer has, and for the same reason: this is a line of signal, not a picture, so there is no vertical neighbour on the wire.',
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
        help: "Which side of the key is cut. Inverted, the box fills the whole raster and the letters are holes in it showing the picture — which is what a downstream keyer inverted actually does, since the key's domain is the picture rather than the block of type.",
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
        help: 'A CG drew its border and drop shadow by delaying the key a sample and a line and OR-ing it back in underneath the fill. This is that delay, and pulling it far past the sample it was meant to be detaches the shadow from the type and walks it across the frame.',
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
        help: 'The other half of the drop shadow, in lines. Bending the two apart is what puts a shadow in front of the letters it belongs to instead of behind them.',
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
        help: 'How bright the characters are laid in, in IRE on the composite. 100 is peak white; past that the box is overmodulating, and everything downstream that reacts to level reacts to it — the receiver AGC, the tape, and the sound detector, which starts buzzing in time with what the caption says.',
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
        help: "The block's top edge down the picture. The stock value is a lower third, sat clear of the caption decoder's own block below it — the two are meant to be run together and read against each other.",
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
        help: 'Picture samples per font dot. The glyphs are dots on a grid, so this scales in whole dots and the type stays as crunchy as the ROM made it.',
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
        help: "A pin held high on this box's font ROM — the same bend as the caption decoder's, on a different chip, because these are two boxes and shorting one says nothing about the other. Low lines carry the row inside the cell, so every glyph grows a seam; high lines carry the character code, so the whole font substitutes.",
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
        help: 'The data bus of the same chip: eight dots across one row, so holding one stripes a column down every character on the page. Positive holds it high, negative holds it low.',
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
        help: "Selects the switcher wipe pattern that decides which parts of the frame show B instead of A: 0 off, 1 horizontal, 2 vertical, 3 box, 4 diamond. The pattern shapes the picture only — on the dirty path B's sync and burst keep summing across the whole raster whatever the wipe is doing, so engaging one shapes what you see without calling off the sync fight underneath it.",
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
        help: 'Width of the blended border along the wipe edge — a hard switcher cut at 0, a soft dissolving edge as it opens up.',
      },
      {
        key: 'wipeRate',
        id: 204,
        label: 'sweep',
        min: 0,
        max: 2,
        step: 0.01,
        unit: 'Hz',
        help: 'Drives the wipe lever back and forth automatically at this rate, so the boundary sweeps on its own. Can be locked to MIDI clock with the ♩ icon.',
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
        help: 'Squeezes source B into a positionable window over the program, like a switcher DVE. Unlike the dirty mix, the inset is re-encoded genlocked to the house raster — so it dot-crawls like real video but does not beat or roll.',
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
        help: 'Thickness of the matte border drawn around the inset — the hard frame line a switcher puts around a squeezed source.',
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
        help: 'Softness of the inset window edge, so the box blends into the program instead of cutting hard.',
      },
      {
        key: 'pipKey',
        id: 212,
        label: 'luma key (- inverts)',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Keys the inset against its own brightness so it is not a solid box: positive keeps the bright parts of B, negative keeps the dark ones. This is how you drop a subject in without the rectangle.',
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
        help: 'Width of the inset key transition. Narrow cuts a hard matte; wide feathers the subject into the program.',
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
        help: "Cuts B's backing colour away so A shows through it — a chroma keyer across the mixer, with B as the foreground. Negative inverts which side survives: the subject is cut out and the backing kept. Because the keyer is on the bus it slices the chroma the *encoder* made, not the colour the camera saw, so the matte it cuts is soft across and sharp down — the lopsided edge every composite key had. Narrowing the encoder's chroma bandwidth widens that edge, since it is the same filter.",
      },
      {
        key: 'bKeyHueDeg',
        id: 216,
        label: 'backing hue',
        min: 0,
        max: 360,
        step: 1,
        unit: 'deg',
        help: 'Which chroma phase the keyer treats as the backing. 241 is where a pure green screen lands, 347 a blue one — these are angles on the colour wheel the subcarrier actually carries, not names, which is why anything sharing a hue with the backing disappears too. Sweeping it live keys through the whole picture in turn.',
      },
      {
        key: 'bKeyAcceptDeg',
        id: 217,
        label: 'acceptance',
        min: 0,
        max: 180,
        step: 1,
        unit: 'deg',
        help: 'How wide a wedge of hue either side of the backing counts as backing. Narrow only takes the backing itself and leaves every shadow and fold on it opaque; wide starts eating anything that leans that way, which on a warm-lit subject is the skin. Past about 90 it is keying half the colour wheel.',
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
        help: 'The saturation a sample must reach before the keyer will act on its hue at all. A demodulator handed an unsaturated sample reports an essentially arbitrary phase, so without this the greys and blacks key out at random. It is also why a keyer cannot hold a dark subject against a dark backing: below the clip the two are the same signal.',
      },
      {
        key: 'bKeySoft',
        id: 219,
        label: 'gain (edge)',
        min: 0,
        max: 0.4,
        step: 0.005,
        unit: '',
        help: 'How fast the keyer swings between keep and cut, in both hue and saturation at once — the "gain" knob on the front of the box. At 0 the comparator snaps and the matte is a hard stencil with the composite edge showing as steps; open it up and the subject feathers into A, taking the backing colour with it unless spill is up.',
      },
      {
        key: 'bKeySpill',
        id: 220,
        label: 'spill kill',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Cancels the backing colour still bouncing off the subject. You cannot lift green off a composite sample — luma and chroma are the same wire — so the box does what the hardware did and reinjects the backing's own subcarrier in antiphase to null the component lying along it. It nulls flat on the genlocked path, where B's carrier phase is known exactly; on the dirty path B's carrier is running away, so the cancellation is always a little late and leaves a residue that breathes with the slip.",
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
        help: 'Where the keyer looks, against where the picture it is gating came from — the registration trim, because the key path and the video path are different lengths of circuit. Off zero the matte lies beside the subject instead of over it: one edge keeps a rim of backing colour, the other eats a rim of subject.',
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
        help: "What shows through the hole the key cut — the connector on the back of a real keyer. Program A is the other input. Matte is the box's own generator, a flat colour encoded on the house carrier, so it dot-crawls and demodulates like any other colour rather than being an RGB value pasted on the output. Loop bus patches the mixer's own last frame into the fill, so the feedback only regenerates inside the keyed shape and grows in the silhouette of whatever was the backing colour. Genlocked path only: a fill is what sits behind the foreground, and only a crossfade has a behind — on the dirty sum both signals are on the wire at once, so there the key just gates B and A is always there.",
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
        help: 'How bright the matte generator sits, black to peak white. This is the luma of a real encoded line, so pushing it to the top with saturation up puts the sum past 100 IRE and whatever is downstream — the AGC, the tape, the beam limiter — reacts to an over-level signal.',
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
        help: 'The matte colour, as a phase on the subcarrier — the same wheel the backing hue above is read off. Setting it near the backing hue is the self-defeating case worth knowing about: the fill lands inside the acceptance wedge, so anything that keys the matte away keys it again next generation through a loop.',
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
        help: 'How much chroma the matte generator puts on the carrier. At 0 it is a flat grey field with no subcarrier at all, which is the honest way to get a black or white fill; opened up it approaches the amplitude of a fully saturated primary.',
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
        help: 'How much brightness detail the recording or channel passes. Broadcast is about 4.2 MHz; VHS manages roughly 3 MHz, EP mode less. Lowering it softens fine horizontal detail exactly the way a worn tape does — vertical edges smear while the picture stays sharp top to bottom.',
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
        help: 'The sharpness boost VCRs and TVs apply to fake back the detail the bandwidth limit took away. It overshoots on every edge, laying a bright ringing outline against a dark one — the crispening artifact of consumer video.',
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
        help: "The video amplifier's gain is not flat against the brightness it is amplifying at that instant, so the colour subcarrier riding bright picture comes through smaller than the same colour on dark picture — saturation drains out of the highlights while the shadows keep theirs. On the spec sheet of every VTR and proc amp ever sold as DG%; here the full knob wipes chroma off peak white entirely. Negative is the opposite misdesign: colour swells in the brights.",
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
        help: "The same amplifier's delay moves with brightness, and a delay at 3.58 MHz is a phase shift — so hue swings with the luma underneath it: a face turns one way in the light and the other in the shadow, and flat colour picks up a wrongness that tracks the picture. The burst sits at blanking level where the shift is zero, so the decoder's reference never moves — this is hue error against a still reference, not a tint you could dial back out.",
      },
      {
        key: 'fmOverdev',
        id: 108,
        label: 'FM over-deviation',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "A VHS deck records brightness as FM with the video pre-emphasized, and a white-clip circuit is supposed to stop hard bright edges from overshooting the deviation the head and tape can carry. Set too hot, the overshoot runs past the response cliff and the discriminator folds back — more frequency comes out as less video — so every sharp dark-to-bright edge trails a black streak that smears rightward for about a microsecond and boils frame to frame, because the fold sits on a threshold the demod's own noise keeps re-deciding. Colour is recorded separately (color-under), so it rides straight through the fold: the streaks carry saturated colour over black. Only sharp edges trigger it, so it lives where the picture has detail and moves with the image.",
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
        help: 'How long the demodulator takes to recover from a fold — the deemphasis time constant, which is what smears the inversion rightward. Short is a hairline shadow on every hard edge; long drags each fold out toward a microsecond-scale black comet.',
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
        help: 'Additive noise on the waveform, in IRE: tape grain and RF snow. Because it lands on the whole signal, enough of it will also disturb sync and confuse the colour burst — noise degrades everything downstream.',
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
        help: "Where that floor comes from, which decides its colour. At 0 it is the RF path: noise through the tuner's IF filter, flat across the video band and grainless above it. At 1 it is the deck's own FM demodulator, and recovering frequency from phase differentiates whatever noise rides along — so the floor comes back with its energy rising toward the top of the band, the triangular spectrum every deemphasis network exists to tilt back. What survives that tilt is why tape hiss is not grey: it lives up near 3.58 MHz, lands inside the chroma bandpass, and decodes as crawling coloured speckle rather than as grain. Turn it up with the comb set to notch and the floor pulls colour out of nothing; the level stays put as you turn it, so what changes is character alone.",
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
        help: 'Impulse interference — ignition, an arcing thermostat, a dying flyback next door. Each event is a run of signal time at carrier-scale amplitude, and its duration decides its shape on screen: tens of microseconds is a ringing comet whose tone the decoder turns into a colour streak, hundreds is a stepped diagonal streak folded across a few lines, milliseconds a torn slab of hash. The long ones land on sync tips and the beam-load measurement, so the raster tears and the sag and beam-limiter servos flinch at every hit — the rig reacting is most of the look. Arrives in storms: flurries with real quiet between.',
      },
      {
        key: 'impulseHz',
        id: 82,
        label: 'ignition train',
        min: 0,
        max: 2000,
        step: 5,
        unit: 'Hz',
        help: "A periodic impulse source — spark plugs, a commutator motor — firing at this rate. Periodic hits against the 15.734 kHz line rate land each event a fixed step sideways from the last, so the dashes line up in drifting diagonal lattices, the signature of ignition interference. The source's rate wanders like an engine revving, which tilts and shears the lattice live. Independent of the random rate above — different neighbours' appliances.",
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
        help: 'Millisecond-scale events — lightning, an arcing breaker, a compressor kicking on. Dozens of full lines of dense hash with a DC lift, decaying down the raster. Because a strike spans whole lines it lands on sync tips and the beam-load measurement too: the PLL tears at the strike, HV sag lurches the geometry, and the beam limiter dims and blooms back — one event, and the whole rig flinches.',
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
        help: 'Peak amplitude of each impulse. Real impulses saturate the front end, so the useful range is huge: past 100 IRE every hit blooms and drags the AGC.',
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
        help: 'A triac dimmer fires twice per mains cycle at its set angle, so its hits bunch at two phases of the mains instead of falling anywhere. The random hits concentrate into two bands of hash that roll through the picture with the hum bar — the same mains, so they move together.',
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
        help: 'Multipath: a reflected copy of the broadcast arriving this many microseconds late. It shows as a displaced echo to the right of everything — the further away the reflecting building, the further out the ghost.',
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
        help: 'Mains hum riding on the video from a ground loop — 60 Hz on the signal, in IRE. Because it is not quite locked to the field rate it appears as a soft bright bar drifting slowly up the picture.',
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
        help: "The same mains ripple, but in the supply of an amplifier the signal passes through — a failing line amp — so it moves that stage's gain instead of adding to its output. The picture pumps and its colour saturates and fades in bands rather than just brightening, and because sync is scaled along with everything else the depth breathes: the receiver's AGC and horizontal hold end up chasing the hum. Mostly 120 Hz, from the rectified supply.",
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
        help: 'The 4.5 MHz intercarrier sound leaking past the trap that is supposed to remove it. Lays a fine herringbone of interference over the picture — sound buzz you can see.',
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
        help: 'The same leak heard instead of seen — this one comes out of your speakers. The sound detector recovers the 4.5 MHz beat between the picture and sound carriers, and a limiter that cannot keep the picture off it hands you the video as audio: the vertical interval as a 60 Hz buzz, line structure as a whine, and the faults above riding along. Bright scenes buzz louder because peak white really does overmodulate, snow hisses, a head switch clicks. Fine tuning adds to it the same way it adds to the weave. The detector taps the signal and not the tube, so a rolling picture leaves the buzz where it is — the roll happens after the sound has already been taken off.',
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
        help: 'How many dropout events happen per frame. Shed oxide or a clogged head means the head reads nothing for a moment, leaving white streaks and, on a bad one, a scarred line the decoder cannot reconstruct.',
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
        help: "The circuit that patches a dropout instead of letting the head's silence reach the screen, filling the gap from a delay line holding what played a line or two ago. A line of NTSC is 227.5 subcarrier cycles, so one line back the colour arrives exactly out of phase: the patch is invisible in brightness and comes out in the complementary hue, which is the coloured streak a cheap deck leaves down a worn tape. Two lines back is a whole number of cycles, so the hue is right — at the price of a patch two lines stale, which smears across anything moving. Neither can help where the line it is holding lost the same samples, and there the raw dropout shows through.",
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
        help: 'How long each dropout lasts, in microseconds. A line is 63.5 µs, so 25 µs is a streak across a third of the picture width.',
      },
      {
        key: 'dubGens',
        id: 113,
        label: 'dub generations',
        min: 1,
        max: 4,
        step: 1,
        unit: 'x',
        help: 'Runs the whole tape/channel stage this many times over — a copy of a copy of a copy. Each generation adds its own independent noise, dropouts and timebase wander on top of the last, which is why third-generation dubs fall apart much faster than one pass at triple the damage.',
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
        help: "How much of the next channel up the cable gets through the IF trap. What leaks is the neighbour's carriers, so the detector turns them into beats: their sound carrier lays a 1.5 MHz weave over everything, and their vision carrier's beat is amplitude-modulated by their raster — their blanking is peak power, so it crosses the screen as slanted dark bars, and their vertical interval as the broad sweeping band (the windshield wiper). Their line rate is not ours and wanders, so the bars slant, sweep, hang and reverse; where their content beats into our chroma band the decoder makes colour out of it — colour out of carrier arithmetic alone.",
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
        help: "The fine-tuning knob pulled off channel. Positive moves the 4.5 MHz sound carrier out of its trap: the buzz weave arrives on its own, and the detector starts multiplying the loose carrier against the video — chroma comes back at 920 kHz as a coarse beat, and 920 kHz picture detail comes back at 3.58 MHz, which the decoder reads as rainbow crawl on fine detail. Negative slides the picture carrier down the IF's Nyquist slope, so the upper sideband goes first: detail softens, saturation dies, and far enough down the burst starves until the colour killer drops colour entirely.",
      },
      {
        key: 'rfSnow',
        id: 89,
        label: 'weak signal (snow)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'IF noise into the envelope detector, which is what weak-signal snow actually is. The picture rides a negative-modulation carrier — sync is peak power, white is 12.5% — so the noise is not spread evenly: whites boil first, blacks stay quiet longest, and sync is the last thing to die, so the picture fights through the snow instead of sinking into flat grey fuzz. Wind it up and the sync tips themselves go statistical: the line hunt starts missing, the AGC chases a depth that no longer means anything, and the set loses the station the way a set actually loses a station.',
      },
      {
        key: 'ingress',
        id: 90,
        label: 'CB ingress',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'A two-way radio getting into the cable through a cracked shield or corroded fitting. The carrier owes nothing to any NTSC frequency, so its beat draws a herringbone at no fixed angle, wandering as the transmitter drifts — and it arrives in transmissions: the operator keys the mic for stretches with real silence between. The program audio stands in for the speech, AM and FM at once, so the weave swells and sways when someone talks and drops back to a bare idling carrier between words.',
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
        help: 'A signal/ground swap at the connector: the whole composite waveform is negated, sync pulses included. Unlike the picture-only invert above, the receiver now has to find sync in what used to be peak white, so the picture tears and rolls while it hunts.',
      },
      {
        key: 'termination',
        id: 61,
        label: 'termination (-1 daisy, +1 open)',
        min: -1,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'Composite video expects a single 75 Ω load. Negative is double-terminated — a monitor daisy-chained with its loop-through still on — halving the signal, so the picture goes dim and the colour killer starts to bite. Positive is unterminated, so the line reflects: signal runs hot and rings, with overshoot on every edge.',
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
        help: 'S-video miswired into a composite input: only the chroma pin arrives. There is no luma and no sync, so the receiver free-runs on a bare subcarrier — floating colour over a black raster that has nothing to lock to.',
      },
      {
        key: 'connectorGlitch',
        id: 63,
        label: 'loose connector',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How loose the plug is: bands of lines lose contact, re-rolled every frame the way a plug hanging on its own cable weight makes and breaks. Which of the two contacts is failing is the row below, and they fail into completely different pictures.',
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

          - **pin** — the centre breaks the signal path, so the jack sees an
            open through its own terminator and those bands collapse to the
            input stage’s noise floor. Sync included, which is why they tear.
          - **shield** — the shell breaks the ground reference instead and
            leaves the signal alone: the return current goes looking for the
            mains earth through both boxes’ supplies, so a ground loop’s hum
            lands on the bad bands and the level walks and buzzes while the
            picture and its sync survive.
          - **both** — a genuinely wiggled plug, the two faults on independent
            bands so they interleave.`,
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
        help: 'How hard the head-end suppresses sync on a premium channel. The scrambler lifts the carrier during each sync pulse, so a set without a decoder box has a shallow tip — or none at all — to find the start of a line in. Under about half depth the tip still clears the slicer and the set merely mismeasures it, so the AGC over-compensates and the picture washes out bright. Past that the tip is gone and the line oscillator is left free-running, so what the picture does next is whatever the h-osc detune below says its own rate is — a set sitting exactly on 15.734 kHz coasts through the gap almost cleanly. Vertical stays roughly framed either way: the broad vertical pulses are wider than the line-rate gate, so the frame shears instead of tumbling.',
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
        help: "Which scrambling system. Gated suppresses every line, so the oscillator free-runs the whole way down and the raster shears continuously. Alternate suppresses every other line, so the flywheel is hauled back half the time and the drift between corrections comes out as a ragged line-pair zigzag on every vertical edge — it tolerates far more h-osc detune before it stops being a picture. SSAVI is Zenith's: suppression plus inversion of the active video, so what does leak through is a negative. Burst sits in the back porch and is untouched, so hue survives the inversion.",
      },
      {
        key: 'macrovision',
        id: 67,
        label: 'agc pulses (macrovision)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "Macrovision's AGC poisoning, stamped on vertical-interval lines 12-19 of the source — exactly the window this receiver averages its sync depth over. A pulse parked on the back porch makes the measured sync depth balloon, so with the agc control up the set answers by crushing gain on a signal that was never hot; the pulse level walks a slow staircase, so the picture breathes instead of settling. The pulse trains themselves sit in the blanking interval — invisible until the picture rolls, when the classic flashing bar rides the vertical interval into view.",
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
        help: "The later half of the process: colourbursts on walking bands of picture lines are rotated off the house phase by this much. The decoder corrects each line's hue by the burst it just gated, so the poisoned bands come out rotated the other way — hue banding crawling down the frame. A set that trusts its burst less (burst lock) or averages bursts over lines (chroma AGC lag) shrugs it off, which is exactly the difference between the TV this was invisible on and the VCR it was aimed at.",
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
        help: "VHS cannot record 3.58 MHz colour, so it heterodynes chroma down to 629 kHz, records it under the luma, and converts it back on playback. Raising this routes colour through that path: it collapses colour bandwidth to a fraction of luma's, which is why VHS colour smears sideways for many pixels while edges stay sharp.",
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
        help: 'Noise on the colour-under carrier itself, before it is converted back up. The 629 kHz chroma carrier gets a fraction of the headroom the luma FM does, so its signal-to-noise is far worse — which is why VHS colour is blotchy while its luma is merely grainy. This noise has to come back through the narrow chroma bandpass, so it arrives as slow smears of wrong hue rather than the fine speckle the noise slider gives. Needs colour-under raised to do anything.',
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
        help: 'Per-line phase error in that down/up conversion. The colour-under path has to reinsert phase exactly; when it does not, hue wanders line to line and the picture picks up a coloured venetian-blind texture. Needs colour-under raised to do anything.',
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
        help: "The chroma path through a deck or proc amp runs its own filters and delay lines, and when their group delay is mistrimmed against the luma path the colour arrives late (or early): every coloured area sits bodily sideways off the edge it belongs to, colour bleeding out of one side of objects and falling short of the other. The burst travels the same mistrimmed path, so the decoder's reference moves with the picture's chroma and hue stays correct — displaced colour, not rotated, which is what tells this from a timebase error. Steps are whole samples, about 70 ns each.",
      },
      {
        key: 'trackAmt',
        id: 226,
        label: 'tracking error',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'The head is not following the recorded track. It reads partly off-track, so a band of noise appears where the signal is weakest and the picture tears and bends through it — the thing the tracking knob on a VCR was for.',
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
        help: 'Where that mistracked band sits vertically, 0 top to 1 bottom. With the servo parked you park it; with the servo hunting it is where the servo is trying to sit.',
      },
      {
        key: 'trackHunt',
        id: 228,
        label: 'servo hunt',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The deck's auto-tracking servo, searching for the track instead of holding it. It reads the RF envelope and steps until the envelope peaks; a stretched tape drifts it back off, and it corrects with less damping the higher this goes, so every correction overshoots and rings. A scene change, coming out of shuttle, the loop's splice passing, a transition cut or a thump through the cabinet from the music all knock it off the peak — the band sweeps, the picture bends through it, and the top of the frame flags on the tape tension. Draws the band by itself; tracking error above adds a floor to it.",
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
        help: 'Oxide packed into the gap of one of the two spinning heads, so that head reads weak or nothing. The heads take turns — one sweep each — which is why a clogged head never shows as a steady veil: picture and snow alternate at field rate, a hard 30 Hz flicker between the good head’s sweep and the dead one’s. The head switch near the bottom of the picture is where the other head is already reading, so a few last lines always belong to the opposite head: they survive the snowed sweeps and die on the clean ones. Sync goes down with the sweep, so the receiver tears through the snow instead of framing it.',
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
        help: 'Tape speed as a multiple of play — cue past 1, pause at 0, review negative. Off play speed the spinning head no longer follows a single recorded track: each sweep crosses several, the RF nulls at every crossing, and that many noise bars sweep the frame. Each strip between bars is a different track with its own timing and color-under phase, so the picture tears and rainbows at the boundaries. At 1 the head tracks and the picture is clean.',
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
        help: 'Fast timebase error from capstan flutter, in nanoseconds. Each line starts a slightly different moment late, so edges get a ragged, shimmering wobble. This is signal-domain error — the burst moves with the picture, so hue wobbles too.',
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
        help: 'Slow timebase error from tape or capstan wow. Where flutter shakes line to line, wow drifts over many lines, so whole regions of the picture lean and breathe sideways together.',
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
        help: 'Binder hydrolysis making the tape grab the head drum — tension builds until the patch breaks free, snaps forward, and re-sticks: a relaxation oscillator, chaotic rather than periodic, the mechanism behind squealing tapes. Down the raster that is bands of shear that lean further line by line, snap back in a few, and hang where a strong patch holds on. Signal-domain, so the color-under phase rainbows at every slip boundary.',
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
        help: 'A helical-scan VCR swaps between two heads a few lines before the bottom of the picture, and the two do not agree on timing. That mismatch, in microseconds, is the torn hook at the very bottom of the frame that every VHS tape has.',
      },
      {
        key: 'headSwitchNoise',
        id: 102,
        label: 'switch noise',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How much noise hash fills the few lines during the head switch, before the servo settles on the new head. Usually hidden under the bottom of the overscan; raise it and the frayed band shows.',
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
        help: "How far the box's DC-restoration gate has slid off the back porch, in microseconds. A clamp pins one sample per line to blanking and the rest of the line rides on that; correct, it lands on the porch and does nothing. Drag it into active video and black level is set by whatever the picture happens to be at that instant, so the level bounces line to line with the image. Negative puts the gate on the burst or the sync tip, and the whole line lifts by the depth of sync.",
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
        help: 'Time constant of the coupling capacitor between the gates, in microseconds. Short enough and the level sags back toward blanking within the line: bright content drags a dark streak behind it all the way to the right edge, and a lit area leaves the rest of its line depressed. This is the low-frequency smear of a box with an undersized cap — vertical edges stay sharp.',
      },
      {
        key: 'enhPeakMHz',
        id: 72,
        label: 'detail freq (0 off)',
        min: 0,
        max: 5,
        step: 0.05,
        unit: 'MHz',
        help: "Centre of the peaking stage the detail knob drives, with the bend's own feedback wrapped around it. A composite box has no Y/C split, so this is one knob doing two jobs: down around 1-2 MHz it rings on picture detail and lays bars behind every edge, and up at 3.58 it is boosting the subcarrier itself, so saturation climbs with detail and dot crawl comes apart.",
      },
      {
        key: 'enhPeakQ',
        id: 73,
        label: 'detail regen (0.75+ howls)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "How much of the peaking stage's output the bend feeds back into it. Low rings for a few samples — ordinary edge overshoot. Approaching 0.75 the ring lasts most of a line. Past it the stage is regenerative: excited by the sync pulse at the head of every line it climbs until it hits the amplifier's rails, so the bars build left to right across the picture and the image only knocks them about.",
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
        help: 'How much of the peaking stage is mixed back into the video. With the regen low this is a sharpness control; with it past unity this is how loud the howl is, and past about 1 the bars are full-scale and swamp the picture they came from.',
      },
      {
        key: 'enhSync',
        id: 75,
        label: 'sync regen',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'The stabilizer half of the box: a sync separator slices the signal and stamps a clean 4.7 us pulse at every crossing it finds. At the standard slice the stamp lands on the real sync tip and nothing changes. This is how much of the regenerated pulse train reaches the output.',
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
        help: 'The level the separator calls sync, in IRE. Blanking is 0 and the real tip is -40, so anything under about -10 only ever finds real pulses. Bend it up into picture territory and dark content starts minting pulses of its own, mid-line and mid-field: the set is handed a line rate the image is writing, and it tears wherever the picture goes dark. The separator slices its own lowpassed copy, so burst and fine detail cannot trip it — only sustained dark areas can.',
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
        help: "How hard the receiver's horizontal PLL pulls toward each sync pulse it finds. Low is a loose flywheel that ignores noise but drifts and skews; high snaps to every edge including the false ones, so damage in the waveform is translated straight into a bent picture. Sync-domain: the burst gate moves with it, so a large enough error throws colour off too.",
      },
      {
        key: 'vHold',
        id: 35,
        label: 'vertical hold',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "How much authority the incoming vertical sync has over the receiver's own field oscillator. At 1 the picture locks solid; as it falls the oscillator wins and the frame starts to roll — the old vertical hold knob, from the picture's side.",
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
        help: "The free-running frequency of the receiver's vertical oscillator. At 60 Hz it agrees with the signal and sits still; detune it and the frame rolls at a speed set by the difference, up or down. Only bites once vertical hold is loose enough to let the oscillator win.",
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
        help: 'A kick to the horizontal PLL at the vertical seam, where the equalizing pulses upset it. The first few lines of the frame start late and settle back over the next dozen, giving the hooked, flagging top edge of a picture whose sync separator cannot cope.',
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
        help: "Free-run drift of the receiver's horizontal oscillator away from 15.734 kHz. The PLL has to keep dragging it back, so the picture leans into a diagonal skew — and past the pull-in range it gives up and shears into diagonal bars.",
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
        help: 'How often the metal touches the board, on average, per second. 0 is off — the hand is not on it. On average is the point: the gaps between contacts are drawn fresh each time rather than counted off a clock, so two land together and then nothing happens for a second. A rate here reads as somebody working at the board; the same figure on the stab gate reads as a machine.',
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
        help: 'Which point inside the set the clip is bridging. Each one shorts a different circuit, so each one damages the picture in a different domain: **sync separator** takes away where the line starts, so the picture tears and takes hue with it; **vertical oscillator** collapses the scan toward a band and lets it spring back, with the picture decoded correctly throughout; **EHT / beam supply** droops the high-tension rail so the raster swells and the beam limiter hauls the drive down after it, late; **chroma demodulator** shorts the reference network, so the decoder stops trusting the burst and its two axes stop being 90° apart — hue shears without the picture moving at all; **video output stage** runs the guns out of headroom and stops the level loop catching it.',
      },
      {
        key: 'clipBite',
        id: 48,
        label: 'bite',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How far the short goes while the metal is down — a fingertip resting on a pin against a paperclip laid flat across it. The controls the point names travel this far toward the shorted state and back, from wherever they are resting, so a look already leaning that way has less distance to go and a bite lands softer on it.',
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
        help: "How long one contact lasts. Only that: how fast the damage arrives and clears is the receiver's business, not the clip's — a bite lands over two or three frames and takes five or six to let go, whether the metal was down for one frame or for half a second, because what is decaying is the flywheel finding sync again and the level loop finding the tip. Under about 40ms the contact is gone before the picture has finished reacting, so a short dwell is a flick that never reaches the full bite.",
      },
      {
        key: 'clipChatter',
        id: 50,
        label: 'chatter',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "How much the contact breaks up while it is down. Bare metal on a pin does not sit still — it bounces and scrapes, and each break takes the contact clean off rather than softening it. What stops that reading as a one-frame stutter is the set's own recovery: it takes five or six frames to let go of a short, so a single bounce inside a long contact dips the damage rather than cancelling it, and it takes a run of them to clear it entirely. Wound right up the clip is barely touching at all.",
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
        help: 'Bass energy detunes the vertical oscillator, so kick drums shove the frame vertically and it settles back. The picture lurches on the beat because the field rate is genuinely moving, not because anything is being animated.',
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
        help: 'Overall audio level pulls the horizontal oscillator off frequency, so loud passages skew and tear the picture sideways and it re-locks in the gaps. Negative leans the tear the other way.',
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
        help: 'Bass loads the high-voltage supply as if the beam were drawing current, so the scan collapses momentarily on each hit — the picture smacks inward and springs back. Needs supply ring (in Deflection) above zero to have a tank to disturb.',
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
        help: 'The audio waveform itself is patched into the horizontal deflection, one sample per scan line — literally drawing the oscilloscope trace of the sound into the geometry of the picture. Deflection-domain, so hue stays put while the glass bends.',
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
        help: 'Drives the audio into the high-voltage tank alongside the beam current, so the supply rings and wobbles with the music rather than just sagging. Needs bass → HV sag above zero.',
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
        help: 'The audio is patched straight into the video input, in IRE. Loud passages therefore land on the sync tips and the burst as well as the picture, so you get brightness bands, shifting colour and sync that tears — the classic wrong-cable-into-the-video-input result.',
      },
      {
        key: 'audioHueDeg',
        id: 55,
        label: 'waveform into hue',
        min: -180,
        max: 180,
        step: 1,
        unit: 'deg',
        help: "The audio waveform driven into the colour demodulator's reference oscillator, one sample per scan line — the same wire the tint control sits on, so the sound is turning the tint knob 15,734 times a second. Bass swings the whole picture's hue on the beat; anything with content up near line rate paints the hue in bands that dance down the frame. Since the reference is in the receiver, the bands stay on the glass while a rolling picture slides through them.",
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
        help: 'Input trim on the waveform routings — into deflection and into video in — which is how hard the raw sound drives the geometry and the composite line. The envelope routings (the two hold oscillators and HV sag) normalize against a decaying peak instead, so they ride any input level on their own and this trim does not move them, or the meter above.',
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
        help: "How far the tube's own scan is displaced sideways, in microseconds of line time. This is deflection-domain damage: the beam is bent after the picture has been decoded, so geometry warps but hue stays exactly where it was, and a rolling picture slides through a bend that stays put on the glass.",
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
        help: 'How that displacement is distributed down the frame: 0 flag (a hook at the top that decays away), 1 skew (a straight lean), 2 bow (a barrel-like curve), 3 ripple (a repeating wave down the screen).',
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
        help: 'How many scan lines the shape takes: the decay length for the flag hook, or the wavelength for the ripple. Short gives a tight buzz near the top; long stretches the shape across the whole frame.',
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
        help: "Vertical deflection amplitude — the service knob on the yoke. Below 1 the scan shrinks and the raster itself comes into view past the picture: the vertical interval with whatever is parked in it (VITS test lines, caption dashes, Macrovision's pulse trains), the head-switch band, and beam-off black beyond the retrace. Above 1 is overscan, which is how consumer sets actually shipped. Deflection-domain, so a rolling picture slides through the underscanned frame while the raster furniture stays put on the glass.",
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
        help: 'A bright picture draws beam current, which loads the high-voltage supply and lets the scan widen — so bright content stretches the geometry around it. It is why a white box on a tired tube bulges the image outward, and because it follows the content it moves with the picture.',
      },
      {
        key: 'hvRing',
        id: 43,
        label: 'supply ring (0 droop, 1 chaos)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How well damped that supply is. At 0 it droops smoothly and recovers; toward 1 the tank rings and overshoots, so a bright edge sets off a decaying wobble down the lines below it and hard content makes the geometry chaotic.',
      },
      {
        key: 'abl',
        id: 44,
        label: 'beam limiter',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The automatic beam limiter: the flyback can only source so much average beam current, so past a threshold the set pulls video drive down to protect it. The sense loop has a real time constant, so the dimming always lands after the bright content that caused it — and the knob undersizes the flyback while stripping the servo's damping, so wound up the correction overshoots and the whole picture pumps at a couple of Hz, a rhythm no content is writing. Inside either feedback loop the drive is part of the loop, so the servo and the loop beat instead of settling; it also throttles the very beam current HV sag integrates.",
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
        help: `How the TV separates brightness from colour, which share one
          wire.

          - **trap** — a notch filter. Cheap, and it mistakes fine detail for
            colour (rainbow fringing on stripes) and colour for detail (dot
            crawl on edges).
          - **2-line** and **3-line** — combs, which use the line-to-line
            subcarrier alternation to separate the two properly and largely kill
            both artifacts.`,
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
        help: 'Chroma crossing into the luma path, as if the Y and C wires were shorted. It defeats the separation, so the subcarrier itself appears in the picture as a dense moving dot pattern over anything coloured.',
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
        help: "The colour demodulator's low-pass, which decides how fast colour is allowed to change across a line. Real sets are around 0.5 MHz, which is why colour bleeds past its edges while brightness stays crisp — the eye barely notices, and broadcasters exploited it. Open it past about 1.5 and the passband stops being a colour filter and starts admitting luma detail, so every edge and every fine texture arrives as cross-colour and the picture rainbows wholesale.",
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
        help: 'Asymmetric colour smear, trailing to the right only. A symmetric filter blurs both ways; a lagging chroma path drags colour behind the edge, which is the direction real sets and tapes actually smear.',
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
        help: 'How coarsely the demodulated colour is sampled before being stretched back up. Coarse sampling lands on the subcarrier lattice at intervals, so moving detail rainbows in blocks — the cross-colour a cheap decoder makes of a striped shirt.',
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
        help: "The tint knob on the front of the set, which rotates the demodulator's reference against the incoming colour. Every hue turns together, so flesh goes green one way and magenta the other; at ±180 the reference is backwards and the picture comes out in complementary colour with its brightness untouched. Burst lock corrects the signal's phase errors, not this — the knob sits after the correction, which is why turning it never un-corrects itself.",
      },
      {
        key: 'burstLock',
        id: 25,
        label: 'burst lock',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How much the decoder trusts the colour burst it measured. At 1 it follows the burst, so phase errors in the incoming signal are corrected out; at 0 it ignores it and runs on its own crystal, so any subcarrier error shows up directly as wrong, drifting hue.',
      },
      {
        key: 'demodAxisDeg',
        id: 27,
        label: 'demod axis',
        min: 0,
        max: 180,
        step: 0.5,
        unit: 'deg',
        help: 'The angle between the set\'s two synchronous colour demodulators. They sit 90° apart only because the reference network says so — cheap sets used non-quadrature "X/Z" axes deliberately, and a drifted network lands anywhere. Unlike tint, this does not rotate the colour wheel, it shears it: hues that were opposite stop being opposite, so the picture keeps some of its colours and loses others. Wound down toward 0 both demodulators read the same phase and every hue collapses onto a single axis; past 90 the plane stretches and then folds through itself.',
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
        help: "The decoder's reference crystal pulled off 3.579545 MHz — the classic circuit-bend. The demodulation axis rotates continuously against the incoming colour, so hue sweeps the whole wheel at a rate set by how far off you are. Turn burst lock down to let it run.",
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
        help: 'The burst amplitude below which the set decides the broadcast is monochrome and shuts colour off entirely, in IRE. Raise it and anything that weakens the burst — noise, a dim signal, dropouts — makes colour cut in and out in patches.',
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
        help: "The time constant of the chroma AGC's control voltage, in scan lines of burst memory. At 0 the set corrects colour gain instantly per line, which no real ACC can; raised, gain and the colour killer answer burst damage tens of lines late, so colour blooms back after a dropout band instead of snapping, overshoots on a scene change, and a marginal burst makes the killer chatter in and out down the frame. With fed-back burst circulating in the mixer loop the lag turns into colour that pumps.",
      },
      {
        key: 'vir',
        id: 264,
        label: 'VIR correction',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How far the set trusts the reference stamped on line 19 of the vertical interval. A VIR receiver decoded that line, compared it against what it knew was sent, and trimmed its own hue and saturation until the two agreed — a closed loop around the demodulator, and one that is only ever as right as the reference arriving. Damage the signal above line 21 and the correction goes with it: the whole picture rotates toward whatever the reference was bent into, and a dub whose chroma the tape path has been eating a generation at a time comes back garish rather than washed out, because a weak reference is a set turning colour up. Needs the VBI test signals on to have anything to read.',
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
        help: 'The corrector’s time constant, in frames. Short and it chases the reference line by line, so damage that comes and goes makes the picture flicker; long is what a real corrector did — it answers over a second or more, which is why a reference that has been bent drags the whole frame somewhere wrong and leaves it there, and only walks back as slowly once the signal recovers.',
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
        help: 'How the RGB output amplifiers run out of headroom. At 0 the matrix is fitted back into gamut without moving the hue, which keeps overdriven colour vivid; at 1 the three guns simply hit their rails, and since they hit them one at a time the first to clip drags the hue toward the two still in range. Turn it up with chroma gain past 1 and saturated areas migrate toward the primaries as they blow out instead of holding their colour.',
      },
      {
        key: 'agc',
        id: 91,
        label: 'agc',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'How aggressively the receiver normalizes signal level off the sync tip. At 1 it corrects for weak or hot signals and holds contrast steady; at 0 the gain is fixed, so anything that changes signal amplitude changes picture brightness directly.',
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
        help: "Colour bandwidth at the encode end, before the signal is ever transmitted — the camera's own limit, as opposed to the decoder's. Wide enough and the chroma sidebands spill into the luma band and generate their own cross-colour.",
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
          actually received.

          What makes this different from putting words on a card: the caption
          is *data*, and it has been through everything the picture has. Snow,
          a narrow channel, tape noise and generation loss arrive as
          misspellings — dropped characters, wrong ones, a solid block wherever
          parity caught an error and the decoder refused to guess. Wind the
          tracking off and the caption dies before the picture does, because
          line 21 is at the top of the field where the band lands first.

          And it is painted on the set's raster rather than the signal's, which
          is where a real decoder paints: the page is redrawn on the set's own
          timing. So the picture can roll, tear and spin hue underneath a
          caption sitting perfectly still. It still bends with the tube and
          still blooms, because both of those happen after it.

          Needs vbi test signals on — that is the switch that puts line 21 on
          the wire at all.`,
      },
      {
        key: 'ccBox',
        id: 248,
        label: 'caption box',
        min: 0,
        max: 1,
        step: 0.05,
        unit: '',
        help: 'How black the box behind the characters is. Broadcast captions sat in a solid one because type keyed straight over picture is unreadable the moment the picture is bright — wind it out and you get exactly that problem, which is the one every set-top caption box had.',
      },
      {
        key: 'ccRomAddr',
        id: 249,
        label: 'rom address line',
        min: 0,
        max: 11,
        step: 1,
        unit: '',
        help: `A pin held high on the character generator's font ROM — the
          literal circuit bend, and a different thing from a bad feed.

          Which line decides everything, because of how the chip is addressed.
          The **low** lines carry the row inside the cell, so holding one makes
          every glyph repeat a scan line through itself and the whole font grows
          a seam. The **high** lines carry the character code, so holding one
          substitutes the entire font for its neighbour a fixed distance away in
          the ROM — text that keeps its length and its rhythm and comes out
          systematically wrong.

          Held rather than switched, the way a jumper does it, so a glyph whose
          bit was already set comes back untouched and the damage is uneven.
          Nothing here is random: the same text bends the same way every time,
          which is what tells a bent machine from a noisy wire.`,
      },
      {
        key: 'ccRomData',
        id: 250,
        label: 'rom data line',
        min: -8,
        max: 8,
        step: 1,
        unit: '',
        help: "The other bus. A font ROM's data lines are the eight dots across one row, so holding one lights or kills the same column of every character on the page — a stripe straight down the font rather than a fault in any one letter. Positive holds the line high, negative holds it low.",
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
        help: 'Holds the beam-blanking gate on, so the guns are cut for most of each cycle and let through in flashes. The gate sits one line above the phosphor, so the light already on the glass keeps decaying through the dark — set persistence long and the picture fades between flashes instead of cutting to black, cooling toward green as it goes. Everything downstream with memory sees the dark frames too, so the beam limiter opens up and surges on the first field back, and a feedback loop pumps at the strobe rate. Lock it to the beat with ♩.',
      },
      {
        key: 'strobeMs',
        id: 232,
        label: 'flash length',
        min: 1,
        max: 200,
        step: 1,
        unit: 'ms',
        help: 'How long the beam is let through each cycle. An absolute length rather than a share of the cycle, so speeding the strobe up does not shorten the flash with it — how hard the hit reads stays where you put it. Under one frame it is one frame, since a flash the display never samples is a picture that simply went dark.',
      },
      {
        key: 'scanBeam',
        id: 233,
        label: 'beam profile',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'The electron beam is a spot of finite height, so it does not quite fill the gap between scan lines. Raise this for a tighter spot and visible dark gaps — scanlines — and lower it for a fat spot that fills in like a well-used consumer set.',
      },
      {
        key: 'scanBloom',
        id: 234,
        label: 'beam bloom',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: "The spot grows with beam current, so bright lines are fatter than dark ones. Scanlines therefore show in the shadows and close up entirely in the highlights — which is why a real CRT's scanline structure appears and disappears with the picture.",
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
        help: 'How wide a spot the gun writes on the phosphor. The beam is a smooth blob, not a square, so light from one sample lands partly on its neighbours and every edge arrives as a ramp — unlike screen bloom this applies to dim picture too, which is what stops the image resolving into hard pixels. At 0 the samples are point-sharp.',
      },
      {
        key: 'crtGrain',
        id: 129,
        label: 'phosphor grain',
        min: 0,
        max: 1,
        step: 0.01,
        unit: '',
        help: 'The coating is a granular deposit of crystallites, so its emission is mottled rather than perfectly even. Fixed on the glass, so it does not crawl with the picture, and strongest in the mid tones — black grains have nothing to vary and fully driven ones have no headroom left.',
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
        help: 'How the sampled line is reconstructed into continuous light across the screen. Toward 0 is plain linear interpolation, which loses high frequencies; toward 1 is a cubic that stays flat past the subcarrier, so fine patterns hold instead of pumping as they move.',
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
        help: 'Consumer sets faked sharpness by patching differentiated luma into an extra deflection coil, slowing the beam through a dark-to-bright transition and speeding it through a bright-to-dark one. Emission follows dwell time, so light is moved across the edge rather than added: a white overshoot on one side, a black notch on the other. The asymmetry is the whole complaint people had about it. Negative wires the coil backwards and swaps which side glows.',
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
        help: 'How wide a span the differentiator looks across. Narrow gives a tight edge-liner on fine detail; wide reaches past the detail and starts shading whole objects, which is the point where it stops reading as sharpening and starts reading as relief.',
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
        help: `Which phosphors the tube is coated with — what its primaries
          actually are.

          - **sRGB** — no conversion.
          - **P22** — SMPTE-C, a normal colour TV.
          - **1953** — the wide NTSC primaries nobody ever built.
          - **green** — a long-persistence monochrome monitor.`,
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
        help: `How long the layer keeps glowing after the beam has passed. This
          is afterglow in the glass, not electronic feedback — the decay is
          second-order, so the bright core of a trail dumps almost all of itself
          at once and only the dim remainder hangs on.

          A real picture-tube phosphor is gone well inside one field, so
          anything you can actually *see* as a trail is already past P22 and
          into scope-tube territory. The top of the dial is where that lives;
          the middle is a hold of a field or two, which is enough to catch an
          arc strike or a sync tear that would otherwise be gone before you
          registered it.`,
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
        help: 'The three phosphors do not decay at the same rate — red and blue die faster than green. Raise this and trails tint green as they fade, which is the giveaway that you are looking at real persistence rather than a blend of frames.',
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
        help: 'Held light does not leave through the grain that emitted it — it scatters sideways through the layer and the glass, into phosphor that is still glowing itself. The spread therefore compounds along a trail: the fresh edge stays sharp while old light gets progressively wider and softer, instead of the tail being a stack of hard copies.',
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
        help: 'Strength of the shadow mask / aperture grille — the vertical stripes of R, G and B phosphor the beam actually lands on. Raise it and the picture is visibly built out of coloured stripes, as it is on the real glass up close.',
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
        help: 'Spacing of those phosphor triads in screen pixels. Fine pitch is a high-end monitor seen from a distance; coarse is a cheap tube with your nose against it. Pitches near a small whole number of pixels alias into moiré, exactly as photographing a CRT does.',
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
        help: 'Three guns fire through one mask from three different positions, so they can only be registered over part of the screen. Nulled in the middle and worsening toward the corners, which is why an old tube is sharp in the centre and fringes red and blue at the edges. Negative crosses the guns the other way. The magnifier shows it, because it is on the glass.',
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
        help: 'A patch of the shadow mask left magnetised — a speaker set too close, or a set moved without degaussing. The field bends all three beams together, but a triad is three dots 120° apart, so the same nudge over-excites the dot it moves toward and starves the one opposite. The stain turns hue across itself rather than tinting flat, and it is fixed on the glass, so a rolling picture travels through it.',
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
        help: 'Radius of the magnetised patch as a fraction of picture height. Small is a screwdriver left on the cabinet; large is a set that spent a year next to a loudspeaker.',
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
        help: 'Where your eye is, up against the glass. Everything that lives on the screen rather than in the image magnifies with it — scanline structure, the beam spot bleeding between samples, phosphor grain, the grille triads — so this is the way to see what the picture is actually built out of.',
      },
      {
        key: 'crtZoomX',
        id: 243,
        label: 'magnifier x',
        min: 0,
        max: 1,
        step: 0.005,
        unit: '',
        help: 'Which part of the glass is under the magnifier, across. Ignored at 1× since the whole screen is already in view.',
      },
      {
        key: 'crtZoomY',
        id: 244,
        label: 'magnifier y',
        min: 0,
        max: 1,
        step: 0.005,
        unit: '',
        help: 'Which part of the glass is under the magnifier, down. Ignored at 1× and below, where the whole screen is already in view.',
      },
      {
        key: 'timeScale',
        id: 245,
        label: 'slow motion (1 = realtime)',
        min: 0,
        max: 1,
        step: 0.01,
        unit: 'x',
        help: 'Steps the whole simulation at a fraction of display rate, like slowed footage of the rig: noise, rolls, sweeps, feedback loops and phosphor all crawl together, and 0 freezes the frame. Modulation stays live, so an LFO or audio envelope here warps time itself. Pair with a source’s own speed control, under its transport at the head of its stage, to slow the footage to match.',
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
        help: `Renders every second, third or fourth display refresh instead of
          chasing every one. A signal path that costs slightly more than a
          refresh interval otherwise wavers between full rate and half rate, and
          the wavering reads as stutter where a steady lower cadence reads as
          intentional.

          - **off** — chase every refresh, which is what a rig with headroom
            should do.
          - **1/2 rate**, **1/3 rate**, **1/4 rate** — a fixed cadence. The
            skipped refreshes do no work at all, so the lock never slows the rig
            further; but like slow motion, the simulation (modulation included)
            steps once per rendered frame, so rolls and noise crawl
            proportionally slower under one.
          - **auto** — watches the loop itself: sustained missed refreshes
            engage the half-rate lock, and it quietly retries full rate with a
            lengthening pause between attempts.`,
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
    'input A becoming a composite waveform — the encoder, the static generator, and the deck and cable this one signal arrives on',
  Mix: 'where the two signals meet — the mixer that beats them together, the wipe and the PiP inset. Needs a source B to do anything',
  Channel:
    'everything between the encoder and the aerial socket — the tape it was recorded on, the tuner it came through, and the cable it came down',
  Receiver:
    'a TV hunting for sync and decoding color from whatever arrives — hold, deflection, the decoder',
  Screen: 'the tube itself — beam profile, phosphor persistence, shadow mask',
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
  'the sound — a mic, a track, a clip’s own audio, or whatever this machine is playing — patched into the receiver: it detunes both hold oscillators, loads the HV supply, drives the deflection and turns the colour reference, so the picture moves because the set is being disturbed rather than because anything is animated'

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
  'the hand on the knobs: LFOs, drift, sample-and-hold and the audio envelope wiggling any control around wherever you left its slider, the beat they lock to, and the stab gate, which cuts the whole board between the look you are dialing and a second one — stock, or a look you held there. A slot is patched at the control it drives (the ∿ in any control row’s ⋮ menu); this is where the eight read as a bay'

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
  return Number(Math.min(def.max, Math.max(def.min, stepped)).toFixed(6))
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

// The carousel on the landing page: the app's own window, being used.
//
// The stage under the hero used to hold recordings of the *picture* — the same
// canvas-only clips the gallery cards play — beside one still screenshot of the
// app. So the one thing a stranger cannot work out from the page was the one
// thing nothing on it moved: what the program looks like to operate. A visitor
// arrived at a wall of analog damage with no window, no panel and no hand.
//
// These are recordings of the whole window, and each one is a sentence about
// the app rather than a look: here is the instrument, here is a control moving
// and the picture answering, here is the map the controls hang off. The picture
// stays the gallery's job, and the hero's.
//
// A slide is declarative, on the same terms as `docshot-specs.mjs`: a look, the
// panel state to open, and a timeline of beats to run while the shutter is
// going. `appreel.mjs` records them; `demogen.mjs` writes them into the page.
//
//   file     what the recording is called on disk, and in the markup.
//   name     the tab under the stage. Short — it is a button, beside others.
//   caption  one line under the stage, saying what is happening in it.
//   alt      what a reader who cannot see it is told, and what stands in for
//            the clip when the reader asked for reduced motion.
//   look     a demo from `demos.json`, by name, for slides that are one of the
//            looks the carousel shows. Resolved through `showcase`, so a look
//            reaching the carousel is still marked in the one place a demo is
//            written down — and a slide naming a look nobody flagged fails
//            here rather than recording the wrong board.
//   params   for slides that are not a demo: the app's own URL params, the way
//            a docshot spec says it. `src: 'cat'` is the bundled photograph,
//            which is what makes damage legible as damage.
//   seed     localStorage the app boots on, over `drive.mjs`'s SEED — which
//            stage is unfolded, and which group inside it.
//   warm     frames stepped before recording starts. A feedback look is mostly
//            history: it has to fill before the picture is the one the link
//            promises (`demoreel.mjs` carries the measurement).
//   act      the timeline. See `appreel.mjs` for the verbs; the rule that
//            matters is that a timeline **ends where it began**, because these
//            loop, and a cursor or an open stage that does not come home reads
//            as a cut.
import { showcase } from './demos.mjs'

// 3:2, and the width is the stage's own. The landing page's wide measure is
// 72rem inside 1.25rem gutters, so a slide is 1110 CSS pixels across on a big
// screen — recording at that width is what puts the app's type on the page at
// the size the app actually renders it, rather than a shrunken picture of a
// window. Anything wider reads as a screenshot of somebody else's monitor.
export const FRAME = { width: 1112, height: 742 }

// How long a beat runs. Each verb takes its seconds in its own field, so the
// timeline's arithmetic lives here rather than in the two places that need it —
// `appreel.mjs` plays a beat for this long, and the page advances the stage on
// the sum, because these are timelines of different lengths and a stage on a
// fixed clock cuts one of them off mid-drag.
export const beatSecs = beat =>
  beat.secs ?? beat.hold ?? beat.press ?? beat.away

// The look the two demonstration slides sit on: the bundled photograph through
// a tape path, off stock enough that the panel has lamps and counts to show,
// and left legible enough as a photograph that a control bending it reads as a
// control bending it.
const TAPE = {
  src: 'cat',
  set:
    'lumaMHz:2.6,lumaPeak:0.7,noiseIre:3,colorUnderMix:1,underJitterDeg:4,' +
    'dropoutRate:5,headSwitchNoise:0.35,headSwitchShiftUs:0.7,tbJitterNs:170,' +
    'tbWowNs:260,hvSagUs:2.4,hvRing:0.5,phosphor:0.22',
}

export const slides = [
  {
    file: 'window',
    name: 'The window',
    caption:
      'The picture fills the window. The panel holds the whole board — the look, the signal path, and the stage you have open on it.',
    alt: 'The videoskillet.js window: a rainbow-ringed synth pattern filling the picture area, and on the right the signal path map with the CHANNEL stage open on its recording controls',
    look: 'Ridiculous rainbow',
    seed: {
      video_feedback_open_phase: 'Channel',
      video_feedback_open_group: 'Recording (luma & FM)',
    },
    // A synth pattern through both loops: the picture is built out of its own
    // previous frames, and a clip armed early records the bloom instead of the
    // look.
    warm: 500,
    act: [{ hold: 7 }],
  },
  {
    file: 'control',
    name: 'One control',
    caption:
      'Chroma gain is the colour control on the set: how hard the demodulated chroma is amplified before the picture is drawn. Past 1 the saturation blooms and clips against the edge of the gamut — and it is the decoder doing that, not a filter over the photograph.',
    alt: "The window with the RECEIVER stage open on its decoder controls, chroma gain dragged to 12.8x, and the photograph's colour blooming and clipping into flat cyan and orange",
    params: TAPE,
    seed: {
      video_feedback_open_phase: 'Receiver',
      video_feedback_open_group: 'Decoder',
    },
    warm: 90,
    // Travel fractions rather than values, because the recorder reads the row's
    // own domain: chroma gain runs 0 to 16 and rests at 1, so 0.06 is where a
    // hand finds it and 0.8 is 12.8x, well past where the gamut runs out.
    act: [
      { hold: 0.5 },
      { scrollTo: { slider: 'chroma gain' }, secs: 0.9 },
      { moveTo: { slider: 'chroma gain' }, secs: 0.8 },
      { drag: { slider: 'chroma gain', to: 0.8 }, secs: 1.8 },
      { hold: 1.2 },
      { drag: { slider: 'chroma gain', to: 0.0625 }, secs: 1.1 },
      { away: 0.5 },
      // Back to the head of the panel, which is where the clip started: the
      // sidebar scrolls as one column, so reaching the decoder takes the
      // masthead off the top of the frame, and a loop has to put it back. The
      // row is named only to find the column it is in — `to` is where the
      // column ends up.
      { scrollTo: { slider: 'chroma gain' }, to: 0, secs: 0.7 },
    ],
  },
  {
    file: 'signal-path',
    name: 'The signal path',
    caption:
      'The map is the rig: two sources into a mixer, then the channel it is recorded and broadcast over, the receiver that decodes it and the screen it lands on. Click a stage and its controls open under it.',
    alt: 'The window with the signal path map at the head of the panel, the RECEIVER box pressed, and its stage unfolded underneath on the sync and decoder groups',
    params: TAPE,
    // Presets folded, which is the app's own resting state and also what keeps
    // the loop shut: opening a stage folds that section away to give the stage
    // the room, and closing the stage does not put it back — so a clip that
    // started with it open ended with it shut and jumped every time it came
    // round.
    seed: {
      video_feedback_sections: JSON.stringify({
        Presets: false,
        Scenes: false,
        'Sound into the picture': false,
      }),
    },
    warm: 90,
    act: [
      { hold: 0.6 },
      { moveTo: { stage: 'SOURCE A' }, secs: 0.7 },
      { press: 1.5, on: 'SOURCE A' },
      { moveTo: { stage: 'CHANNEL' }, secs: 0.6 },
      { press: 1.6, on: 'CHANNEL' },
      { moveTo: { stage: 'RECEIVER' }, secs: 0.6 },
      { press: 1.6, on: 'RECEIVER' },
      // Pressed again, which closes it: the map with nothing unfolded over it
      // is where this started, and a loop coming back to a different panel than
      // it left cuts.
      { press: 0.9, on: 'RECEIVER' },
      { away: 0.6 },
    ],
  },
].map(slide => {
  const query =
    slide.look === undefined
      ? `?${new URLSearchParams(slide.params)}`
      : showcase.find(demo => demo.name === slide.look)?.query
  if (query === undefined) {
    throw new Error(
      `reel slide “${slide.file}” plays ${slide.look}, which is not one of the demos marked showcase in demos.json`,
    )
  }
  return {
    ...slide,
    query,
    secs:
      Math.round(
        slide.act.reduce((total, beat) => total + beatSecs(beat), 0) * 10,
      ) / 10,
    // `clip` and `still` are page-relative and `poster` is not, for the reason
    // `demos.mjs` spells out: vite rewrites `src` and `poster` under this
    // project's relative base and has never heard of a data attribute, so a
    // root-absolute `data-src` would survive the build and 404 under a
    // sub-path.
    clip: `reel/${slide.file}.mp4`,
    still: `reel/${slide.file}.webp`,
    poster: `/reel/${slide.file}.webp`,
  }
})

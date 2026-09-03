// What the landing page plays: the carousel's recordings of the app's own
// window, and the hero's own encode of the clip behind the title.
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
import { hero, showcase } from './demos.mjs'

// 3:2, and the width is the stage's own. The landing page's wide measure is
// 72rem inside 1.25rem gutters, so a slide is 1110 CSS pixels across on a big
// screen — recording at that width is what puts the app's type on the page at
// the size the app actually renders it, rather than a shrunken picture of a
// window. Anything wider reads as a screenshot of somebody else's monitor.
export const FRAME = { width: 1112, height: 742, dpr: 1 }

// The same slides again, for a phone. A 1112px window scaled into a 356px
// column is a picture of an interface rather than an interface — the panel's
// type lands at 4px — and the app does not need faking on a phone: it has a
// portrait layout of its own (picture on top, panel as the scrolling remainder
// under it, `app.module.css`), which is worth showing.
//
// `dpr: 2` where the wide frame records at 1, because phones are all HiDPI and
// this frame is small enough to afford it: 780x1240 recorded, encoded down to
// 624x992, which is still 1.75x the 356 CSS pixels the stage gets on a 390px
// phone. The same treatment on the wide frame would be 2224x1484 to encode.
//
// `coarse` is what makes it the app's *phone* layout rather than a desktop
// window squeezed: Firefox reports `(pointer: coarse)` when told to, and the
// panel's rows grow to tap size the way they do on a handset.
//
// `at` is the one place the breakpoint is written down. `demogen.mjs` puts it in
// the `<source media>` of the stage's first still, and the page reads it back
// off that element rather than repeating it — so the shape of the box, the still
// the browser picks and the clip the script picks cannot disagree.
export const NARROW = {
  width: 390,
  height: 620,
  dpr: 2,
  out: { width: 624, height: 992 },
  coarse: true,
  at: '(max-width: 46rem)',
}

// The hero's copy of the first demo's clip, which is a different job from the
// gallery card's copy of it. The card plays it in a 300px tile; the hero plays
// it full-bleed behind display type at 55% opacity under a scrim that closes to
// the page colour — about a fifth of the picture survives to the screen. One
// file was serving both, and being the only clip fetched before a reader has
// scrolled anywhere, it was the heaviest thing on the page: 298K, against 114K
// for this, which is indistinguishable behind that scrim on a composited
// comparison. `demoreel.mjs` writes it beside the card's own clip.
export const heroBackdrop = {
  clip: hero.clip.replace(/\.mp4$/, '-hero.mp4'),
  poster: hero.poster,
  width: 480,
  height: 384,
  crf: 36,
}

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

// Pressed one after another, each unfolding its own bank, and the last one
// pressed twice so the panel comes back to the map it started on. Named because
// the portrait take runs it with a beat in front.
const MAP_WALK = [
  { hold: 0.4 },
  { moveTo: { stage: 'SOURCE A' }, secs: 0.6 },
  { press: 1.1, on: 'SOURCE A' },
  { moveTo: { stage: 'CHANNEL' }, secs: 0.5 },
  { press: 1.2, on: 'CHANNEL' },
  { moveTo: { stage: 'RECEIVER' }, secs: 0.5 },
  { press: 1.2, on: 'RECEIVER' },
  { press: 0.7, on: 'RECEIVER' },
  { away: 0.5 },
]

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
    // Short, because nothing in this slide happens: the panel sits still and the
    // picture loops. Seven seconds of it was the biggest file on the page and
    // said nothing the fourth second had not.
    act: [{ hold: 4.5 }],
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
      { hold: 0.4 },
      { scrollTo: { slider: 'chroma gain' }, secs: 0.8 },
      { moveTo: { slider: 'chroma gain' }, secs: 0.7 },
      { drag: { slider: 'chroma gain', to: 0.8 }, secs: 1.5 },
      { hold: 0.9 },
      { drag: { slider: 'chroma gain', to: 0.0625 }, secs: 0.9 },
      { away: 0.5 },
      // Back to the head of the panel, which is where the clip started: the
      // sidebar scrolls as one column, so reaching the decoder takes the
      // masthead off the top of the frame, and a loop has to put it back. The
      // row is named only to find the column it is in — `to` is where the
      // column ends up.
      { scrollTo: { slider: 'chroma gain' }, to: 0, secs: 0.6 },
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
    act: MAP_WALK,
    // In portrait the panel is the bottom half of a phone and the map starts
    // below its fold, so it is scrolled to first and everything after that is
    // the same walk.
    narrowAct: [{ scrollTo: { stage: 'SOURCE A' }, secs: 0.8 }, ...MAP_WALK],
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
  const narrowAct = slide.narrowAct ?? slide.act
  const length = act =>
    Math.round(act.reduce((total, beat) => total + beatSecs(beat), 0) * 10) / 10
  return {
    ...slide,
    query,
    narrowAct,
    secs: length(slide.act),
    narrowSecs: length(narrowAct),
    // `clip` and `still` are page-relative and `poster` is not, for the reason
    // `demos.mjs` spells out: vite rewrites `src` and `poster` under this
    // project's relative base and has never heard of a data attribute, so a
    // root-absolute `data-src` would survive the build and 404 under a
    // sub-path.
    clip: `reel/${slide.file}.mp4`,
    still: `reel/${slide.file}.webp`,
    poster: `/reel/${slide.file}.webp`,
    narrowClip: `reel/${slide.file}-narrow.mp4`,
    narrowStill: `reel/${slide.file}-narrow.webp`,
    narrowPoster: `/reel/${slide.file}-narrow.webp`,
  }
})

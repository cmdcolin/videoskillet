// What the landing page plays: the carousel's recordings of the app's own
// window.
//
// The stage under the hero used to hold recordings of the *picture* — the same
// canvas-only clips the gallery cards play — beside one still screenshot of the
// app. So the one thing a stranger cannot work out from the page was the one
// thing nothing on it moved: what the program looks like to operate. A visitor
// arrived at a wall of analog damage with no window, no panel and no hand.
//
// These are recordings of the whole window, and each one is a sentence about
// the app rather than a look: here is a picture built out of nothing, here is
// one button handing you three you did not build, here is the map the controls
// hang off.
//
// **The middle one used to be a fault dialled into clean bars**, and it was the
// weakest thing on the page: a slow bow in a colour bar, next to a gallery of
// looks somebody had already tuned. What the button does is the better sentence
// and the better picture, and it is now reproducible enough to record:
// `?seed=` (ui/useRollRand.ts) is what makes a take of somebody pressing random
// the same take next time.
//
// **The first two start on a bare load and get somewhere while you watch**,
// which is the whole point of them and took two wrong turns to arrive at. The
// slides used to run on the bundled photograph through a tape path, chosen
// because damage is legible on a cat — a stranger watching a slider bend a
// photograph has been shown that the program has sliders, and nothing else. So
// they were moved onto the looks the gallery lists, with one row of each wound
// back so a drag could arrive at it — and that is worse, because arriving at a
// picture somebody else already built is not building one. The board was
// ninety per cent of the way there before the clip started, and the drag took
// the credit.
//
// What is left is the honest version and it is also the better film: colour
// bars on stock controls, three rows raised in the order the mechanism runs,
// and a field of rainbow that was not there fifteen seconds ago. Nothing is
// loaded that the hand does not do.
//
// The photograph is back in the second slide, and against none of that. The
// objection is to a *slider* on a cat, which shows that the program has
// sliders; that slide's hand presses one button, so what the frame has to carry
// is how far three presses travel. Screened both ways over the same twelve
// seeds: on bars, three rolls read as three sets of bars in different colours,
// and on the photograph the same three are a torn print, a hard duotone and a
// warm dirty one.
//
// Which rows those are took a probe rather than a guess, and the two dead ends
// are worth keeping. Colour bars are already saturated, so chroma gain at 12x
// clips them back to almost the same bars — the photograph was in there for a
// reason. And the camera loop's `mix` and `gain` multiply, so a loop under
// unity decays to a dark wash however far the fader goes: what makes the
// picture breed rather than fade is the round trip sitting just over 1, which
// is what the group's own readout is there to say.
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
//   params   for slides that are not a demo at all: the app's own URL params,
//            the way a docshot spec says it.
//   seed     localStorage the app boots on, over `drive.mjs`'s SEED — which
//            stage is unfolded, and which group inside it.
//   stillAt  where along the timeline the poster frame is taken, as a fraction
//            of it, over `appreel.mjs`'s 0.55. A build wants the finish, not
//            the middle: the middle of one is a picture on the way to the one
//            the slide is about, and it is the whole of what a reader who asked
//            for reduced motion is shown.
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
//
// `dpr: 2` for the same reason the narrow frame has it, arrived at later: a
// slide is 1110 CSS pixels on a screen that is nearly always 2x, so recording
// at 1112 shipped every stage asset at half the resolution the display asked
// for and had the browser upscale it 2:1. The app's 11px panel type is where
// that showed. `out` is the recorded size, so nothing is scaled on the way
// out — the frames are already the pixels the page wants.
export const FRAME = {
  width: 1112,
  height: 742,
  dpr: 2,
  out: { width: 2224, height: 1484 },
}

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

// The hero used to run a clip behind the title — the first demo's look, in its
// own lighter encode, because it played full-bleed at 55% opacity under a scrim
// that closes to the page colour and about a fifth of the picture survived to
// the screen. It is a still now: a header that moves under a reader is a
// distraction from the words in front of it, and the moving account of this
// program belongs to the stage below, where it can be looked at.
//
// What is left of it lives in `demos.mjs` — the demo flagged `hero`, and its
// own gallery still, which `ogimage.mjs` grounds the link preview in too. There
// is nothing for this file to derive.

// How long a beat runs. Each verb takes its seconds in its own field, so the
// timeline's arithmetic lives here rather than in the two places that need it —
// `appreel.mjs` plays a beat for this long, and the page advances the stage on
// the sum, because these are timelines of different lengths and a stage on a
// fixed clock cuts one of them off mid-drag.
export const beatSecs = beat =>
  beat.secs ?? beat.hold ?? beat.press ?? beat.away

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
    file: 'build',
    name: 'From clean',
    caption:
      'Colour bars on stock controls, and four rows raised by hand. The camera loop is a lens on the tube’s face — opening it holds trails, and a few degrees of rotate winds them into a spiral. Then the mixer loop patches the composite itself back in, subcarrier and all, and the last row barely moves: a seventh of a microsecond of delay is half a turn of hue on every lap, which is where the colour comes from.',
    alt: 'A run through the app starting on clean colour bars: the camera feedback fader opened until the picture trails, its rotate wound a few degrees so the trails spiral, then the mixer loop patched in and its delay nudged off zero — the bars becoming a field of flowing green, magenta and blue',
    // Nothing. A bare load is the app's own near-blank board — stock controls,
    // colour bars on both sources — which is the only honest place a slide that
    // claims to build something can start.
    params: {},
    // The finish, not the middle: at 0.55 the poster was the loop half open,
    // which is the frame this slide exists to get past.
    stillAt: 0.9,
    // Nothing to fill: both loops are shut when the clip starts, and filling
    // them is the clip.
    warm: 60,
    // Four rows, each a fraction of its own travel because the recorder reads
    // the row's domain:
    //   mix         0..1, rests at 0 — the optical loop opening
    //   rotate      -180..180 on a 'zero' curve, so the row's own domain is
    //               travel and 0° sits mid-track. 0.73 is 6°
    //   loop mix    0..1, rests at 0 — the electrical loop
    //   loop delay  0..63us linear, rests at 0. 0.0022 is 0.14us
    //
    // **`loop delay` is the row the whole picture turns on, and it is the one
    // whose thumb does not visibly move.** Every variant screened without it is
    // a pale wash; with it the frame is flowing green and magenta. 0.14us on a
    // loop carrying its own subcarrier is half a turn of hue a lap, and it
    // lives in the first third of a per cent of a track that runs to 63us. The
    // readout and the picture are what say the drag happened.
    //
    // **The auto-iris is not in here any more, and that is a correction.** A
    // loop driven past unity latches: the frame saturates to white and stays
    // there, so the clip that raised `mix`, `zoom` and the iris spent five of
    // its sixteen seconds on a white field and finished on a smear. Held under
    // unity the optical loop only holds trails, and the colour is the electrical
    // loop's job.
    //
    // **What screened well and what recorded well are different questions, and
    // this is the trap to know about.** `contact.mjs` applies a board with
    // `?set=` at load, so every candidate it renders grows its loop from an
    // empty frame buffer — a transient that happens once and that no hand can
    // reproduce. A board that screened as a radial starburst recorded as a
    // horizontal smear, and it was not the ordering: all eight orders of the
    // same four rows land on the same wash. `pathprobe.mjs` is what screens a
    // timeline — it walks the rows at the timeline's own pace and grabs the
    // canvas at the end, seconds a variant against ninety for a take.
    act: [
      { hold: 0.7 },
      { moveTo: { stage: 'camera' }, secs: 0.6 },
      { press: 0.8, on: 'camera' },
      { moveTo: { slider: 'mix' }, secs: 0.5 },
      { drag: { slider: 'mix', to: 0.7 }, secs: 1.3 },
      { moveTo: { slider: 'rotate' }, secs: 0.4 },
      { drag: { slider: 'rotate', to: 0.73 }, secs: 1.3 },
      { hold: 0.8 },
      { scrollTo: { stage: 'camera' }, secs: 0.5 },
      { moveTo: { stage: 'mixer' }, secs: 0.5 },
      { press: 0.8, on: 'mixer' },
      { moveTo: { slider: 'loop mix' }, secs: 0.5 },
      { drag: { slider: 'loop mix', to: 0.95 }, secs: 1.4 },
      { moveTo: { slider: 'loop delay' }, secs: 0.4 },
      { drag: { slider: 'loop delay', to: 0.0022 }, secs: 0.9 },
      { hold: 2 },
      { away: 0.5 },
    ],
    // In portrait the panel is the bottom half of a phone and the map starts
    // below its fold, so it is scrolled to before anything is pressed on it.
    narrowAct: [
      { hold: 0.5 },
      { scrollTo: { stage: 'camera' }, secs: 0.7 },
      { moveTo: { stage: 'camera' }, secs: 0.6 },
      { press: 0.8, on: 'camera' },
      { scrollTo: { slider: 'mix' }, secs: 0.5 },
      { moveTo: { slider: 'mix' }, secs: 0.5 },
      { drag: { slider: 'mix', to: 0.7 }, secs: 1.3 },
      { moveTo: { slider: 'rotate' }, secs: 0.4 },
      { drag: { slider: 'rotate', to: 0.73 }, secs: 1.3 },
      { hold: 0.8 },
      { scrollTo: { stage: 'camera' }, secs: 0.5 },
      { moveTo: { stage: 'mixer' }, secs: 0.5 },
      { press: 0.8, on: 'mixer' },
      { scrollTo: { slider: 'loop mix' }, secs: 0.5 },
      { moveTo: { slider: 'loop mix' }, secs: 0.4 },
      { drag: { slider: 'loop mix', to: 0.95 }, secs: 1.4 },
      { moveTo: { slider: 'loop delay' }, secs: 0.4 },
      { drag: { slider: 'loop delay', to: 0.0022 }, secs: 0.9 },
      { hold: 2 },
      { away: 0.5 },
    ],
  },
  {
    file: 'roll',
    name: 'Random',
    caption:
      'One button, pressed three times. Each press stacks a few of the authored looks over stock and travels to the result in a second — so it is a way of looking around the space rather than a shuffle, and the preset chips light up to say what went into the one you are looking at. Press it again from wherever you land.',
    alt: 'The window on the bundled photograph of a cat, and the random look button pressed three times: the picture becomes a torn scanline mess, then a hard orange and teal, then a warm dirty print, each arriving over a second',
    // The photograph rather than the colour bars the other two slides open on.
    // A roll is legible on a face and abstract on bars — the same reason the
    // app ships this picture — and it is the picture a stranger has that the
    // page has been claiming things about.
    //
    // `seed` in the query is the app's, not this file's: `?seed=` puts the
    // session's rolls on one generator (ui/useRollRand.ts), so this take is the
    // take the next recording gets too. Screened over seeds 1-12 for three
    // rolls that each leave a picture you can still read: most seeds spend at
    // least one press on a white blow-out or a grey wash, which says nothing
    // about what the button is for.
    params: { src: 'cat', seed: 7 },
    // The second roll, which is the loudest of the three. The finish is a warm
    // print that reads as a photograph somebody has been unkind to, and as a
    // still it understates the button.
    stillAt: 0.62,
    warm: 60,
    // Three presses on one button, and the pointer never leaves it. Each is
    // followed by the second the morph takes to travel plus a beat to look at
    // where it landed — a press whose picture is still moving when the next one
    // lands reads as one long smear rather than as three looks.
    act: [
      { hold: 0.8 },
      { moveTo: { text: 'random look' }, secs: 0.7 },
      { press: 2.6, on: 'random look' },
      { press: 2.6, on: 'random look' },
      { press: 3, on: 'random look' },
      { away: 0.5 },
    ],
    // In portrait the look bar is under the picture with the panel, so it is
    // scrolled to before the pointer goes anywhere near it.
    narrowAct: [
      { hold: 0.6 },
      { scrollTo: { text: 'random look' }, secs: 0.7 },
      { moveTo: { text: 'random look' }, secs: 0.7 },
      { press: 2.6, on: 'random look' },
      { press: 2.6, on: 'random look' },
      { press: 3, on: 'random look' },
      { away: 0.5 },
    ],
  },
  {
    file: 'signal-path',
    name: 'The signal path',
    caption:
      'The map is the rig: two sources into a mixer, then the channel it is recorded and broadcast over, the receiver that decodes it and the screen it lands on. Click a stage and its controls open under it.',
    alt: 'The window with the signal path map at the head of the panel, the RECEIVER box pressed and its stage unfolded underneath, over a picture of a bright scanline arch bending across the frame in red and green fringes',
    // The backdrop, and it is doing a job: the map walk is the content, so what
    // is behind it only has to be worth looking at for seven seconds. It used
    // to be `Fuzzy color bars feedback`, which is a soft brown smear that never
    // changes — 12K a second of encode against the other two slides' 57K, which
    // is the file size saying the same thing. This one is the gallery's own
    // first look, it carries two mod wires, and it moves.
    look: 'Wiggity',
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
    warm: 200,
    act: MAP_WALK,
    // In portrait the panel is the bottom half of a phone and the map starts
    // below its fold, so it is scrolled to first and everything after that is
    // the same walk.
    narrowAct: [{ scrollTo: { stage: 'SOURCE A' }, secs: 0.8 }, ...MAP_WALK],
  },
].map(slide => {
  const board =
    slide.look === undefined
      ? `?${new URLSearchParams(slide.params)}`
      : showcase.find(demo => demo.name === slide.look)?.query
  if (board === undefined) {
    throw new Error(
      `reel slide “${slide.file}” plays ${slide.look}, which is not one of the demos marked showcase in demos.json`,
    )
  }
  const query = board
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

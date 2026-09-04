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
// the app rather than a look: here is one button handing you three looks you
// did not build, here is the map the controls hang off, here is a picture built
// out of nothing.
//
// **The order is that of what says analog first.** `build` opened the stage
// until it was demoted, and the reason was what it arrived at then: a soft
// field of flowing rainbow, which is the one frame on this page a stranger can
// read as a shader rather than as a television. `roll` puts a board already
// torn into hard black and white slabs in the first frame, which needs no
// caption to read as a television coming apart, so it opens the reel and
// `build` finishes it — on a photograph now, with a ring-modulated loop carving
// colour along the subject's edges, which is a picture of a signal path doing
// something to a picture rather than a shader doing something to a field.
//
// **`roll` used to be the middle slide, and before that it was a fault dialled
// into clean bars**, which was the weakest thing on the page: a slow bow in a
// colour bar, next to a gallery of looks somebody had already tuned. What the
// button does is the better sentence and the better picture, and it is now
// reproducible enough to record: `?seed=` (ui/useRollRand.ts) is what makes a
// take of somebody pressing random the same take next time.
//
// **`roll` and `build` both start on a bare load and get somewhere while you
// watch**, which is the whole point of them and took two wrong turns to arrive
// at. The slides used to run on the bundled photograph through a tape path,
// chosen because damage is legible on a cat — a stranger watching a slider bend
// a photograph has been shown that the program has sliders, and nothing else. So
// they were moved onto the looks the gallery lists, with one row of each wound
// back so a drag could arrive at it — and that is worse, because arriving at a
// picture somebody else already built is not building one. The board was
// ninety per cent of the way there before the clip started, and the drag took
// the credit.
//
// What is left is the honest version: a picture on stock controls, the rows
// raised in the order the mechanism runs, and a look that was not there fifteen
// seconds ago. Nothing is loaded that the hand does not do. The picture is the
// bundled photograph again — `build` ran on colour bars for a while, and the
// camera loop it opened there was demoted for being dull, so the argument
// against the photograph (a slider bending a cat shows only that there are
// sliders) gave way to the one for it: the ring loop it builds now is keyed on
// the live picture, and a look that carves along a subject's edges needs a
// subject to carve.
//
// **`roll` ran on the bundled photograph for a while, and does not now.** The
// argument for it was legibility: a roll is legible on a face and abstract on
// bars, screened both ways over twelve seeds, where three rolls on bars read as
// three sets of bars in different colours and the same three on the photograph
// were a torn print, a hard duotone and a warm dirty one. What that argument
// did not cover is that this is the frame the page opens on, and a cat is a
// picture of a cat before it is a picture of a signal path coming apart. So the
// slide runs on a feedback board instead, and the legibility it gives up it
// buys back in what the first frame says about the program.
//
// Which rows a slide pulls took a screen rather than a guess, and the dead ends
// are worth keeping. Colour bars are already saturated, so chroma gain at 12x
// clips them back to almost the same bars. The camera loop's `mix` and `gain`
// multiply, so a loop under unity decays to a dark wash however far the fader
// goes, and one over it latches white: the round trip the group's readout
// prints is the number that matters. And a probe that steps the engine with no
// wall clock between frames (`pathprobe.mjs`) lands a feedback loop somewhere
// the recorded take never goes, so a feedback slide is screened by recording
// it (`appreel.mjs --slides= --takes=wide`) and looking.
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

// Two stages pressed, and every press is followed by a row pulled. The walk
// used to open SOURCE A, CHANNEL and RECEIVER in turn to show that a stage
// opens under its box, and Colin watching it said what a stranger would: "i
// dont understand the recording that just clicks on source, channel, receiver
// ... it should be changing settings in interesting ways". So the presses that
// lead nowhere are gone and the ones that stay are the way to a slider.
//
// **Which rows took a screen, and the first answer was the wrong one.** The
// receiver opens on its Sync bank, and the pair in reach there — `vertical
// hold` let go, `vertical osc` detuned — rolls the frame three times over the
// beat that follows. Legible, and unwatchable: a picture tumbling at field
// rate is the one thing a landing page must not loop. `blanking strobe` is
// out on the same ground. So the hand opens banks the stages did not, which
// is a truer picture of the panel anyway: the banks under a stage are an
// accordion, and a header is a press like any other.
//
// Screened over fifty rows on this look (`candidates.sync.mjs` and the channel
// after it, through `pathprobe.mjs`): ghost gain, hum and an open termination
// white the frame out, noise and peaking bury it in snow, phosphor persistence
// washes it, the MIX rows do nothing because B is genlocked here, and bend
// amount is already on a Lorenz wire so a hand on it reads as nothing. `v
// size` and `HV sag` were in and came out — "did not do anything interesting"
// and "we demonstrate hv sag repeatedly", and both are right. What stays
// changes the picture without flashing it. In the channel's Timebase bank,
// `flutter` shimmies every line sideways and `sticky shed` — tape binder
// grabbing the head drum — leans the stripes into shear bands that snap back.
// Then the receiver's `tint` turns the hue of all of it.
const MAP_WALK = [
  { hold: 0.4 },
  { moveTo: { stage: 'CHANNEL' }, secs: 0.6 },
  { press: 0.8, on: 'CHANNEL' },
  { scrollTo: { section: 'Timebase' }, secs: 0.5 },
  { moveTo: { section: 'Timebase' }, secs: 0.4 },
  { press: 0.7, on: 'Timebase' },
  { scrollTo: { slider: 'flutter' }, secs: 0.4 },
  { moveTo: { slider: 'flutter' }, secs: 0.4 },
  { drag: { slider: 'flutter', to: 0.7 }, secs: 1.2 },
  { moveTo: { slider: 'sticky shed' }, secs: 0.4 },
  { drag: { slider: 'sticky shed', to: 0.5 }, secs: 1.2 },
  { hold: 1 },
  { scrollTo: { stage: 'CHANNEL' }, secs: 0.5 },
  { moveTo: { stage: 'RECEIVER' }, secs: 0.5 },
  { press: 0.8, on: 'RECEIVER' },
  { scrollTo: { section: 'Decoder' }, secs: 0.5 },
  { moveTo: { section: 'Decoder' }, secs: 0.4 },
  { press: 0.7, on: 'Decoder' },
  { scrollTo: { slider: 'tint' }, secs: 0.4 },
  { moveTo: { slider: 'tint' }, secs: 0.4 },
  { drag: { slider: 'tint', to: 0.85 }, secs: 1.2 },
  { hold: 1.6 },
  // Home on the morph rather than by dragging back: undo travels the same
  // second-long glide a roll arrives on, so each row settles out of the picture
  // instead of being yanked out of it — and the board is stock again, which is
  // what lets this run round without a jump. Three drags, three presses.
  //
  // Scrolled to first, because the toolbar it lives in is the top of the panel
  // and the rows just dragged are most of a phone below it: the portrait take
  // reached for `undo` at y=-43 and the recorder said there was nothing under
  // the pointer, which there was not.
  { scrollTo: { text: 'undo' }, secs: 0.5 },
  { moveTo: { text: 'undo' }, secs: 0.4 },
  { press: 1, on: 'undo' },
  { press: 1, on: 'undo' },
  { press: 1.3, on: 'undo' },
  { scrollTo: { stage: 'RECEIVER' }, secs: 0.5 },
  { moveTo: { stage: 'RECEIVER' }, secs: 0.4 },
  { press: 0.7, on: 'RECEIVER' },
  { away: 0.5 },
]

export const slides = [
  {
    file: 'roll',
    name: 'Random',
    caption:
      'The roll that keeps what you have. Random nudge takes the look already on the board and moves every control around where it sits, so pressing it again goes further out instead of starting over — two presses and the picture is somewhere nobody would have thought to dial. The caret holds the rest of the row: a whole fresh look, one authored preset, a single nameable fault.',
    alt: 'The window on a black and white feedback look already torn into hard blocks, and random nudge picked from the roll menu and pressed twice: the picture goes further out with each press rather than starting over, ending in a frame of chroma noise nothing in it is still upright',
    // A board that is already unstable, rather than the bundled photograph this
    // opened on. The picture a roll lands on is only as wild as the thing it
    // lands *in*: `randomPresetMix` is bounded on purpose — two presets usually,
    // feedback loops as leads only, because unbounded rolls blew a picture out
    // about one time in eight (presets.ts) — so on a flat source the same
    // presses read as tinted test cards. Screened against colour bars mixed with
    // tv static, and against sweep and synth, all of which came back as exactly
    // that.
    look: 'Chaos black and white feedback',
    // `seed` is the app's, not this file's: `?seed=` puts the session's rolls on
    // one generator (ui/useRollRand.ts), so this take is the take the next
    // recording gets too.
    params: { seed: 2 },
    // The last nudge, which is where this take is loudest. Measured rather than
    // guessed: the four presses finish at 0.63 of the timeline and the undos
    // walk back down from there, so the 0.85 this sat at while the slide ran
    // three presses now lands mid-way home — a poster of the picture coming
    // apart *less*, which is the one thing the still must not say.
    stillAt: 0.63,
    warm: 60,
    // **Nudge rather than `random look`, and that is the whole slide.** A
    // `random look` rebuilds from stock every press — `landRecipe` lands its
    // roll on `DEFAULT_CONTROLS` (ui/useMix.ts) — so a run of them walks *away*
    // from a wild board rather than further into it. Recorded three times over
    // nine seeds it decayed the same way every time: the frame store carries the
    // feedback for a press or two, and by the third the board is stock over
    // source A, which on this look is colour bars. Six seeds, six test cards.
    // Pointing source A at tv static fixed the ending and cost the colour —
    // stock over noise is a grey wash.
    //
    // `mutateLook` baselines on `getControls()` instead, so a nudge compounds:
    // press it on chaos and you get more chaos, which is the sentence this slide
    // has to say. It is also the way the app is actually used — mutate, mutate,
    // surprise, mutate (ui/history.ts).
    //
    // The menu is worth the two beats it costs. Picking a roll runs it *and*
    // leaves it on the button, so the two presses after it are one press each,
    // and the caret says out loud that the row has five other ways to roll.
    act: [
      { hold: 1 },
      { moveTo: { title: 'the other ways this row has' }, secs: 0.6 },
      { press: 1, on: '▾' },
      { moveTo: { text: 'random nudge' }, secs: 0.6 },
      // The menu row reads `≈random nudge` — a row carries its icon in its text
      // where the button carries the label alone, so this is the same target
      // asserted two ways rather than a typo.
      { press: 2.2, on: '≈random nudge' },
      // Back to the button the menu just loaded: the pointer is over where the
      // menu row was, and the row is gone.
      { moveTo: { text: 'random nudge' }, secs: 0.5 },
      { press: 2, on: 'random nudge' },
      { press: 2, on: 'random nudge' },
      { press: 2.2, on: 'random nudge' },
      // Four presses out and four back. Undo travels on the same morph a roll
      // arrives on, so the way home is the same second-long glide as the way
      // out and the picture walks itself back through the looks it came
      // through — which is the loop this slide needed anyway (`act`, above:
      // a timeline ends where it began, because these run round).
      { moveTo: { text: 'undo' }, secs: 0.6 },
      // **Three, for four nudges.** The fourth press landed on an `undo` that
      // had already greyed out — measured off the take, where the button's
      // label sits at 39 while it is live, dips as each of three presses lands,
      // then holds a dead 28.7 through a fourth that does nothing. The menu's
      // own pick rolls the look *and* arms the button, and it is the one that
      // leaves no step behind it. Worth knowing that `on:` cannot catch this: a
      // disabled button still reads `undo`, so the assertion passes and the
      // clip records a hand pressing nothing.
      { press: 1.3, on: 'undo' },
      { press: 1.3, on: 'undo' },
      { press: 2.2, on: 'undo' },
      { away: 0.5 },
    ],
    // In portrait the look bar is under the picture with the panel, so it is
    // scrolled to before the pointer goes anywhere near it.
    narrowAct: [
      { hold: 0.8 },
      { scrollTo: { text: 'random look' }, secs: 0.7 },
      { moveTo: { title: 'the other ways this row has' }, secs: 0.6 },
      { press: 1, on: '▾' },
      { moveTo: { text: 'random nudge' }, secs: 0.6 },
      { press: 2.2, on: '≈random nudge' },
      { moveTo: { text: 'random nudge' }, secs: 0.5 },
      { press: 2, on: 'random nudge' },
      { press: 2, on: 'random nudge' },
      { press: 2.2, on: 'random nudge' },
      { moveTo: { text: 'undo' }, secs: 0.6 },
      // **Three, for four nudges.** The fourth press landed on an `undo` that
      // had already greyed out — measured off the take, where the button's
      // label sits at 39 while it is live, dips as each of three presses lands,
      // then holds a dead 28.7 through a fourth that does nothing. The menu's
      // own pick rolls the look *and* arms the button, and it is the one that
      // leaves no step behind it. Worth knowing that `on:` cannot catch this: a
      // disabled button still reads `undo`, so the assertion passes and the
      // clip records a hand pressing nothing.
      { press: 1.3, on: 'undo' },
      { press: 1.3, on: 'undo' },
      { press: 2.2, on: 'undo' },
      { away: 0.5 },
    ],
  },
  {
    file: 'signal-path',
    name: 'The signal path',
    caption:
      'The map is the rig: two sources into a mixer, then the channel it is recorded and broadcast over, the receiver that decodes it and the screen it lands on. Click a stage and its controls open under it. In the channel, flutter shimmies the timebase and sticky shed is the tape grabbing the head drum, so the stripes shear and snap back. In the receiver, tint turns the colour of all of it — then undo walks it home.',
    alt: 'The window with the signal path map at the head of the panel: the CHANNEL box pressed, flutter dragged until every line of the scanline arch shimmies sideways and sticky shed dragged until it shears into leaning bands, then the RECEIVER box pressed, its Decoder bank opened and tint dragged so the orange bands turn violet — and undo walking it back',
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
    narrowAct: [{ scrollTo: { stage: 'CHANNEL' }, secs: 0.8 }, ...MAP_WALK],
  },
  {
    file: 'build',
    name: 'From clean',
    caption:
      'A photograph on stock controls, and seven rows of the mixer loop raised by hand. The return is synced and the loop opened, its gain eased under unity and its delay stretched so each lap comes back a little further round the hue wheel. Then the loop is keyed on the live picture and multiplied against it — a ring modulator with one input on the machine’s own past — and the trails grow in colours nothing in the room is, cut off crisply at the subject’s edge.',
    alt: 'A run through the app starting on a clean photograph of a cat on a red chair: the mixer loop opened row by row — frame sync, loop mix, loop gain, loop delay, loop key, key input on program, loop ring mod — until rainbow trails grow sideways out of the fur and the window blinds while the chair stays photographic',
    // **The bundled photograph, and a hand-built ring loop.** This slide used to
    // open the camera loop and then the mixer loop on colour bars and finish on a
    // soft field of flowing rainbow, and Colin's verdict on the take was the
    // right one: "for all the time spent with this camera feedback and mixer
    // feedback combo, it looks very boring". Three rows added after the loops
    // — `loop delay` at a third of a per cent, `FM over-deviation`, `beam
    // bloom` — read as nothing at all, and every tail screened in their place
    // either greyed the loop out (anything in the channel that disturbs timing:
    // sticky shed, wow, tracking) or was a non-event (zoom, HV sag on a soft
    // field).
    //
    // So the slide builds one of the looks the app is actually good at: the
    // ring-modulated loop, `carved by the live picture` (presets.ts), picked off
    // a contact sheet of every ring preset rendered on the photograph. Damage
    // is legible on a picture of something, and the photograph is a Commons
    // image already bundled, so the take is the same take next time where a
    // live Commons pick would not be.
    //
    // **Seven rows, and two of them looked too small to matter and were not.**
    // A five-row build (mix, key, key input, ring, sync) blew the cat out to a
    // white field; `loop gain` eased to 0.92 and `loop delay` stretched to
    // 1.1us are what hold it just under unity — the bank's own readout says so:
    // "round trip 0.85x · just under — trails hold, structure does not build".
    // The delay is a fifth of a per cent of its track and its thumb barely
    // moves, but its readout goes 0.15us to 1.10us and without it the loop
    // latches white. `frame sync` goes first rather than last: raised at the
    // end, after the loop had run unsynced for ten seconds, the return's tear
    // stayed in the frame store as a black block wandering through the rest
    // of the take. Synced before the loop opens, there is nothing to tear.
    params: { src: 'cat' },
    stillAt: 0.9,
    warm: 60,
    act: [
      { hold: 0.8 },
      { moveTo: { stage: 'mixer' }, secs: 0.6 },
      { press: 0.8, on: 'mixer' },
      { scrollTo: { slider: 'frame sync' }, secs: 0.5 },
      { moveTo: { slider: 'frame sync' }, secs: 0.4 },
      { drag: { slider: 'frame sync', to: 1 }, secs: 0.9 },
      { scrollTo: { slider: 'loop mix' }, secs: 0.5 },
      { moveTo: { slider: 'loop mix' }, secs: 0.4 },
      { drag: { slider: 'loop mix', to: 0.92 }, secs: 1.3 },
      { moveTo: { slider: 'loop gain' }, secs: 0.4 },
      { drag: { slider: 'loop gain', to: 0.653 }, secs: 0.8 },
      { moveTo: { slider: 'loop delay' }, secs: 0.4 },
      { drag: { slider: 'loop delay', to: 0.0175 }, secs: 0.8 },
      { scrollTo: { slider: 'loop key' }, secs: 0.4 },
      { moveTo: { slider: 'loop key' }, secs: 0.4 },
      { drag: { slider: 'loop key', to: 1 }, secs: 1.1 },
      { moveTo: { choice: { row: 'key input', pick: 'program' } }, secs: 0.4 },
      { press: 0.7, on: 'program' },
      { scrollTo: { slider: 'loop ring mod' }, secs: 0.4 },
      { moveTo: { slider: 'loop ring mod' }, secs: 0.4 },
      { drag: { slider: 'loop ring mod', to: 1 }, secs: 1.3 },
      { hold: 3.5 },
      { away: 0.5 },
    ],
    // In portrait the panel is the bottom half of a phone and the map starts
    // below its fold, so it is scrolled to before anything is pressed on it;
    // every row after that scrolls to itself.
    narrowAct: [
      { hold: 0.5 },
      { scrollTo: { stage: 'mixer' }, secs: 0.7 },
      { moveTo: { stage: 'mixer' }, secs: 0.6 },
      { press: 0.8, on: 'mixer' },
      { scrollTo: { slider: 'frame sync' }, secs: 0.5 },
      { moveTo: { slider: 'frame sync' }, secs: 0.4 },
      { drag: { slider: 'frame sync', to: 1 }, secs: 0.9 },
      { scrollTo: { slider: 'loop mix' }, secs: 0.5 },
      { moveTo: { slider: 'loop mix' }, secs: 0.4 },
      { drag: { slider: 'loop mix', to: 0.92 }, secs: 1.3 },
      { moveTo: { slider: 'loop gain' }, secs: 0.4 },
      { drag: { slider: 'loop gain', to: 0.653 }, secs: 0.8 },
      { moveTo: { slider: 'loop delay' }, secs: 0.4 },
      { drag: { slider: 'loop delay', to: 0.0175 }, secs: 0.8 },
      { scrollTo: { slider: 'loop key' }, secs: 0.4 },
      { moveTo: { slider: 'loop key' }, secs: 0.4 },
      { drag: { slider: 'loop key', to: 1 }, secs: 1.1 },
      { moveTo: { choice: { row: 'key input', pick: 'program' } }, secs: 0.4 },
      { press: 0.7, on: 'program' },
      { scrollTo: { slider: 'loop ring mod' }, secs: 0.4 },
      { moveTo: { slider: 'loop ring mod' }, secs: 0.4 },
      { drag: { slider: 'loop ring mod', to: 1 }, secs: 1.3 },
      { hold: 3.5 },
      { away: 0.5 },
    ],
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
  // A slide that names a look can still carry params of its own, and `roll`
  // does: `?seed=` belongs to the take rather than to the demo — it is which
  // rolls the button hands back, which is a fact about this recording, where
  // the board is a fact about the look. Keeping them apart is what lets the
  // demo stay written down once while the take stays reproducible.
  const query =
    slide.look === undefined || slide.params === undefined
      ? board
      : `${board}&${new URLSearchParams(slide.params)}`
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

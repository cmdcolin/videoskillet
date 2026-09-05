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
// **Every slide runs on the bundled photograph now, on stock controls.** Three
// of them did before this, and `roll` ran on a black and white feedback board
// so that the frame the page opens on would read as a television coming apart
// rather than as a cat. What that bought was slabs, nudged: Colin's read on the
// reel was that all four were weak — "the 'nudge' is too minor of a change",
// the presets "go over the same settings sort of repeatedly", the map walk's
// "results are not that interesting", and the build "stops too soon" on
// "dark and muddy colors rather than bright vibrant crazy rainbows". A
// photograph is what makes colour nothing in the room is read as colour put
// there, and a clean one is what makes every press and drag read as the thing
// that changed the picture. Where the slides were then screened is in the notes
// on each timeline below; the instrument was a probe that drives the app the
// way `appreel.mjs` does and grabs the canvas at checkpoints.
//
// **Things have to combo.** The rows that read on their own on a still are few
// and generic — HV sag on a clean photograph is a wobble — and the same rows on
// a picture already scrambled or already rainbow are the slide. Every timeline
// here is ordered so that each pull lands on what the last one did.
//
// **The hand moves fast.** A beat is a fraction of a second: a glide onto a
// control is 0.2-0.35s, a press dwells 0.4s, a drag takes 0.5-0.7s, and the
// only long holds are the ones a feedback loop needs to lap. The reel ran
// twice as long as this and Colin's note on it was the whole brief: "people
// are very fast visual learners, they can see things happen quickly so dont
// dawdle and move dials and click buttons in relatively quick succession".
// `appreel.mjs` records at real time for the same reason.
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

// Two stages pressed and every press followed by rows pulled, and **every pull
// lands on a picture the last one already changed.** The walk used to open
// SOURCE A, CHANNEL and RECEIVER in turn to show that a stage opens under its
// box, and Colin watching it said what a stranger would: "i dont understand the
// recording that just clicks on source, channel, receiver ... it should be
// changing settings in interesting ways". Its second version pulled flutter,
// sticky shed and tint on the gallery's first look, and read as a beige arch
// shimmying: "the results are not that interesting".
//
// What decided this version is a note on the sheet it was picked from: "some of
// the settings like hv sag look a bit generic when applied without anything
// else interesting going on ... so things need to combo well". Screened one row
// at a time on the photograph (thirty-six rows, `v-rows` in the 2026-09-04
// session), most of the panel reads as nothing on a still: grille, convergence,
// purity, phosphor, colour-under, ghosting, tracking. Three read on their own
// and read *better* stacked, in this order. Sync suppression in the channel is
// a scrambled pay-TV feed — the picture tears into inverted bands with a black
// bar wandering through it. Subcarrier detune in the receiver's decoder sets the
// hue barber-poling down the frame, and chroma gain wound up makes the whole
// scrambled picture rainbow. HV sag and supply ring in the deflection bank then
// shear all of that into waves — the same rows that were "generic" on a clean
// photograph, landing last on a picture that is already coming apart. Reset
// walks it home on the morph.
//
// Travel fractions rather than values, since a drag is a fraction of the track
// (`appreel.mjs`). Subcarrier detune is a `zero` curve, so its 0.811 is 7 kHz
// and not 124 — read off the row by the screen rather than computed.
const MAP_WALK = [
  { hold: 0.2 },
  { moveTo: { stage: 'CHANNEL' }, secs: 0.3 },
  { press: 0.4, on: 'CHANNEL' },
  { scrollTo: { section: 'Cable' }, secs: 0.3 },
  { moveTo: { section: 'Cable' }, secs: 0.2 },
  { press: 0.35, on: 'Cable' },
  { scrollTo: { slider: 'sync suppression' }, secs: 0.25 },
  { moveTo: { slider: 'sync suppression' }, secs: 0.2 },
  { drag: { slider: 'sync suppression', to: 1 }, secs: 0.6 },
  { hold: 0.6 },
  { scrollTo: { stage: 'CHANNEL' }, secs: 0.3 },
  { moveTo: { stage: 'RECEIVER' }, secs: 0.25 },
  { press: 0.4, on: 'RECEIVER' },
  { scrollTo: { section: 'Decoder' }, secs: 0.3 },
  { moveTo: { section: 'Decoder' }, secs: 0.2 },
  { press: 0.35, on: 'Decoder' },
  { scrollTo: { slider: 'subcarrier detune' }, secs: 0.25 },
  { moveTo: { slider: 'subcarrier detune' }, secs: 0.2 },
  { drag: { slider: 'subcarrier detune', to: 0.811 }, secs: 0.5 },
  { moveTo: { slider: 'chroma gain' }, secs: 0.2 },
  { drag: { slider: 'chroma gain', to: 0.2184 }, secs: 0.5 },
  { hold: 0.7 },
  { scrollTo: { section: 'Deflection' }, secs: 0.3 },
  { moveTo: { section: 'Deflection' }, secs: 0.2 },
  { press: 0.35, on: 'Deflection' },
  { scrollTo: { slider: 'HV sag' }, secs: 0.25 },
  { moveTo: { slider: 'HV sag' }, secs: 0.2 },
  { drag: { slider: 'HV sag', to: 0.695 }, secs: 0.5 },
  { moveTo: { slider: 'supply ring' }, secs: 0.2 },
  { drag: { slider: 'supply ring', to: 0.845 }, secs: 0.5 },
  { hold: 1.3 },
  // Home on the morph: reset puts every control back over the same second a
  // roll arrives on, so the picture settles out of its damage rather than
  // being yanked, and the board is stock again for the loop. Scrolled to
  // first because the toolbar is the top of the panel and the rows just
  // dragged are most of a phone below it.
  { scrollTo: { text: 'reset' }, secs: 0.3 },
  { moveTo: { text: 'reset' }, secs: 0.2 },
  { press: 1.2, on: 'reset' },
  { scrollTo: { stage: 'RECEIVER' }, secs: 0.3 },
  { moveTo: { stage: 'RECEIVER' }, secs: 0.2 },
  { press: 0.35, on: 'RECEIVER' },
  { away: 0.4 },
]

// Four presses of the button the look bar opens on, each a whole look nobody
// built, and reset to come home. A press dwells long enough for the morph to
// land and the picture to be looked at, and no longer.
const ROLL = [
  { moveTo: { text: 'random look' }, secs: 0.35 },
  { press: 1.4, on: 'random look' },
  { press: 1.4, on: 'random look' },
  { press: 1.4, on: 'random look' },
  { press: 1.5, on: 'random look' },
  { moveTo: { text: 'reset' }, secs: 0.3 },
  { press: 1.2, on: 'reset' },
  { away: 0.4 },
]

// The receiver's chroma gain, the seven rows of the ring loop in the order
// the mechanism runs, and the tube's saturation and bloom to finish. The wide
// and portrait takes share them; portrait scrolls to the map first.
//
// **The finish used to be the ring modulator, and it was the wrong place to
// stop.** Colin on the take: "it just stops too soon, and the result is also a
// little dark and muddy colors rather than bright vibrant crazy rainbows". The
// loop is held just under unity so it cannot build structure, which is right,
// and it is also why what it builds is dim. Screened as continuations of the
// same seven rows (`v-prog2`, 2026-09-04): loop gain to 1.0 walls the frame
// white, a shorter delay shifts the smear without colouring it, and chroma
// gain in the decoder colours the trails at once. The tube's saturation and
// bloom wound up behind it are what make them electric and set the highlights
// glowing, on the same red chair.
const RING_LOOP = [
  // Chroma gain first, so the photograph is saturated before the loop opens
  // and everything the loop does is done to a coloured picture. Screened
  // against the decoder rows coming last (`v-build4`, `v-build5`): the loop
  // raised on a stock photograph is grey trails for eight seconds before any
  // colour arrives, and the same rows in this order are colour from the first
  // drag with the same finale.
  { moveTo: { stage: 'RECEIVER' }, secs: 0.3 },
  { press: 0.4, on: 'RECEIVER' },
  { scrollTo: { section: 'Decoder' }, secs: 0.3 },
  { moveTo: { section: 'Decoder' }, secs: 0.2 },
  { press: 0.35, on: 'Decoder' },
  { scrollTo: { slider: 'chroma gain' }, secs: 0.25 },
  { moveTo: { slider: 'chroma gain' }, secs: 0.2 },
  { drag: { slider: 'chroma gain', to: 0.1875 }, secs: 0.5 },
  { hold: 0.3 },
  { scrollTo: { stage: 'RECEIVER' }, secs: 0.3 },
  { moveTo: { stage: 'mixer' }, secs: 0.25 },
  { press: 0.4, on: 'mixer' },
  { scrollTo: { slider: 'frame sync' }, secs: 0.3 },
  { moveTo: { slider: 'frame sync' }, secs: 0.2 },
  { drag: { slider: 'frame sync', to: 1 }, secs: 0.45 },
  { scrollTo: { slider: 'loop mix' }, secs: 0.3 },
  { moveTo: { slider: 'loop mix' }, secs: 0.2 },
  { drag: { slider: 'loop mix', to: 0.92 }, secs: 0.7 },
  { moveTo: { slider: 'loop gain' }, secs: 0.2 },
  { drag: { slider: 'loop gain', to: 0.653 }, secs: 0.4 },
  { moveTo: { slider: 'loop delay' }, secs: 0.2 },
  { drag: { slider: 'loop delay', to: 0.0175 }, secs: 0.4 },
  { scrollTo: { slider: 'loop key' }, secs: 0.25 },
  { moveTo: { slider: 'loop key' }, secs: 0.2 },
  { drag: { slider: 'loop key', to: 1 }, secs: 0.6 },
  { moveTo: { choice: { row: 'key input', pick: 'program' } }, secs: 0.2 },
  { press: 0.4, on: 'program' },
  { scrollTo: { slider: 'loop ring mod' }, secs: 0.25 },
  { moveTo: { slider: 'loop ring mod' }, secs: 0.2 },
  { drag: { slider: 'loop ring mod', to: 1 }, secs: 0.7 },
  // The loop has to lap a few times before the trails have grown out of the
  // fur, and the rest of the build is done on top of them.
  { hold: 1.0 },
  { scrollTo: { stage: 'mixer' }, secs: 0.3 },
  { moveTo: { stage: 'camera' }, secs: 0.25 },
  { press: 0.4, on: 'camera' },
  { scrollTo: { section: 'Tube face' }, secs: 0.3 },
  { moveTo: { section: 'Tube face' }, secs: 0.2 },
  { press: 0.35, on: 'Tube face' },
  { scrollTo: { slider: 'beam saturation' }, secs: 0.25 },
  { moveTo: { slider: 'beam saturation' }, secs: 0.2 },
  { drag: { slider: 'beam saturation', to: 0.3333 }, secs: 0.5 },
  { moveTo: { slider: 'screen bloom' }, secs: 0.2 },
  { drag: { slider: 'screen bloom', to: 0.1667 }, secs: 0.5 },
  // The payoff, and the frame the still is taken from.
  { hold: 2.6 },
  { away: 0.4 },
]

// Four blends, seven chips, and `clean` to wipe the board between them. A chip
// is a fader — click for all of it, drag sideways for some — and every chip
// layers onto what is already on the board, so two part way in are a look
// neither is alone. **Part way, not all the way.** Screened at full strength
// (2026-09-04) the same pairs are an op-art spiral with no cat in it, and
// Colin's read on that sheet was the brief: "some or even many of the presets,
// at full strength, tend to be too chaotic and even cheesey to the degree they
// look too distorted".
//
// **Seven different chips, where the last version reused three across its four
// blends** — "it just goes over the same settings sort of repeatedly which is
// boring". These came off a sheet of twenty-eight chips alone and twenty-two
// pairs on the photograph (`v-chips`, `v-pairs`): the colorizer chips
// (silkscreen, poured colour, block colour) are what puts colour nothing in the
// room is onto a picture of something, and a fault on top of one is what tears
// it. Each blend is a different pair of mechanisms: a slicing colorizer under a
// detail enhancer regenerating past the point it howls, a phase-shift colorizer
// into a raster that is collapsing, a block colorizer into a melting loop, and
// the finale three deep — headroom, the howling enhancer, poured colour — which
// is blocks of cyan, green and red with the picture under them. Seven is the
// shortlist row's whole width beside `clean` (PresetsSection.tsx: eight chips),
// so nothing scrolls, and the enhancer is the one chip used twice, under two
// partners that make two different pictures of it.
//
// `supply chaos` was the tearing fault in two of the blends and came out on
// the note "preset: supply chaos often looks kind of boring also"; the
// eighteen pairs on `v-pairs3` are what it was screened against.
//
// **`clean` dwells for the whole morph.** Looks arrive over a second, and a
// chip dragged before the board has landed is dragged onto a board still
// travelling: the wide take showed block colour lit for the drag and dark a
// beat later, which Colin read as "the mouse missed", and the portrait take
// lost a drag outright. A chip gesture stops the morph now (useMix
// `startMix`), the way a slider grab always did — and the slide still waits,
// because the sentence is that clean wipes the board, so the photograph has
// to be back before the next pair goes on.
//
// `bent scan` was the second blend's fault and came out on a note from the
// take: "bent scan looks boring, it just adds a little bend to the image, not
// the kind of dramatic cool stuff i like. we like stuff on the edge of chaos,
// but still discernable". Eighteen more pairs were screened against that
// sentence (`v-pairs2`), and `full collapse` at 0.4 is the one that folds the
// poured colour into bands with the chair still readable through them.
const PRESET_RUN = [
  { moveTo: { chip: 'silkscreen' }, secs: 0.3 },
  { mix: { chip: 'silkscreen', to: 0.8 }, secs: 0.5 },
  { hold: 0.15 },
  { moveTo: { chip: 'howlround loom' }, secs: 0.2 },
  { mix: { chip: 'howlround loom', to: 0.5 }, secs: 0.5 },
  { hold: 0.9 },
  { moveTo: { text: 'clean' }, secs: 0.2 },
  { press: 1.1, on: 'clean' },
  { moveTo: { chip: 'poured colour' }, secs: 0.2 },
  { mix: { chip: 'poured colour', to: 0.7 }, secs: 0.5 },
  { hold: 0.15 },
  { moveTo: { chip: 'full collapse' }, secs: 0.2 },
  { mix: { chip: 'full collapse', to: 0.4 }, secs: 0.5 },
  { hold: 0.9 },
  { moveTo: { text: 'clean' }, secs: 0.2 },
  { press: 1.1, on: 'clean' },
  { moveTo: { chip: 'block colour' }, secs: 0.2 },
  { mix: { chip: 'block colour', to: 0.6 }, secs: 0.5 },
  { hold: 0.15 },
  { moveTo: { chip: 'meltdown' }, secs: 0.2 },
  { mix: { chip: 'meltdown', to: 0.7 }, secs: 0.5 },
  { hold: 1.0 },
  { moveTo: { text: 'clean' }, secs: 0.2 },
  { press: 1.1, on: 'clean' },
  { moveTo: { chip: 'out of headroom' }, secs: 0.2 },
  { mix: { chip: 'out of headroom', to: 0.8 }, secs: 0.5 },
  { hold: 0.15 },
  { moveTo: { chip: 'howlround loom' }, secs: 0.2 },
  { mix: { chip: 'howlround loom', to: 0.5 }, secs: 0.5 },
  { hold: 0.3 },
  { moveTo: { chip: 'poured colour' }, secs: 0.2 },
  { mix: { chip: 'poured colour', to: 0.5 }, secs: 0.5 },
  { hold: 1.3 },
  { moveTo: { text: 'clean' }, secs: 0.2 },
  { press: 1.1, on: 'clean' },
  { away: 0.4 },
]

export const slides = [
  {
    file: 'roll',
    name: 'Random',
    caption:
      'One button, pressed four times. Random look stacks a few presets from different groups over stock and morphs the board to them, so every press is a whole picture nobody dialled: a photograph posterised into green and red, sheared into rainbow waves, torn into bands of colour, then inverted to gold. The chips light up to show what went in, and reset puts the photograph back.',
    alt: 'The window on a photograph of a cat on a red chair, and random look pressed four times: the picture posterises into green and red, shears into rainbow waves, tears into coloured bands and turns golden and inverted, a different look each press, then reset morphs it back to the photograph',
    // The bundled photograph, and `random look` rather than a nudge. This slide
    // was a black and white feedback board with `random nudge` pressed on it,
    // and the note on the take was "the 'nudge' is too minor of a change":
    // every press moved the slabs and left them slabs. A `random look` rebuilds
    // from stock each press (`landRecipe` in ui/useMix.ts), which was the
    // argument against it when the board under it was the point — here the
    // board is a clean photograph, so each press is a whole new picture and
    // the photograph is what every one of them is a picture of.
    //
    // Screened over forty seeds (`v-roll`, `v-roll2`, 2026-09-04): a roll
    // lands on a dull look about one press in three — a cable fault, a
    // dissolve to the bars on B, a white or grey field — so which seed is the
    // slide. 26 gives four vivid and different pictures in a row and a pale
    // fifth, which is where it stops.
    params: { src: 'cat', seed: 26 },
    // The fourth look at the end of its dwell, which is the loudest frame.
    stillAt: 0.76,
    warm: 60,
    act: [{ hold: 0.4 }, ...ROLL],
    // In portrait the look bar is under the picture with the panel, so it is
    // scrolled to before the pointer goes anywhere near it.
    narrowAct: [
      { hold: 0.4 },
      { scrollTo: { text: 'random look' }, secs: 0.4 },
      ...ROLL,
    ],
  },
  {
    file: 'presets',
    name: 'Presets',
    caption:
      'Every preset chip is a fader: click for all of it, drag sideways for some, and each one layers onto the board already there. So two chips dragged part way in are a look neither is alone — a silkscreened cat under a detail enhancer howling, poured colour into a raster collapsing on itself, block colour into a melting loop, then three deep: headroom, the howling enhancer and poured colour, which is blocks of cyan, green and red with the picture under them. Clean wipes the board between each. There are a hundred and twenty chips.',
    alt: 'The window on a photograph of a cat on a red chair, and preset chips dragged part way in with clean between: silkscreen then howlround loom slices the cat into yellow and red and ripples rainbow through its edges, poured colour then full collapse folds cyan and violet bands as the raster collapses, block colour then meltdown melts it into green and magenta, and out of headroom, howlround loom and poured colour together turn it into blocks of cyan, green and red with the picture under them',
    // The bundled photograph, for the reason `build` uses it: a preset is a
    // board, and a board is legible on a picture of something. The chips are
    // seeded as recents, which puts them on the shortlist row beside `clean`
    // (PresetsSection.tsx: the row is `clean`, then what is in the mix, then
    // recents, capped at eight) — so every drag in the take is on one row.
    params: { src: 'cat' },
    seed: {
      video_feedback_recent_presets: JSON.stringify([
        'silkscreen',
        'howlroundLoom',
        'pouredColour',
        'fullCollapse',
        'blockColour',
        'meltdown',
        'outOfHeadroom',
      ]),
    },
    // The finale at the end of its hold.
    stillAt: 0.92,
    warm: 60,
    act: [{ hold: 0.3 }, ...PRESET_RUN],
    // In portrait the presets row is under the picture with the panel, so it
    // is scrolled to before the pointer goes anywhere near it.
    narrowAct: [
      { hold: 0.3 },
      { scrollTo: { text: 'silkscreen' }, secs: 0.4 },
      ...PRESET_RUN,
    ],
  },
  {
    file: 'signal-path',
    name: 'The signal path',
    caption:
      'The map is the rig: two sources into a mixer, then the channel it is recorded and broadcast over, the receiver that decodes it and the screen it lands on. Click a stage and its controls open under it. In the channel, sync suppression scrambles the feed the way pay TV was. In the receiver, subcarrier detune sets the hue barber-poling and chroma gain makes the scramble rainbow, then HV sag and a ringing supply shear all of it into waves. Reset walks it home.',
    alt: 'The window with the signal path map at the head of the panel: the CHANNEL box pressed and sync suppression dragged until the photograph of a cat tears into inverted bands, then the RECEIVER box pressed, subcarrier detune and chroma gain dragged until the bands go rainbow, HV sag and supply ring dragged until the whole picture shears into waves — and reset morphing it back',
    // The photograph, on stock controls. This slide ran on the gallery's first
    // look with the walk pulling timebase rows over it, and what a stranger saw
    // was a beige arch shimmying. Every value on screen now is one the hand in
    // the frame put there, and each row lands on a picture the last one already
    // changed, which is the whole of what makes them read (`MAP_WALK`).
    params: { src: 'cat' },
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
    // The end of the deflection hold, before reset.
    stillAt: 0.77,
    warm: 60,
    act: MAP_WALK,
    // In portrait the panel is the bottom half of a phone and the map starts
    // below its fold, so it is scrolled to first and everything after that is
    // the same walk.
    narrowAct: [{ scrollTo: { stage: 'CHANNEL' }, secs: 0.4 }, ...MAP_WALK],
  },
  {
    file: 'build',
    name: 'From clean',
    caption:
      'A photograph on stock controls, and ten rows raised by hand. The receiver’s chroma gain goes up first, so the colour is already loud. Then the mixer loop: its return synced and the loop opened, its gain eased under unity and its delay stretched so each lap comes back a little further round the hue wheel, then keyed on the live picture and multiplied against it, a ring modulator with one input on the machine’s own past. Trails grow out of the subject’s edges in colours nothing in the room is, and the tube’s saturation and bloom make them glow.',
    alt: 'A run through the app starting on a clean photograph of a cat on a red chair: the receiver’s chroma gain dragged up until the colours are loud, then the mixer loop opened row by row — frame sync, loop mix, loop gain, loop delay, loop key, key input on program, loop ring mod — until rainbow trails grow out of the fur, then the tube’s beam saturation and screen bloom dragged up until the trails are electric and the highlights glow, while the red chair stays photographic',
    // The bundled photograph, and a hand-built ring loop that goes on to be
    // coloured. This slide used to open the camera loop and then the mixer
    // loop on colour bars and finish on a soft field of flowing rainbow, and
    // Colin's verdict on the take was the right one: "for all the time spent
    // with this camera feedback and mixer feedback combo, it looks very
    // boring". Its next version built the ring loop and stopped there, which
    // was "kind of cool, but it just stops too soon" — see `RING_LOOP` for
    // what was screened as the continuation and what stayed.
    //
    // **Seven rows for the loop, and two of them looked too small to matter
    // and were not.** A five-row build (mix, key, key input, ring, sync) blew
    // the cat out to a white field; `loop gain` eased to 0.92 and `loop delay`
    // stretched to 1.1us are what hold it just under unity — the bank's own
    // readout says so: "round trip 0.85x · just under — trails hold, structure
    // does not build". The delay is a fifth of a per cent of its track and
    // its thumb barely moves, but its readout goes 0.15us to 1.10us and
    // without it the loop latches white. `frame sync` goes first rather than
    // last: raised at the end, after the loop had run unsynced for ten
    // seconds, the return's tear stayed in the frame store as a black block
    // wandering through the rest of the take.
    params: { src: 'cat' },
    stillAt: 0.93,
    warm: 60,
    act: [{ hold: 0.3 }, ...RING_LOOP],
    // In portrait the panel is the bottom half of a phone and the map starts
    // below its fold, so it is scrolled to before anything is pressed on it;
    // every row after that scrolls to itself.
    narrowAct: [
      { hold: 0.3 },
      { scrollTo: { stage: 'RECEIVER' }, secs: 0.4 },
      ...RING_LOOP,
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
  // Two decimals, since a timeline that sums to an odd twentieth rounds to a
  // tenth a whole 0.05 off the sum the page is checked against.
  const length = act =>
    Math.round(act.reduce((total, beat) => total + beatSecs(beat), 0) * 100) /
    100
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

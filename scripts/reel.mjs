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
// the app rather than a look: here is what a bank of preset faders does to a
// board, and here is a feedback loop close enough to the edge that a hundredth
// of a slider is a different picture.
//
// **Two slides, both on a demo board, neither on the bundled photograph.** The
// reel was four slides on the same clean cat, which made four recordings read
// as one clip cut four ways — and measured, a quarter to a third of every one
// of them was that photograph sitting still while the pointer worked the panel
// (`mot < 1.0` on 29, 30 and 16 per cent of their frames). Colin's call was to
// open on something already worth looking at, naming Rainborb and Laser duck.
//
// **What that cost, because it is the trap here.** Recording all four on demo
// boards made three of them worse. A demo board is already at the end of its
// own signal path, so an additive pull has nowhere to go: chips stacked on
// Rainborb went to an undifferentiated green noise field after the second one,
// the map walk on Ridiculous rainbow scrambled its rainbow away to a grey
// band, and rolls on Laser duck washed the duck out to cream. What the cat had
// been providing was headroom rather than a cat.
//
// So a slide here is a board with somewhere left to go, matched to a hand that
// moves the way that board can stand — chips onto a picture with tone in it,
// hundredths of a slider onto a loop on the edge. **Two slides rather than
// four** because the other two both wanted a source that is colour, detailed
// and recognisably of something, and the app ships exactly one of those. The
// candidates and how each failed are in the screens this session left behind;
// the short version is that the duck is too dark for a roll to read on and the
// two public-domain cartoons are monochrome, so the chroma rows have nothing
// to amplify.
//
// **Things have to combo.** The rows and chips that read on their own are few
// and generic, and the same ones land differently on a picture something else
// has already changed. Every timeline here is ordered so that each pull lands
// on what the last one did.
//
// **The hand moves fast.** A beat is a fraction of a second: a glide onto a
// control is 0.2-0.35s, a press dwells 0.4s, a drag takes 0.5-0.7s, and the
// only long holds are the ones a feedback loop needs to lap. The reel ran
// twice as long as this and Colin's note on it was the whole brief: "people
// are very fast visual learners, they can see things happen quickly so dont
// dawdle and move dials and click buttons in relatively quick succession".
// `appreel.mjs` records at real time for the same reason.
//
// **A timeline ends on its own loudest frame.** It used to end where it began,
// on the rule that these loop and a cursor left mid-panel reads as a cut —
// and what that bought was the last 2.6 seconds of three of the four slides
// spent walking home to a stock board and holding it. The stage plays a clip
// once and holds its last frame now (`landing.js`), so the frame to end on is
// the one the slide is about.
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
//   pin      params to *set* on the look's own query, for one it carries that
//            the take cannot live with. Appending will not do it — `q.get`
//            hands back the first of a repeated pair.
//   act      the timeline. See `appreel.mjs` for the verbs; the rule that
//            matters is that a timeline **ends on its loudest frame**, since
//            the stage holds the last one while the line under it is read.
import { showcase } from './demos.mjs'

// `:` and `,` back as themselves, the way `urlParams.ts`'s own `queryString`
// hands a look to a person — `URLSearchParams.toString` escapes both, and a
// look is mostly separators.
const repin = (query, pin) => {
  const q = new URLSearchParams(query.slice(1))
  for (const [key, value] of Object.entries(pin)) {
    q.set(key, value)
  }
  return q.toString().replaceAll('%3A', ':').replaceAll('%2C', ',')
}

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
// Where the clips live. The bucket `agentreel.mjs` already uses, since a slide
// of the whole window at 2x runs to megabytes and a minute-long one to tens of
// them, which is not a thing to keep in a git history — the stills stay in
// `public/reel`, the mp4s go up with `aws s3 cp` at the end of a take. The
// page reads the clip URL straight off `data-src`, so an absolute URL is fine
// where a root-absolute path would not be.
export const S3_PREFIX = 's3://myloveydove.com/videoskillet/reel/'
export const CLIPS = 'https://myloveydove.com/videoskillet/reel/'

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
// Rainborb is a camera loop held just over unity, and what is worth doing to
// it is not a preset — it is a hundredth of a slider. Colin's brief was the
// mechanism: "it is highly driven by feedback to start with, so it requires
// delicacy in mutation of the delicate feedback features", and then, on a
// screen that was still moving too far, "even more subtle changes should be
// applied". The rows say the same thing themselves in `controls.ts`: zoom's
// "tiny offsets are usually the most interesting", rotate's "a hundredth of a
// degree visibly changes how fast the spiral winds".
//
// So the whole slide is four rows of one bank, moved a hair at a time, and
// nothing else. That is also why it has almost no panel navigation in it: the
// four rows sit together under the camera stage, so there is no scrolling
// between them and the picture is changing in every frame of the take.
//
// **Where the numbers came from.** Screened by travel fraction rather than by
// value (`v-orb2`, this session): the bisection that resolves a value
// misreports on these curved rows — it was asked for zoom 1.01 and the readout
// came back 0.87 — and a drag takes a fraction of the track anyway. The board
// sits at about 0.20 of zoom's travel and 0.50 of rotate's, so these are small
// moves from where the look already is:
//
//   zoom    **0.196 to 0.208, and no further.** The board sits at about 0.200,
//           so this is four thousandths of the track a step, one of them
//           downward. Past roughly 0.22 the loop stops being a picture: it
//           expands every lap without bound and the frame fills with a single
//           flat colour, which is what the take at 0.212/0.224/0.236 did — the
//           orb relobed beautifully for eight seconds and then went solid
//           yellow for the last four. Colin on that take: "after you keep
//           sliding it it just expands to infinity at a certain point ... only
//           small tweaks needed". Under 1 the loop collapses inward instead
//           and concentrates its gain in a shrinking core, so the step down is
//           safe in a way the steps up are not.
//   rotate  0.504 onward relobes the silhouette — the orb goes from round to
//           faceted, with the rainbow teeth redistributing round it. Every
//           step is a different shape and all of them stay legible.
//   gain    is a trap and is not in the timeline. Past about 0.8 of travel the
//           rim washes out and the frame goes flat grey; the first orb screen
//           lost its last two tiles that way.
//   iris    reads as nothing on a still and as a pulse in a clip — the servo
//           is inside the loop it is steadying, so it blooms, clamps and
//           reopens on its own rhythm. It is here for the motion.
//
// **No chip on this one, and that took two takes to accept.** The orb is a
// pale core with all its colour on the rim, so the obvious move is one
// colorizer to make the frame loud — `chroma rails` was the finale, then, when
// opening the camera stage turned out to fold the Presets section away and
// leave no chip to reach for, the opening. Recorded, it posterised the loop
// into flat slabs of magenta and green and the rim structure the slide is
// about was gone; the zoom expansion then pushed those slabs out until the
// last six seconds were a green field with a cyan band across it. Which is the
// same mistake as stacking `howlround loom` on this board, moved to the front.
//
// A delicate system does not want a chip on it. What the loop's own rows make
// on their own is vivid enough — by 0.236 of zoom's travel the rim is a thick
// ring of yellow and magenta — and it is the picture the mechanism actually
// makes, which is the whole claim the page is there to support.
const ORB = [
  { moveTo: { stage: 'camera' }, secs: 0.3 },
  { press: 0.4, on: 'camera' },
  { moveTo: { slider: 'rotate' }, secs: 0.25 },
  { drag: { slider: 'rotate', to: 0.504 }, secs: 0.45 },
  { hold: 0.5 },
  { drag: { slider: 'rotate', to: 0.512 }, secs: 0.45 },
  { hold: 0.5 },
  { drag: { slider: 'rotate', to: 0.524 }, secs: 0.45 },
  { hold: 0.6 },
  { moveTo: { slider: 'zoom' }, secs: 0.25 },
  { drag: { slider: 'zoom', to: 0.196 }, secs: 0.45 },
  { hold: 0.8 },
  { drag: { slider: 'zoom', to: 0.204 }, secs: 0.45 },
  { hold: 0.8 },
  { drag: { slider: 'zoom', to: 0.208 }, secs: 0.45 },
  { hold: 1.0 },
  { moveTo: { slider: 'auto-iris hunt' }, secs: 0.25 },
  { drag: { slider: 'auto-iris hunt', to: 0.45 }, secs: 0.5 },
  { away: 0.4 },
  { hold: 2.4 },
]

// Five chips onto Ridiculous rainbow, cumulative, and the board is never
// wiped — each reached through the grouped catalog rather than off the
// shortlist row.
//
// **What this replaced, and why the obvious version is wrong twice over.** The
// take that shipped ran on the bundled photograph and pressed `clean` between
// each pair, which put three 1.3 second stops into a 17.4 second clip with the
// stock picture motionless through every one — `mot 0.1, 0.0, 0.0` at seconds
// 7, 11 and 16 — and then spent its last beat wiping off the most vivid thing
// in the whole reel. The fix for that was to stack instead of wiping, and
// stacking on Rainborb was worse: silkscreen went CMYK, `howlround loom`
// buried the frame in green noise at second two, and the five chips after it
// changed nothing for eight seconds. Colin's read on that take is the rule
// this timeline follows — "several changes like poured color, block color,
// effectively did nothing due to how distorted the video was, howl made it
// very distorted", and "the silkscreen effect is also sort of cheesy and
// overly cmyk like coloring".
//
// So: no `clean`, no destroyers, and a board with somewhere left to go.
// Screened eight boards against eight chips one at a time (`v-boards`, this
// session) and Ridiculous rainbow was the row where the most chips read — six
// of eight vivid and distinct, where Wiggity went beige under all of them and
// Rainborb kept only the colorizers. Then the stack itself (`v-lines`): all
// six checkpoints came back vivid, different from each other, and with the
// picture still legible through them. Three colorizers first, since a
// colorizer lays colour on tone and there is no undoing a fault to get one on
// afterwards, then the ring for shimmer and `full collapse` to shear the lot.
//
// **Through the catalog, not the shortlist.** The take before this one seeded
// the five chips as recents so they sat on one row beside `clean`, and every
// drag was on that row. Colin on it: "it only delves into the top e.g. N
// presets which is boring. dig deeper." What the seeding hid is the thing a
// stranger most needs shown: the row is eight of a hundred and thirty-eight,
// and `+ N more…` opens the rest grouped by the fault they model. So the hand
// presses that chip first, then scrolls to each family in turn — Feedback
// loops, Circuit bent, Past the redline, Phosphor / CRT, back up to Sync /
// Deflection — and drags the chip from where it lives. One chip is new:
// `magnetised`, a patch of mask bending all three beams, which reads on the
// colorizer stack as a dark bulge pushing the bands aside. The rest of the
// deeper catalog screened worse (`candidates.deep.mjs`, `deep2.mjs`, this
// session): every colour but one, neon tube, rail slam, strobed tube and arc
// storm each took the frame to grey, black or noise on top of the colorizers;
// misconverged, radar tube, round tube, contour lines and a hair off the
// crystal changed nothing the eye could find; light that stays whited it out.
//
// **Slower than it was.** A mix ran 0.5s with a 0.5s hold and the whole slide
// was 8.5s — "the settings for the presets are toggled too fast. they can be
// relatively fast but this is too fast". A drag is 0.8s now, the picture gets
// a second to answer it before the hand moves on, and a scroll between
// families is a beat of its own, since a panel that jumps is a cut.
const PRESET_RUN = [
  { moveTo: { text: 'more…' }, secs: 0.4 },
  { press: 0.6, on: '+' },
  { scrollTo: { text: 'ring in the highlights' }, secs: 0.8 },
  { moveTo: { chip: 'ring in the highlights' }, secs: 0.35 },
  { mix: { chip: 'ring in the highlights', to: 0.5 }, secs: 0.8 },
  { hold: 1.0 },
  { scrollTo: { text: 'false colour' }, secs: 0.8 },
  { moveTo: { chip: 'false colour' }, secs: 0.35 },
  { mix: { chip: 'false colour', to: 0.7 }, secs: 0.8 },
  { hold: 1.0 },
  { moveTo: { chip: 'poured colour' }, secs: 0.35 },
  { mix: { chip: 'poured colour', to: 0.6 }, secs: 0.8 },
  { hold: 1.0 },
  { scrollTo: { text: 'chroma rails' }, secs: 0.8 },
  { moveTo: { chip: 'chroma rails' }, secs: 0.35 },
  { mix: { chip: 'chroma rails', to: 0.6 }, secs: 0.8 },
  { hold: 1.1 },
  { scrollTo: { text: 'magnetised' }, secs: 0.6 },
  { moveTo: { chip: 'magnetised' }, secs: 0.35 },
  { mix: { chip: 'magnetised', to: 0.8 }, secs: 0.8 },
  { hold: 1.1 },
  { scrollTo: { text: 'full collapse' }, secs: 0.9 },
  { moveTo: { chip: 'full collapse' }, secs: 0.35 },
  { mix: { chip: 'full collapse', to: 0.4 }, secs: 0.8 },
  { away: 0.4 },
  { hold: 2.4 },
]

export const slides = [
  {
    file: 'presets',
    name: 'Presets',
    caption:
      'Every preset chip is a fader: click for all of it, drag sideways for some, and each one layers onto the board already there. The row shows eight; “+ more” opens all hundred and thirty-eight, grouped by the fault they model. Five go on here over Ridiculous rainbow — a composite loop keyed on itself, turning the hue every lap — and nothing is wiped between them. Ring in the highlights from the feedback loops, false colour and poured colour from the circuit-bent family and chroma rails from past the redline put colour on tone until the frame is bands of red, green and cyan; then full collapse, from the deflection faults, shears the lot as the raster gives way. Each chip lands on the picture the last one made.',
    alt: 'The window on Ridiculous rainbow — a white core with bands of red, green and blue pouring off it — with the preset catalog opened from its “+ more” chip and scrolled family by family, and five chips dragged part way in one after another with nothing wiped between them: ring in the highlights, then false colour, poured colour and chroma rails turn the frame into vivid wavy bands of red, green, cyan and magenta, and full collapse shears the whole thing sideways as the raster collapses',
    look: 'Ridiculous rainbow',
    // The finish, at the end of its hold.
    stillAt: 0.95,
    warm: 60,
    act: PRESET_RUN,
    // In portrait the presets row is under the picture with the panel, so it
    // is scrolled to before the pointer goes anywhere near it.
    narrowAct: [{ scrollTo: { text: 'more…' }, secs: 0.4 }, ...PRESET_RUN],
  },
  {
    file: 'orb',
    name: 'Camera feedback',
    caption:
      'Rainborb is a camera pointed at the screen it feeds, with the loop held just over unity — a system on the edge, and what it wants is not a preset. Nothing here is one: every move is hundredths of a slider on the loop’s own rows. Rotate goes up a hundredth of a degree at a time and the orb goes from round to faceted; zoom moves by a hundredth and a crescent grows out of the rim, then a thick ring of yellow and magenta. That is one and a half per cent of one control for a different picture. The auto-iris hunt at the end is a servo inside the loop it is steadying, so it blooms, clamps and reopens on its own rhythm and never settles.',
    alt: 'The window on Rainborb — a pale orb rimmed with rainbow teeth on black — and the camera loop’s own rows moved a hair at a time: rotate nudged three times and the orb goes from round to faceted, zoom nudged three times and a crescent grows out of the rim into a thick ring of yellow and magenta, and the auto-iris hunt set going so the whole thing blooms and clamps on its own rhythm',
    look: 'Rainborb',
    stillAt: 0.95,
    // A camera loop is mostly history: it has to lap enough times to be the
    // picture the link promises before the shutter opens.
    warm: 90,
    act: ORB,
    // In portrait the panel is the bottom half of a phone and the map starts
    // below its fold, so it is scrolled to before anything is pressed on it.
    narrowAct: [{ scrollTo: { stage: 'camera' }, secs: 0.4 }, ...ORB],
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
  //
  // `pin` is the same argument for a param the look already carries and the
  // take cannot live with. Appending will not do it: `urlParams.ts` reads a
  // key with `q.get`, which hands back the *first* of a repeated pair, so
  // `&srcb=none` after `srcb=ia-random` changes nothing. `Laser duck` rolls
  // its second source off archive.org and comes back with different footage
  // every run, which is fine for a link somebody opens and not for a frame
  // this file promises. Set rather than appended, so the look stays one
  // entry in `demos.json` and the recording stays reproducible.
  const carried =
    slide.look === undefined || slide.params === undefined
      ? board
      : `${board}&${new URLSearchParams(slide.params)}`
  const query =
    slide.pin === undefined ? carried : `?${repin(carried, slide.pin)}`
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
    // The clips are served off the bucket (`CLIPS`), the stills off the page.
    // `still` is page-relative and `poster` is not, for the reason `demos.mjs`
    // spells out: vite rewrites `src` and `poster` under this project's
    // relative base and has never heard of a data attribute, so a
    // root-absolute `data-src` would survive the build and 404 under a
    // sub-path.
    clip: `${CLIPS}${slide.file}.mp4`,
    still: `reel/${slide.file}.webp`,
    poster: `/reel/${slide.file}.webp`,
    narrowClip: `${CLIPS}${slide.file}-narrow.mp4`,
    narrowStill: `reel/${slide.file}-narrow.webp`,
    narrowPoster: `/reel/${slide.file}-narrow.webp`,
  }
})

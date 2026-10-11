// Stills of the landing page's hero buttons after a pass through the program:
// what each button says, which faults it is scanned through, and which frame
// to keep. The page does not show them. The hero used them as its buttons for a
// while (2c22c75) and went back to plain ones; this and public/btn are kept so
// the idea can be tried again without rebuilding the harness. Copy the labels
// from site/pages/index.astro before a re-render.

// `name` is the still's filename in public/btn. Each `set` holds a fault on the
// board at a fraction of what the deck's shelf would drive it to: enough to
// mark the button as having come through the program, little enough to read.
// `frame` is the candidate the harness keeps (`--sheet` lays them all out).
export const BUTTONS = [
  {
    name: 'app',
    label: 'Open the app →',
    primary: true,
    // Timebase jitter, which shears the stems line by line, and the guns
    // landing a few pixels apart.
    set: { tbJitterNs: 250, crtConverge: 3 },
    frame: 6,
  },
  {
    name: 'cam',
    label: 'Open the camera →',
    primary: true,
    // A loose horizontal hold, bending the top of the button, and the guns
    // landing a few pixels apart. Any burst-lock error tints the whole button,
    // which takes the green away.
    set: { hHold: 0.12, syncBendUs: 3, crtConverge: 3 },
    frame: 1,
  },
  {
    name: 'full',
    label: 'Full instrument',
    // A few dropouts and stick-slip shear off a worn tape.
    set: { dropoutRate: 10, dropoutLenUs: 15, tbStickNs: 150 },
    frame: 2,
  },
  {
    name: 'simple',
    label: 'Simple mode',
    // The tuner a little off the channel: light snow.
    set: { rfSnow: 0.3, rfMistuneMHz: -0.4 },
    frame: 3,
  },
  {
    name: 'guide',
    label: 'User guide',
    // Tape wow and jitter, so the lines of the button wander.
    set: { tbWowNs: 600, tbJitterNs: 300 },
    frame: 1,
  },
]

// How far past the button's own box the still reaches, in CSS px, so a fault
// that throws light outside the button lands on the page around it.
export const PAD_X = 12
export const PAD_Y = 10

// Still pixels per CSS px: a 2x screen shows it at its own size.
export const SCALE = 2

// The harness grabs this many frames, this many sim frames apart, and keeps
// the one each button's `frame` names.
export const CANDIDATES = 12
export const GAP = 7

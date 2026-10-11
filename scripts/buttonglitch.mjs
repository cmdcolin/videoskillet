// The landing page's glitching buttons: which fault each one is scanned
// through, and how the strip that scripts/buttonplate.mjs renders from it is
// laid out. The page reads this table too, so a strip and the CSS that plays it
// cannot disagree about how many frames it holds.

// `name` is what the page's `data-glitch` says. Each `peak` is a fault the way
// the deck's shelf writes one (src/ui/transitions.ts): the board at full depth,
// run up and back down by the engine's own envelope. The shelf's entries break
// one mechanism each so a cut can hide under them; a button has no cut to hide,
// so these stack two or three mechanisms that fail together on real equipment.
export const BUTTONS = [
  {
    name: 'app',
    label: 'Open the app →',
    primary: true,
    // The set power-cycling: the raster folds to a line, the supply rings
    // and the beam limiter pumps as it opens back out.
    peak: { vSize: 0.12, hvSagUs: -80, hvRing: 1, abl: 1, crtConverge: 6 },
    seconds: 1,
  },
  {
    name: 'cam',
    label: 'Open the camera →',
    primary: true,
    // The receiver losing hold: the picture tears and rolls, and the colour
    // oscillator loses the burst, so the hue spins as it goes.
    peak: { hHold: 0.02, vHold: 0, vFreqHz: 50, syncBendUs: 6, burstLock: 0 },
    seconds: 1,
  },
  {
    name: 'full',
    label: 'Full instrument',
    // The head coming off track, with the dropouts and the stick-slip shear
    // that ride along with it. The band parks on the middle of the raster,
    // which is where the button is.
    peak: {
      trackAmt: 1,
      trackPos: 0.5,
      dropoutRate: 150,
      dropoutLenUs: 20,
      tbStickNs: 400,
      tbJitterNs: 400,
    },
    seconds: 1.2,
  },
  {
    name: 'simple',
    label: 'Simple mode',
    // The tuner sliding off the channel and back: snow, then the picture.
    peak: { rfSnow: 1, rfMistuneMHz: -1.5, noiseIre: 20 },
    seconds: 1,
  },
  {
    name: 'guide',
    label: 'User guide',
    // Rewind with the picture on: head-crossing bars, FM streaks and the
    // timebase thrown about by the tape running backwards.
    peak: { shuttleX: -12, fmOverdev: 1, tbJitterNs: 800, tbWowNs: 2000 },
    seconds: 1.2,
  },
]

// How far past the button's own box the sprite reaches, in CSS px, so a fault
// that throws the picture outside the button still lands somewhere.
export const PAD_X = 18
export const PAD_Y = 16

// Every other sim frame: 30 fps, half the bytes.
export const STRIDE = 2
// Sprite pixels per CSS px. The button is scanned at about three samples per
// CSS px, so past this the file is spending its bytes on grain.
export const SCALE = 1.5

// The frames a strip holds: the fault's first frame, then every STRIDE-th one
// up to and including its last. `seconds` must come to a whole number of sim
// frames at 60 fps.
export const framesOf = b => Math.floor((b.seconds * 60) / STRIDE) + 1

// What the page sets on a button so landing.js and landing.css can play its
// strip. The path is page-relative for the reason landing.js gives for
// `data-src`.
export const glitchOf = name => {
  const b = BUTTONS.find(x => x.name === name)
  return {
    'data-glitch': `btn/${b.name}.webp`,
    style: [
      `--glitch-frames: ${framesOf(b)}`,
      `--glitch-secs: ${Number(((framesOf(b) * STRIDE) / 60).toFixed(3))}`,
      `--glitch-pad-x: ${PAD_X}`,
      `--glitch-pad-y: ${PAD_Y}`,
    ].join('; '),
  }
}

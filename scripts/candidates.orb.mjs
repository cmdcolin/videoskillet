// Which rows on Rainborb are worth a beat of the `orb` slide, screened one row
// at a time against the stock board.
//
//   node scripts/reelscreen.mjs scripts/candidates.orb.mjs /tmp/v-orb
//
// The slide was three rows of one bank over twelve seconds and the brief was a
// longer take with more of the instrument in it, on a board where a step too
// far is a flat field. So every row here is walked in small steps from where
// the look already sits, with a wall-clock settle after each one, since a loop
// answers a move over the laps that follow it rather than on the frame.
//
// **Direction is the finding.** Zoom, rotate and gain each make a picture one
// way and a white blob the other, and the take that shipped had two of them
// pointed the wrong way. What the sheets say, in one line each: zoom up past
// unity grows yellow flames and down by ×0.985 has lost the teeth; rotate up
// through zero relobes and down only winds the teeth finer; gain down draws a
// spiral arm out of the rim and up washes it to a pale disc; mix down three
// hundredths sheds the orb into a crescent. `beam saturation`, `phosphor
// glow`, `screen bloom`, `halation`, `beam gamma`, `beam cutoff` and the lens
// trims are all in `reel.mjs`'s own note on why they are not in the timeline.
//
// Travel fractions rather than values: the bisection that resolves a value
// misreports on these curved rows. The value each fraction lands on is the
// label on the tile.
//
// Fine rows are folded behind the group's `▸ N fine tweaks` toggle, which is
// pressed here the way the take has to press it.
import { showcase } from './demos.mjs'

const RAINBORB = showcase.find(d => d.name === 'Rainborb').query

const walk = (name, row, steps, { fine = false, bank } = {}) => [
  name,
  {
    query: RAINBORB,
    warm: 90,
    beats: [
      { open: 'camera' },
      ...(bank === undefined ? [] : [{ expand: bank }]),
      ...(fine ? [{ expand: '7 fine tweaks' }] : []),
      { wait: 900 },
      { shot: 'stock' },
      ...steps.flatMap(([to, label]) => [
        { row, to, frames: 30 },
        { wait: 1800 },
        { shot: label },
      ]),
      { wait: 2500 },
      { shot: '+2.5s' },
    ],
  },
]

// What the loop is eating, which is SMPTE bars unless a link says otherwise —
// so the question is whether feeding it something else changes the look. It
// does not: the loop dominates so completely that all five settle into the
// same orb.
const on = src => [
  `source: ${src}`,
  {
    query: `${RAINBORB}&src=${encodeURIComponent(src)}`,
    warm: 120,
    beats: [
      { shot: 'warm 120' },
      { wait: 2500 },
      { shot: '+2.5s' },
      { wait: 2500 },
      { shot: '+5s' },
      { wait: 3000 },
      { shot: '+8s' },
    ],
  },
]

export default [
  walk('zoom up to the edge, then back', 'zoom', [
    [0.2145, '1.002'],
    [0.2184, '1.004'],
    [0.2222, '1.006'],
    [0.2066, 'back 0.998'],
  ]),
  walk('zoom down', 'zoom', [
    [0.1931, '0.99'],
    [0.1859, '0.985'],
    [0.1794, '0.98'],
  ]),
  walk('rotate through zero', 'rotate', [
    [0.4147, '-0.75'],
    [0.5, '0'],
    [0.5853, '+0.75'],
    [0.6263, '+1.5'],
  ]),
  walk('rotate the other way', 'rotate', [
    [0.3391, '-2.5'],
    [0.3148, '-3.5'],
    [0.2961, '-4.5'],
    [0.2742, '-6'],
  ]),
  walk('rotate hard', 'rotate', [
    [0.2519, '-8'],
    [0.2022, '-15'],
    [0.1463, '-30'],
    [0.7481, '+8'],
    [0.8866, '+45'],
  ]),
  walk(
    'gain up',
    'gain',
    [
      [0.6163, '1.28'],
      [0.6487, '1.34'],
      [0.677, '1.40'],
    ],
    { fine: true },
  ),
  walk(
    'gain down',
    'gain',
    [
      [0.5249, '1.15'],
      [0.477, '1.10'],
      [0.4163, '1.05'],
    ],
    { fine: true },
  ),
  walk('mix down', 'mix', [
    [0.95, '0.95'],
    [0.94, '0.94'],
    [0.93, '0.93'],
    [0.92, '0.92'],
  ]),
  walk(
    'shift x, thousandths',
    'shift x',
    [
      [0.504, '0.002'],
      [0.5079, '0.004'],
      [0.4921, '-0.004'],
    ],
    { fine: true },
  ),
  walk(
    'shift the aim further',
    'shift x',
    [
      [0.5367, '0.02'],
      [0.582, '0.05'],
      [0.6412, '0.10'],
      [0.5, 'back to 0'],
    ],
    { fine: true },
  ),
  walk(
    'defocus',
    'defocus',
    [
      [0.1, '1.2px'],
      [0.1667, '2px'],
      [0.25, '3px'],
    ],
    { fine: true },
  ),
  walk(
    'vignette',
    'vignette',
    [
      [0.35, '0.35'],
      [0.5, '0.5'],
      [0.65, '0.65'],
    ],
    { fine: true },
  ),
  walk(
    'black cut',
    'black cut',
    [
      [0.3, '0.06'],
      [0.45, '0.09'],
      [0.6, '0.12'],
    ],
    { fine: true },
  ),
  walk(
    'cam s-curve',
    'cam s-curve',
    [
      [0.55, '0.55'],
      [0.75, '0.75'],
      [0.9, '0.9'],
    ],
    { fine: true },
  ),
  walk(
    'beam cutoff',
    'beam cutoff',
    [
      [0.05, '0.05'],
      [0.13, '0.12'],
      [0.22, '0.21'],
    ],
    { bank: 'Tube face' },
  ),
  walk(
    'beam gamma',
    'beam gamma',
    [
      [0.21, '1.4'],
      [0.29, '1.9'],
      [0.38, '2.4'],
    ],
    { bank: 'Tube face' },
  ),
  walk(
    'beam saturation',
    'beam saturation',
    [
      [0.25, '1.49'],
      [0.35, '2.1'],
      [0.45, '2.67'],
    ],
    { bank: 'Tube face' },
  ),
  walk(
    'screen bloom',
    'screen bloom',
    [
      [0.1, '0.6'],
      [0.18, '1.08'],
      [0.28, '1.62'],
    ],
    { bank: 'Tube face' },
  ),
  walk(
    'halation',
    'halation',
    [
      [0.1, '0.59'],
      [0.18, '1.06'],
      [0.28, '1.67'],
    ],
    { bank: 'Tube face' },
  ),
  walk(
    'phosphor glow',
    'phosphor glow',
    [
      [0.06, '0.24'],
      [0.13, '0.5'],
      [0.22, '0.88'],
    ],
    { bank: 'Tube face' },
  ),
  on('tv static'),
  on('vhs static'),
  on('sweep'),
  on('cat'),
  on('synth'),
  on('teletype'),
]

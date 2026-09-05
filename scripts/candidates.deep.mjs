// Stacks for the presets slide that reach past the shortlist row: chips from
// Circuit bent, Phosphor / CRT, Past the redline and Switcher, cumulative on
// Ridiculous rainbow, a tile after each. Seeded as recents here so the screen
// can drag them off one row; the take itself opens the grouped catalog and
// scrolls to each.
import { showcase } from './demos.mjs'

const board = showcase.find(d => d.name === 'Ridiculous rainbow').query

const stack = (name, chips) => [
  name,
  {
    query: board,
    warm: 60,
    seed: {
      video_feedback_recent_presets: JSON.stringify(chips.map(c => c[1])),
    },
    beats: chips.flatMap(([label, , to]) => [
      { mix: label, to },
      { wait: 1200 },
      { steps: 40 },
      { shot: `${label} ${to}` },
    ]),
  },
]

export default [
  stack('A ship order', [
    ['ring in the highlights', 'ringInTheHighlights', 0.5],
    ['false colour', 'falseColour', 0.7],
    ['poured colour', 'pouredColour', 0.6],
    ['chroma rails', 'chromaRails', 0.6],
    ['full collapse', 'fullCollapse', 0.4],
  ]),
  stack('B crt finish', [
    ['false colour', 'falseColour', 0.7],
    ['poured colour', 'pouredColour', 0.6],
    ['chroma rails', 'chromaRails', 0.6],
    ['magnetised', 'magnetised', 0.6],
    ['wandering inset', 'wanderingInset', 0.5],
  ]),
  stack('C contour neon arc', [
    ['contour lines', 'contourLines', 0.6],
    ['false colour', 'falseColour', 0.6],
    ['every colour but one', 'everyColourButOne', 0.5],
    ['neon tube', 'neonTube', 0.6],
    ['arc storm', 'arcStorm', 0.5],
  ]),
  stack('D plaid rail misconverged', [
    ['ring plaid', 'ringPlaid', 0.5],
    ['poured colour', 'pouredColour', 0.6],
    ['rail slam', 'railSlam', 0.4],
    ['misconverged', 'misconverged', 0.7],
    ['full collapse', 'fullCollapse', 0.4],
  ]),
  stack('E crystal light strobe', [
    ['a hair off the crystal', 'hairOffTheCrystal', 0.6],
    ['false colour', 'falseColour', 0.6],
    ['light that stays', 'lightThatStays', 0.5],
    ['strobed tube', 'strobedTube', 0.5],
    ['wandering inset', 'wanderingInset', 0.5],
  ]),
]

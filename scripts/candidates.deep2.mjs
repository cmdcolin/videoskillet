// Round two: the proven colorizer stack on Ridiculous rainbow, then one chip
// from a family the slide has not visited yet, then full collapse over it.
import { showcase } from './demos.mjs'

const board = showcase.find(d => d.name === 'Ridiculous rainbow').query

const base = [
  ['false colour', 'falseColour', 0.7],
  ['poured colour', 'pouredColour', 0.6],
  ['chroma rails', 'chromaRails', 0.6],
]

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

const fifth = (label, name, to) =>
  stack(`+ ${label}`, [
    ...base,
    [label, name, to],
    ['full collapse', 'fullCollapse', 0.4],
  ])

export default [
  fifth('magnetised', 'magnetised', 0.8),
  fifth('misconverged', 'misconverged', 0.8),
  fifth('light that stays', 'lightThatStays', 0.5),
  fifth('a hair off the crystal', 'hairOffTheCrystal', 0.6),
  fifth('radar tube', 'radarTube', 0.6),
  fifth('contour lines', 'contourLines', 0.6),
  fifth('round tube', 'roundTube', 0.8),
]

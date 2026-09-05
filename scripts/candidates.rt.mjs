// Rows for the signal-path slide, screened the way the take plays them: one
// row a session on Ridiculous rainbow, shot right after the move and again
// after 2.5 s of wall clock, since a loop that looks fine forty stepped frames
// after a move can be a dim striped field a second later — `v offset` was.
// A row that reads as an inert banner in the panel is out on sight.
import { showcase } from './demos.mjs'

const board = showcase.find(d => d.name === 'Ridiculous rainbow').query

const probe = (open, expand, row, at) => [
  `${row} ${at.to ?? `= ${at.value}`}`,
  {
    query: board,
    warm: 90,
    beats: [
      { steps: 20 },
      { shot: 'base' },
      { open, expand, row, ...at },
      { wait: 300 },
      { shot: 'after' },
      { wait: 2500 },
      { shot: '+2.5s' },
      { wait: 2500 },
      { shot: '+5s' },
    ],
  },
]

export default [
  probe('mixer', undefined, 'loop delay', { value: 0.7 }),
  probe('mixer', undefined, 'loop delay', { value: 0.2 }),
  probe('mixer', undefined, 'loop delay', { value: 1.4 }),
  probe('mixer', undefined, 'loop gain', { value: 1.1 }),
  probe('mixer', undefined, 'loop gain', { value: 0.9 }),
  probe('mixer', undefined, 'loop key', { to: 0.5 }),
  probe('mixer', undefined, 'loop key', { to: 0.1 }),
  probe('mixer', undefined, 'strobe hold', { to: 0.5 }),
  probe('mixer', undefined, 'read clock error', { to: 0.6 }),
  probe('mixer', undefined, 'loop timebase pull', { to: 0.6 }),
  probe('mixer', undefined, 'loop mix', { to: 0.9 }),
  probe('RECEIVER', 'Deflection', 'bend amount', { to: 0.8 }),
  probe('RECEIVER', 'Deflection', 'HV sag', { to: 0.8 }),
  probe('RECEIVER', 'Deflection', 'supply ring (0 droop, 1 chaos)', {
    to: 0.9,
  }),
  probe('RECEIVER', 'Deflection', 'v size (underscan)', { to: 0.6 }),
  probe('RECEIVER', 'Sync', 'horizontal hold', { to: 0.35 }),
  probe('RECEIVER', 'Decoder', 'tint', { to: 0.85 }),
  probe('RECEIVER', 'Decoder', 'chroma gain', { to: 0.7 }),
  probe('SCREEN', 'Beam', 'beam bloom', { to: 1 }),
  probe('SCREEN', 'Phosphor', 'phosphor persistence', { to: 0.85 }),
]

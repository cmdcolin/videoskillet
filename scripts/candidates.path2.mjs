// The signal-path slide's sequence, cumulative and in real time on Ridiculous
// rainbow: two positions of the loop's own delay row, then the receiver's
// deflection rows over what that made. Shot right after each move and 2.5 s on.
import { showcase } from './demos.mjs'

const board = showcase.find(d => d.name === 'Ridiculous rainbow').query
const at = (open, expand, row, at) => ({ open, expand, row, ...at })

const seq = (name, beats) => [
  name,
  {
    query: board,
    warm: 90,
    beats: [
      { steps: 20 },
      { shot: 'base' },
      ...beats.flatMap(b => [
        b,
        { wait: 300 },
        { shot: `${b.row} ${b.to ?? `= ${b.value}`}` },
        { wait: 2500 },
        { shot: '+2.5s' },
      ]),
    ],
  },
]

export default [
  seq('A delay .2 · .7 · bend · ring', [
    at('mixer', undefined, 'loop delay', { value: 0.2 }),
    at('mixer', undefined, 'loop delay', { value: 0.7 }),
    at('RECEIVER', 'Deflection', 'bend amount', { to: 0.8 }),
    at('RECEIVER', 'Deflection', 'supply ring (0 droop, 1 chaos)', { to: 0.9 }),
  ]),
  seq('B delay .2 · .7 · v size · bend', [
    at('mixer', undefined, 'loop delay', { value: 0.2 }),
    at('mixer', undefined, 'loop delay', { value: 0.7 }),
    at('RECEIVER', 'Deflection', 'v size (underscan)', { to: 0.6 }),
    at('RECEIVER', 'Deflection', 'bend amount', { to: 0.8 }),
  ]),
  seq('C delay .7 · pull · ring · bend', [
    at('mixer', undefined, 'loop delay', { value: 0.7 }),
    at('mixer', undefined, 'loop timebase pull', { to: 0.6 }),
    at('RECEIVER', 'Deflection', 'supply ring (0 droop, 1 chaos)', { to: 0.9 }),
    at('RECEIVER', 'Deflection', 'bend amount', { to: 0.8 }),
  ]),
]

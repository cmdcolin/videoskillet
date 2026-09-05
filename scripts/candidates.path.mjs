// The signal-path slide's own sequence, cumulative on Ridiculous rainbow: the
// mixer pill's rows first, then the receiver's deflection bank over them.
import { showcase } from './demos.mjs'

const board = showcase.find(d => d.name === 'Ridiculous rainbow').query
const at = (open, expand, row, to) => ({ open, expand, row, to })

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
        { wait: 900 },
        { steps: 40 },
        { shot: `${b.row} ${b.to}` },
      ]),
    ],
  },
]

export default [
  seq('A hue · offset · clock · bend · sag', [
    at('mixer', undefined, 'key hue', 0.3),
    at('mixer', undefined, 'key hue', 0.7),
    at('mixer', undefined, 'v offset', 0.55),
    at('mixer', undefined, 'read clock error', 0.6),
    at('RECEIVER', 'Deflection', 'bend amount', 0.8),
    at('RECEIVER', 'Deflection', 'HV sag', 0.8),
  ]),
  seq('B hue · strobe · bend · hold', [
    at('mixer', undefined, 'key hue', 0.7),
    at('mixer', undefined, 'strobe hold', 0.5),
    at('mixer', undefined, 'v offset', 0.55),
    at('RECEIVER', 'Deflection', 'bend amount', 0.8),
    at('RECEIVER', 'Sync', 'horizontal hold', 0.35),
  ]),
]

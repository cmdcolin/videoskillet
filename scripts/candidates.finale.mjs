// A finale for the signal-path slide, screened in real time over what the
// slide has made by then: loop delay at 0.7µs and bend amount at 0.8.
import { showcase } from './demos.mjs'

const board = showcase.find(d => d.name === 'Ridiculous rainbow').query
const at = (open, expand, row, at) => ({ open, expand, row, ...at })
const SETUP = [
  at('mixer', undefined, 'loop delay', { value: 0.2 }),
  { wait: 1500 },
  at('mixer', undefined, 'loop delay', { value: 0.7 }),
  { wait: 1500 },
  at('RECEIVER', 'Deflection', 'bend amount', { to: 0.8 }),
  { wait: 1200 },
  { shot: 'bend 0.8' },
]

const fin = (name, beat) => [
  name,
  {
    query: board,
    warm: 90,
    beats: [
      ...SETUP,
      beat,
      { wait: 300 },
      { shot: 'after' },
      { wait: 2000 },
      { shot: '+2s' },
      { wait: 2000 },
      { shot: '+4s' },
    ],
  },
]

export default [
  fin('shape ripple', {
    open: 'RECEIVER',
    expand: 'Deflection',
    choice: { row: 'shape', pick: 'ripple' },
  }),
  fin('shape bow', {
    open: 'RECEIVER',
    expand: 'Deflection',
    choice: { row: 'shape', pick: 'bow' },
  }),
  fin('shape skew', {
    open: 'RECEIVER',
    expand: 'Deflection',
    choice: { row: 'shape', pick: 'skew' },
  }),
  fin('HV sag 0.5', at('RECEIVER', 'Deflection', 'HV sag', { to: 0.5 })),
  fin('tint 0.85', at('RECEIVER', 'Decoder', 'tint', { to: 0.85 })),
  fin(
    'horizontal hold 0.35',
    at('RECEIVER', 'Sync', 'horizontal hold', { to: 0.35 }),
  ),
  fin(
    'subcarrier detune 0.75',
    at('RECEIVER', 'Decoder', 'subcarrier detune', { to: 0.75 }),
  ),
  fin('beam bloom 1', at('SCREEN', 'Beam', 'beam bloom', { to: 1 })),
  fin(
    'persistence 0.9',
    at('SCREEN', 'Phosphor', 'phosphor persistence', { to: 0.9 }),
  ),
]

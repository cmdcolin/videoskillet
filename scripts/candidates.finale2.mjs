// The decoder finale with its dependency honoured: burst lock down first, so
// the panel stops calling subcarrier detune inert, then the detune. Over loop
// delay 0.7µs and bend 0.8, in real time. `open` toggles a stage, so the
// receiver is opened once in the setup and only expanded after.
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
const then = (row, a) => [
  at(undefined, 'Decoder', row, a),
  { wait: 300 },
  { shot: `${row} ${a.to}` },
  { wait: 2000 },
  { shot: '+2s' },
]

const fin = (name, beats) => [
  name,
  { query: board, warm: 90, beats: [...SETUP, ...beats] },
]

export default [
  fin('burst 0 · detune .75', [
    ...then('burst lock', { to: 0 }),
    ...then('subcarrier detune', { to: 0.75 }),
  ]),
  fin('burst .3 · detune .75', [
    ...then('burst lock', { to: 0.3 }),
    ...then('subcarrier detune', { to: 0.75 }),
  ]),
  fin('burst 0 · detune .6', [
    ...then('burst lock', { to: 0 }),
    ...then('subcarrier detune', { to: 0.6 }),
  ]),
  fin('tint .85', [...then('tint', { to: 0.85 })]),
  fin('tint .85 · chroma gain .7', [
    ...then('tint', { to: 0.85 }),
    ...then('chroma gain', { to: 0.7 }),
  ]),
]

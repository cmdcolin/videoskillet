// A slide that opens stages off the signal path map and drags their rows, on
// the gallery boards that need no network: which board still has somewhere
// to go under a deflection, decoder, phosphor and mask row, cumulative.
import { demos } from './demos.mjs'

const board = name => demos.find(d => d.name === name).query

const walk = name => [
  name,
  {
    query: board(name),
    warm: 90,
    beats: [
      { steps: 30 },
      { shot: 'base' },
      { open: 'RECEIVER', expand: 'Deflection', row: 'v size', to: 0.6 },
      { wait: 800 },
      { steps: 30 },
      { shot: 'v size 0.6' },
      { open: 'RECEIVER', expand: 'Deflection', row: 'bend amount', to: 0.8 },
      { wait: 800 },
      { steps: 30 },
      { shot: 'bend 0.8' },
      { open: 'RECEIVER', expand: 'Decoder', row: 'tint', to: 0.8 },
      { wait: 800 },
      { steps: 30 },
      { shot: 'tint 0.8' },
      {
        open: 'SCREEN',
        expand: 'Phosphor',
        row: 'phosphor persistence',
        to: 0.85,
      },
      { wait: 800 },
      { steps: 30 },
      { shot: 'persistence 0.85' },
      { open: 'SCREEN', expand: 'Mask', row: 'convergence error', to: 0.85 },
      { wait: 800 },
      { steps: 30 },
      { shot: 'convergence 0.85' },
    ],
  },
]

export default [
  walk('Wiggity'),
  walk('Dark camera feedback'),
  walk('Chaos black and white feedback'),
]

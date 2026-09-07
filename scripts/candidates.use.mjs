// Rows a hand could pull on a signal-path slide, one at a time on four
// gallery boards that need no network, each opened off the map the way the
// take would open it. Which row visibly changes which board from where the
// look already sits.
import { demos } from './demos.mjs'

const board = name => demos.find(d => d.name === name).query

const probe = (look, tag, beats) => [
  `${look} · ${tag}`,
  {
    query: board(look),
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
const at = (open, expand, row, to) => ({ open, expand, row, to })

const RR = 'Ridiculous rainbow'
const WIG = 'Wiggity'
const CHAOS = 'Chaos black and white feedback'

export default [
  probe(RR, 'mixer a', [
    at('mixer', undefined, 'key hue', 0.3),
    at('mixer', undefined, 'key hue', 0.7),
    at('mixer', undefined, 'v offset', 0.55),
    at('mixer', undefined, 'loop timebase pull', 0.6),
  ]),
  probe(RR, 'mixer b', [
    at('mixer', undefined, 'loop resonance freq (0 off)', 0.4),
    at('mixer', undefined, 'strobe hold', 0.5),
    at('mixer', undefined, 'read clock error', 0.6),
    at('mixer', undefined, 'loop gain', 0.6),
  ]),
  probe(RR, 'receiver', [
    at('RECEIVER', 'Deflection', 'bend amount', 0.8),
    at('RECEIVER', 'Deflection', 'HV sag', 0.8),
    at('RECEIVER', 'Sync', 'horizontal hold', 0.35),
    at('SCREEN', 'Beam', 'beam bloom', 1),
  ]),
  probe(WIG, 'synth', [
    at('SOURCE A', 'Video synth', 'osc A', 0.3),
    at('SOURCE A', 'Video synth', 'osc A', 0.7),
    at('SOURCE A', 'Video synth', 'osc B', 0.6),
    at('SOURCE A', 'Video synth', 'colorizer', 0.8),
  ]),
  probe(WIG, 'receiver+mix', [
    at('RECEIVER', 'Deflection', 'shape', 0.8),
    at('RECEIVER', 'Deflection', 'decay / ripple period', 0.7),
    at('MIX', 'A/B Mixer', 'ring mod', 0.7),
    at('RECEIVER', 'Decoder', 'tint', 0.85),
  ]),
  probe(CHAOS, 'mixer+channel', [
    at('mixer', undefined, 'loop gain', 0.7),
    at('mixer', undefined, 'loop delay', 0.3),
    at('CHANNEL', 'RF / Tuner', 'fine tuning', 0.3),
    at('CHANNEL', 'RF / Tuner', 'fine tuning', 0.7),
  ]),
]

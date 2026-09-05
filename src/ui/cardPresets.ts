import { DEFAULT_CONTROLS } from '../core/controls'
import { FEED_A_CABLE_GROUP, FEED_B_CABLE_GROUP } from './controls'

import type { Controls } from '../core/controls'
import type { Group } from './controls'

// A setting of one card, not a look.
//
// The preset table answers "show me a whole rig". This answers the question
// underneath it — "what are the two or three things worth doing on *this*
// card" — and the difference is what keeps the preset table short. Four
// variations on a tape deck were four presets nobody could tell apart as whole
// boards, because the thing that varied between them was one card's worth of
// controls and the other thirty cards were carrying the resemblance. As chips
// on the tape card they are four settings, and the rest of the board is
// wherever your hand left it.
//
// Modelled on the cuts in ~/src/bender, including the part that makes them
// compose: applying one puts the card back to stock first, so pressing a second
// chip is that chip rather than a pile of both.
export interface CardPreset {
  // The `Group.name` this belongs to. A preset naming no live group is dead
  // weight, which `cardPresets.test.ts` fails on.
  group: string
  name: string
  // One line, lower case, said as what comes out rather than as which knobs
  // moved — the rows underneath already say which knobs moved.
  blurb: string
  patch: Partial<Controls>
}

export const CARD_PRESETS: CardPreset[] = [
  {
    group: 'VHS colour & tracking',
    name: 'colour-under',
    blurb:
      'chroma recorded down at 629 kHz and put back with the phase noise it picked up on the way',
    patch: { colorUnderMix: 1, underJitterDeg: 4, chromaNoiseIre: 6 },
  },
  {
    group: 'VHS colour & tracking',
    name: 'colour late',
    blurb:
      'the chroma path delayed against the luma, so every edge wears its colour half a step to the right',
    patch: { colorUnderMix: 0.8, ycDelayNs: 420, chromaNoiseIre: 4 },
  },
  {
    group: 'VHS colour & tracking',
    name: 'bad tracking',
    blurb:
      'a band of torn picture parked low in the frame, where a deck that has lost the track puts it',
    patch: { trackAmt: 0.55, trackPos: 0.62, colorUnderMix: 0.7 },
  },
  {
    group: 'VHS colour & tracking',
    name: 'hunting servo',
    blurb:
      'the band never settles: the servo sweeps for the track, overshoots, rings back and loses it again',
    patch: {
      trackAmt: 0.4,
      trackHunt: 0.6,
      trackKick: 0.5,
      colorUnderMix: 0.7,
    },
  },
  {
    group: 'Timebase',
    name: 'gentle wow',
    blurb:
      'the capstan wandering slowly — the picture breathes sideways rather than shaking',
    patch: { tbWowNs: 300, tbJitterNs: 60 },
  },
  {
    group: 'Timebase',
    name: 'flutter',
    blurb:
      'line-rate jitter: every line starts somewhere slightly different and the verticals go soft',
    patch: { tbJitterNs: 900, tbWowNs: 150 },
  },
  {
    group: 'Timebase',
    name: 'sticky shed',
    blurb:
      'binder gone: the tape grabs the drum, tension builds, the patch breaks free and re-sticks',
    patch: { tbStickNs: 5200, tbJitterNs: 200 },
  },
  {
    group: 'Timebase',
    name: 'head switch',
    blurb:
      'the seam where the drum changes heads, sitting visible at the bottom of the picture',
    patch: { headSwitchShiftUs: 1.4, headSwitchNoise: 0.55 },
  },
  {
    group: 'Noise & interference',
    name: 'tape grain',
    blurb:
      'the deck’s own floor, tilted up toward the top of the band where it decodes as crawling colour',
    patch: { noiseIre: 4, noiseTilt: 0.8 },
  },
  {
    group: 'Noise & interference',
    name: 'ignition',
    blurb:
      'a car outside: bursts of hash arriving in flurries, with real quiet between them',
    patch: { impulseRate: 7, impulseIre: 180 },
  },
  {
    group: 'Noise & interference',
    name: 'dimmer hash',
    blurb:
      'a triac chopping the mains twice a cycle, so the interference stands still while the picture moves',
    patch: { impulseRate: 9, impulseMains: 1, impulseIre: 140 },
  },
  {
    group: 'Dropouts & dubs',
    name: 'light specks',
    blurb: 'the odd shed patch of oxide — white dashes a few microseconds long',
    patch: { dropoutRate: 8, dropoutLenUs: 4 },
  },
  {
    group: 'Dropouts & dubs',
    name: 'shedding',
    blurb:
      'a tape that is losing its coating: long dropouts, often enough that the compensator gives up',
    patch: { dropoutRate: 90, dropoutLenUs: 22, dropoutComp: 0 },
  },
  {
    group: 'Dropouts & dubs',
    name: 'third generation',
    blurb:
      'a dub of a dub of a dub — each pass adds its own noise, its own dropouts and its own wander',
    patch: { dubGens: 3, dropoutRate: 20 },
  },
  {
    group: 'RF / Tuner',
    name: 'adjacent channel',
    blurb:
      'the next channel up leaking past the trap as beats: slanted bars that sweep, hang and reverse',
    patch: { rfAdjacent: 0.7 },
  },
  {
    group: 'RF / Tuner',
    name: 'mistuned',
    blurb:
      'the picture carrier slid down the IF slope — fine detail and colour go first',
    patch: { rfMistuneMHz: 1.6 },
  },
  {
    group: 'RF / Tuner',
    name: 'fringe',
    blurb: 'a station at the edge of range, arriving mostly as snow',
    patch: { rfSnow: 0.55, rfMistuneMHz: 0.3 },
  },
  {
    group: 'RF / Tuner',
    name: 'cb ingress',
    blurb: 'somebody keying a radio into a cable with a bad shield',
    patch: { ingress: 0.6 },
  },
  {
    group: 'Signal (source A)',
    name: 'capture card',
    blurb:
      'what a consumer grabber already did to the file: luma cut to 2.4 MHz, colour-under chroma, colour a few samples late, grain in both',
    patch: {
      capLumaMHz: 2.4,
      capChromaMHz: 0.4,
      capYcDelayNs: 300,
      capNoiseIre: 6,
      capChromaNoiseIre: 20,
    },
  },
  {
    group: 'Signal (source A)',
    name: 'bob deinterlace',
    blurb:
      'each frame rebuilt from one field, which is what kills a dongle’s combing',
    patch: { deint: 1 },
  },
  {
    group: FEED_A_CABLE_GROUP,
    name: 'ground loop',
    blurb:
      'a hum bar on A’s run alone, lifting A’s sync tips with it so the receiver chases this feed and not the other',
    patch: { aHumIre: 30 },
  },
  {
    group: FEED_A_CABLE_GROUP,
    name: 'open cable',
    blurb:
      'A unterminated: hot, ringing on every edge, and winning the sync contest against anything healthy',
    patch: { aTermination: 1 },
  },
  {
    group: FEED_A_CABLE_GROUP,
    name: 'wiggled plug',
    blurb:
      'both of A’s contacts intermittent, so bands go to snow and bands go to hum, on independent lines',
    patch: { aConnector: 0.4, aConnectorMode: 2 },
  },
  {
    group: FEED_A_CABLE_GROUP,
    name: 'long run',
    blurb: 'snow on A alone, with B summing in clean over the top of it',
    patch: { aNoiseIre: 40 },
  },
  {
    group: FEED_B_CABLE_GROUP,
    name: 'ground loop, other leg',
    blurb:
      'B’s hum bar on the opposite phase of the mains, so with A’s it pushes the other way',
    patch: { bHumIre: -30 },
  },
  {
    group: FEED_B_CABLE_GROUP,
    name: 'daisy-chained',
    blurb:
      'B double-terminated: dim and shallow, and losing every sync contest to A',
    patch: { bTermination: -1 },
  },
  {
    group: FEED_B_CABLE_GROUP,
    name: 'wiggled plug',
    blurb:
      'B’s centre pin making and breaking, so B stops pushing sync for a band and then comes back fighting',
    patch: { bConnector: 0.35, bConnectorMode: 0 },
  },
  {
    group: 'Character generator (chyron)',
    name: 'mis-timed key',
    blurb:
      'the key three samples behind the fill: background through one side of every stem, a hard shadow down the other',
    patch: { cgMix: 1, cgKeyDelayNs: 210, cgScale: 3 },
  },
  {
    group: 'Character generator (chyron)',
    name: 'detached shadow',
    blurb:
      'the edge generator’s delays pulled far past the one sample and one line they were meant to be, so the drop shadow walks off the type',
    patch: { cgMix: 1, cgEdgeX: 14, cgEdgeY: -9, cgScale: 3 },
  },
  {
    group: 'Character generator (chyron)',
    name: 'letters are holes',
    blurb:
      'the key cut the other way: a black raster with the picture showing only through the type',
    patch: { cgMix: 1, cgInvert: 1, cgScale: 6, cgX: 0.02, cgY: 0.2 },
  },
  {
    group: 'Character generator (chyron)',
    name: 'held rom pin',
    blurb:
      'an address line and a data line held on the font ROM: the font substituted for its neighbour, with a stripe down every character',
    patch: { cgMix: 1, cgScale: 3, cgRomAddr: 9, cgRomData: -5 },
  },
  {
    group: 'Character generator (chyron)',
    name: 'overmodulated',
    blurb:
      'type laid in at 120 IRE, past peak white, so the AGC and the sound detector react to every word',
    patch: { cgMix: 1, cgFill: 120, cgScale: 4 },
  },
  {
    group: 'PiP inset (source B)',
    name: 'corner inset',
    blurb:
      'B squeezed into a bordered box top right, re-encoded on the house raster so it dot-crawls but never beats',
    patch: { pipMix: 1 },
  },
  {
    group: 'PiP inset (source B)',
    name: 'keyed subject',
    blurb:
      'a big centred inset keyed on its own brightness, so B’s bright parts land over A without the rectangle',
    patch: {
      pipMix: 1,
      pipX: 0.5,
      pipY: 0.5,
      pipW: 0.6,
      pipH: 0.6,
      pipKey: 0.7,
      pipKeyLevel: 0.3,
      pipKeySoft: 0.1,
    },
  },
  {
    group: 'Decoder',
    name: 'tint backwards',
    blurb:
      'the tint knob at the end of its travel: every hue its complement, brightness untouched',
    patch: { tintDeg: 180 },
  },
  {
    group: 'Decoder',
    name: 'x/z axes',
    blurb:
      'the two demodulators pulled to 45 degrees apart, so the colour wheel shears and opposite hues stop being opposite',
    patch: { demodAxisDeg: 45, chromaGain: 1.4 },
  },
  {
    group: 'Deflection',
    name: 'service underscan',
    blurb:
      'the vertical scan shrunk so the raster shows past the picture: the vertical interval above it, the head switch below',
    patch: { vSize: 0.7 },
  },
  {
    group: 'Captions',
    name: 'decoder on',
    blurb:
      'line 21 sliced off the signal the set actually got, misspelt by whatever the path did to it',
    patch: { cc: 1 },
  },
  {
    group: 'Captions',
    name: 'bent rom',
    blurb:
      'a pin held on the decoder’s font ROM: every glyph grows a seam and one column of dots is held down the page',
    patch: { cc: 1, ccRomAddr: 2, ccRomData: -5 },
  },
]

export const cardPresetsFor = (group: string): CardPreset[] =>
  CARD_PRESETS.filter(p => p.group === group)

// The card put back to stock, then the chip's own values written into it.
//
// Resetting first is what makes these compose rather than stack: pressing
// "sticky shed" after "gentle wow" is sticky shed, not a deck with both faults
// on it. It is also what keeps the chip honest about what it is — the rows
// underneath show exactly the patch and nothing left over from the last press.
//
// Everything outside the card is untouched, which is the whole point of a card
// preset: it is a setting, and a setting does not get to have an opinion about
// the rest of the board.
export function applyCardPreset(
  preset: CardPreset,
  group: Group,
  current: Controls,
): Controls {
  const next = { ...current }
  for (const s of group.sliders) {
    next[s.key] = preset.patch[s.key] ?? DEFAULT_CONTROLS[s.key]
  }
  return next
}

// Whether the card is standing exactly on one of its chips, for lighting it up.
// Compared over the card's own controls alone — a chip is a claim about this
// card, so what the rest of the board is doing cannot make it false.
export function activeCardPreset(
  group: Group,
  current: Controls,
): CardPreset | undefined {
  return cardPresetsFor(group.name).find(p =>
    group.sliders.every(s => {
      const want = p.patch[s.key] ?? DEFAULT_CONTROLS[s.key]
      return current[s.key] === want
    }),
  )
}

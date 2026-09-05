// A variants module for `reelscreen.mjs`: four presses of the random button on
// the photograph, one tile a press, over three seeds; and one blend of two
// chips with a tile after each. Copy it, change the beats, run
//
//   node scripts/reelscreen.mjs scripts/reelscreen.example.mjs /tmp/sheet
//
// and look at /tmp/sheet/sheet.jpg.
const rolls = seed => [
  `random look, seed ${seed}`,
  {
    query: `?src=cat&seed=${seed}`,
    beats: [1, 2, 3, 4].flatMap(i => [
      { press: 'random look' },
      { wait: 1500 },
      { steps: 40 },
      { shot: `press ${i}` },
      { lit: true },
    ]),
  },
]

// A chip is dragged by the label on it and seeded as a recent by its preset
// name, which differ where the name needed more than one word.
const blend = ([a, aName], ta, [b, bName], tb) => [
  `${a} ${ta} + ${b} ${tb}`,
  {
    query: '?src=cat',
    // Seeded as recents, so both chips sit on the shortlist row beside `clean`.
    seed: { video_feedback_recent_presets: JSON.stringify([aName, bName]) },
    beats: [
      { mix: a, to: ta },
      { wait: 1300 },
      { steps: 40 },
      { shot: `${a} ${ta}` },
      { mix: b, to: tb },
      { wait: 1300 },
      { steps: 40 },
      { shot: `+ ${b} ${tb}` },
      { steps: 120 },
      { shot: '+2s' },
    ],
  },
]

export default [
  rolls(13),
  rolls(26),
  rolls(29),
  blend(
    ['silkscreen', 'silkscreen'],
    0.8,
    ['supply chaos', 'supplyChaos'],
    0.5,
  ),
]

// Rows a hand could pull on the signal-path slide, screened on its backdrop.
// Wiggity already bends on a Lorenz wire, so what is wanted here is a row that
// reads over that: a geometry the eye can name, a colour that turns, a tube
// artifact — and nothing that flashes. `blanking strobe`, `vertical hold` with
// `vertical osc`, and `frame roll` are ruled out on that ground alone.
const one = (open, expand, row, to) => [{ open, expand, row, to }]
const two = (open, expand, a, ta, b, tb) => [
  { open, expand, row: a, to: ta },
  { open, expand, row: b, to: tb },
]
export default [
  ['base', []],
  ['vsize-small', one('RECEIVER', 'Deflection', 'v size', 0.12)],
  ['vsize-big', one('RECEIVER', 'Deflection', 'v size', 0.6)],
  ['bend-hi', one('RECEIVER', 'Deflection', 'bend amount', 0.9)],
  ['hvsag', one('RECEIVER', 'Deflection', 'HV sag', 0.85)],
  ['supplyring', one('RECEIVER', 'Deflection', 'supply ring', 0.7)],
  ['chromagain', one('RECEIVER', 'Decoder', 'chroma gain', 0.45)],
  ['tint', one('RECEIVER', 'Decoder', 'tint', 0.85)],
  ['scdetune', one('RECEIVER', 'Decoder', 'subcarrier detune', 0.7)],
  ['chromatrail', one('RECEIVER', 'Decoder', 'chroma trail', 0.8)],
  ['demodaxis', one('RECEIVER', 'Decoder', 'demod axis', 0.6)],
  ['yccomb', one('RECEIVER', 'Decoder', 'Y/C comb', 0.0)],
  ['chromabw', one('RECEIVER', 'Decoder', 'chroma bandwidth', 0.02)],
  ['persistence', one('SCREEN', 'Phosphor', 'phosphor persistence', 0.85)],
  [
    'trailtint',
    two('SCREEN', 'Phosphor', 'phosphor persistence', 0.85, 'trail tint', 0.6),
  ],
  ['grille', one('SCREEN', 'Mask', 'aperture grille', 0.9)],
  ['convergence', one('SCREEN', 'Mask', 'convergence error', 0.85)],
  ['purity', one('SCREEN', 'Mask', 'purity', 0.9)],
  ['beamspot', one('SCREEN', 'Beam', 'beam spot', 0.5)],
  ['ghost', two('CHANNEL', 'Ghosting', 'ghost delay', 0.5, 'ghost gain', 0.8)],
  ['shuttle', one('CHANNEL', 'VHS colour', 'shuttle', 0.62)],
  ['tracking', one('CHANNEL', 'VHS colour', 'tracking error', 0.7)],
  ['stickyshed', one('CHANNEL', 'Timebase', 'sticky shed', 0.5)],
  ['wow', one('CHANNEL', 'Timebase', 'wow', 0.6)],
  [
    'colorunder',
    two('CHANNEL', 'VHS colour', 'color-under', 1, 'chroma noise', 0.5),
  ],
  ['dubs', one('CHANNEL', 'Dropouts', 'dub generations', 1)],
  ['weaksignal', one('CHANNEL', 'RF', 'weak signal', 0.5)],
  ['lineoffset', one('MIX', 'A/B Mixer', 'line offset', 0.75)],
  ['scdetune-mix', one('MIX', 'A/B Mixer', 'sc detune', 0.62)],
  ['ringmod', one('MIX', 'A/B Mixer', 'ring mod', 0.6)],
  ['overload', one('MIX', 'A/B Mixer', 'bus overload', 0.6)],
  ['wipe', two('MIX', 'Wipe', 'pattern', 0.5, 'position', 0.5)],
]

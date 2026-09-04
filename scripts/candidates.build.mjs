// Rows that could follow the loops on the `build` slide, screened on its own
// backdrop: colour bars, the camera loop open at 0.7 and turned 6°, the mixer
// loop patched in at 0.95. The three rows the slide used to finish on — `loop
// delay` at a third of a per cent, `FM over-deviation`, `beam bloom` — read as
// nothing in the take, so this asks every stage for a row that visibly changes
// the picture from here, and asks the delay row again at travels a hand can see.
const LOOPS = [
  { open: 'camera', row: 'mix', to: 0.7 },
  { open: 'camera', row: 'rotate', to: 0.73 },
  { open: 'mixer', row: 'loop mix', to: 0.95 },
]
const then = (...beats) => [...LOOPS, ...beats]
const at = (open, row, to, expand) => ({ open, row, to, expand })
export default [
  ['base', LOOPS],
  ['delay-0022', then(at('mixer', 'loop delay', 0.0022))],
  ['delay-03', then(at('mixer', 'loop delay', 0.03))],
  ['delay-12', then(at('mixer', 'loop delay', 0.12))],
  ['delay-40', then(at('mixer', 'loop delay', 0.4))],
  ['loopgain', then(at('mixer', 'loop gain', 0.75))],
  ['voffset', then(at('mixer', 'v offset', 0.6))],
  ['timebase-pull', then(at('mixer', 'loop timebase pull', 0.7))],
  ['zoom', then(at('camera', 'zoom', 0.6))],
  ['shiftx', then(at('camera', 'shift x', 0.6))],
  ['defocus', then(at('camera', 'defocus', 0.5))],
  ['fmdev', then(at('CHANNEL', 'FM over-deviation', 0.5))],
  ['fmdev-hi', then(at('CHANNEL', 'FM over-deviation', 1))],
  ['lumabw', then(at('CHANNEL', 'luma bandwidth', 0.05))],
  ['stickyshed', then(at('CHANNEL', 'sticky shed', 0.5, 'Timebase'))],
  ['wow', then(at('CHANNEL', 'wow', 0.6, 'Timebase'))],
  ['tracking', then(at('CHANNEL', 'tracking error', 0.7, 'VHS colour'))],
  ['colorunder', then(at('CHANNEL', 'color-under', 1, 'VHS colour'))],
  [
    'ghost',
    then(
      at('CHANNEL', 'ghost delay', 0.5, 'Ghosting'),
      at('CHANNEL', 'ghost gain', 0.6, 'Ghosting'),
    ),
  ],
  ['hum', then(at('CHANNEL', 'hum', 0.6, 'Ghosting'))],
  ['hvsag', then(at('RECEIVER', 'HV sag', 0.8, 'Deflection'))],
  ['vsize', then(at('RECEIVER', 'v size', 0.6, 'Deflection'))],
  ['tint', then(at('RECEIVER', 'tint', 0.85, 'Decoder'))],
  ['chromagain', then(at('RECEIVER', 'chroma gain', 0.5, 'Decoder'))],
  ['scdetune', then(at('RECEIVER', 'subcarrier detune', 0.75, 'Decoder'))],
  ['beambloom', then(at('SCREEN', 'beam bloom', 0.4))],
  ['beambloom-hi', then(at('SCREEN', 'beam bloom', 1))],
  ['beamspot', then(at('SCREEN', 'beam spot', 0.6))],
  ['svm', then(at('SCREEN', 'scan velocity mod', 0.95))],
  ['persistence', then(at('SCREEN', 'phosphor persistence', 0.9, 'Phosphor'))],
  ['grille', then(at('SCREEN', 'aperture grille', 0.9, 'Mask'))],
  ['convergence', then(at('SCREEN', 'convergence error', 0.9, 'Mask'))],
]

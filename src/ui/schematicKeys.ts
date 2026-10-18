import {
  CAMERA_LOOP_GROUP,
  FEED_A_CABLE_GROUP,
  FEED_B_CABLE_GROUP,
  MIXER_LOOP_GROUP,
  SYNTH_GROUP,
  TUBE_FACE_GROUP,
} from './controls'

import type { ControlKey } from '../core/controls'

// The controls each panel schematic draws a box for. ControlGroup folds these
// behind the drawing, so they live apart from the components that draw them.
// Each OPENS table maps a box id to the controls the box opens.

type Opens = Record<string, readonly ControlKey[]>

export const MIXER_LOOP_KEYS = [
  'cfbMix',
  'cfbGain',
  'cfbDelayUs',
  'cfbServoUs',
  'cfbLines',
  'cfbKey',
  'cfbKeyLevel',
  'cfbKeySoft',
  'cfbKeyExt',
  'cfbKeyHueDeg',
  'cfbKeyAcceptDeg',
  'cfbHold',
  'cfbTrail',
  'cfbFilterMHz',
  'cfbFilterQ',
  'cfbFilterBoost',
  'cfbRing',
  'cfbClockPct',
  'cfbNoiseIre',
  'cfbGenlock',
  'cfbReturn',
  'cfbRingSrc',
  'cfbCarrierKHz',
] as const satisfies readonly ControlKey[]

export const MIXER_LOOP_OPENS = {
  fader: ['cfbMix', 'cfbGain'],
  keyer: [
    'cfbKey',
    'cfbKeyExt',
    'cfbKeyLevel',
    'cfbKeySoft',
    'cfbKeyAcceptDeg',
    'cfbKeyHueDeg',
  ],
  store: [
    'cfbHold',
    'cfbTrail',
    'cfbGenlock',
    'cfbClockPct',
    'cfbLines',
    'cfbDelayUs',
    'cfbServoUs',
  ],
  return: ['cfbReturn', 'cfbNoiseIre'],
  resonance: ['cfbFilterMHz', 'cfbFilterQ', 'cfbFilterBoost'],
  ring: ['cfbRing', 'cfbRingSrc', 'cfbCarrierKHz'],
} as const satisfies Record<string, readonly (typeof MIXER_LOOP_KEYS)[number][]>

export const CAMERA_LOOP_OPENS = {
  fader: ['fbMix', 'fbGain'],
  iris: ['fbIris'],
  lens: ['fbZoom', 'fbRotateDeg', 'fbShiftX', 'fbShiftY', 'fbFocus', 'fbVign'],
  pickup: ['fbLag', 'fbComet', 'fbBlack', 'fbKnee'],
} as const satisfies Opens

export const CAMERA_LOOP_KEYS = Object.values(CAMERA_LOOP_OPENS).flat()

export const TUBE_FACE_OPENS = {
  face: [
    'crtCutoff',
    'crtGamma',
    'crtSat',
    'crtBloom',
    'crtHalation',
    'crtHaloKey',
    'crtGlow',
  ],
} as const satisfies Opens

export const TUBE_FACE_KEYS = TUBE_FACE_OPENS.face

export const DECODER_KEYS = [
  'combMode',
  'svideoBleed',
  'demodMHz',
  'chromaTail',
  'chromaCoarse',
  'chromaGain',
  'tintDeg',
  'burstLock',
  'demodAxisDeg',
  'scDetuneKHz',
  'killThresh',
  'accLagLines',
  'afpcLagLines',
  'vir',
  'virLag',
  'matrixClip',
  'agc',
  'encChromaMHz',
] as const satisfies readonly ControlKey[]

export const DECODER_OPENS = {
  input: ['encChromaMHz', 'agc'],
  split: ['combMode', 'svideoBleed'],
  demod: ['demodMHz', 'demodAxisDeg', 'chromaTail', 'chromaCoarse'],
  reference: ['burstLock', 'afpcLagLines', 'tintDeg', 'scDetuneKHz'],
  acc: ['chromaGain', 'accLagLines', 'killThresh', 'vir', 'virLag'],
  matrix: ['matrixClip'],
} as const satisfies Opens

export const RECORDING_OPENS = {
  emphasis: [],
  fm: ['fmOverdev', 'fmStreakUs'],
  filter: ['lumaMHz', 'lumaPeak'],
  differential: ['diffGain', 'diffPhaseDeg'],
} as const satisfies Opens

export const RECORDING_KEYS = Object.values(RECORDING_OPENS).flat()

export interface Bends {
  romAddr: ControlKey
  romData: ControlKey
  romCross: ControlKey
  romSlip: ControlKey
  romLineSlip: ControlKey
  romStride: ControlKey
  romRot: ControlKey
  pageAddr: ControlKey
  pageSlip: ControlKey
}

export const CG_BENDS: Bends = {
  romAddr: 'cgRomAddr',
  romData: 'cgRomData',
  romCross: 'cgRomCross',
  romSlip: 'cgRomSlip',
  romLineSlip: 'cgRomLineSlip',
  romStride: 'cgRomStride',
  romRot: 'cgRomRot',
  pageAddr: 'cgPageAddr',
  pageSlip: 'cgPageSlip',
}

export const CC_BENDS: Bends = {
  romAddr: 'ccRomAddr',
  romData: 'ccRomData',
  romCross: 'ccRomCross',
  romSlip: 'ccRomSlip',
  romLineSlip: 'ccRomLineSlip',
  romStride: 'ccRomStride',
  romRot: 'ccRomRot',
  pageAddr: 'ccPageAddr',
  pageSlip: 'ccPageSlip',
}

export const CHYRON_KEYS: readonly ControlKey[] = [
  'cgMix',
  'cgX',
  'cgY',
  'cgScale',
  'cgKeyMHz',
  'cgClip',
  'cgFill',
  'cgKeyDelayNs',
  'cgEdgeX',
  'cgEdgeY',
  'cgInvert',
  ...Object.values(CG_BENDS),
]

export const CAPTION_KEYS: readonly ControlKey[] = [
  'ccBox',
  ...Object.values(CC_BENDS),
]

export const CHYRON_OPENS = {
  raster: ['cgX', 'cgY', 'cgScale'],
  'page counter': [CG_BENDS.pageSlip],
  'page ram': [],
  'char counter': [CG_BENDS.romStride, CG_BENDS.romSlip, CG_BENDS.romLineSlip],
  'font rom': [CG_BENDS.romRot],
  keyer: [
    'cgKeyMHz',
    'cgClip',
    'cgKeyDelayNs',
    'cgEdgeX',
    'cgEdgeY',
    'cgInvert',
  ],
  mix: ['cgMix', 'cgFill'],
  'page bus': [CG_BENDS.pageAddr],
  'address bus': [CG_BENDS.romAddr, CG_BENDS.romCross],
  'data bus': [CG_BENDS.romData],
} as const satisfies Opens

export const CAPTION_OPENS = {
  raster: [],
  'page counter': [CC_BENDS.pageSlip],
  'page ram': [],
  'char counter': [CC_BENDS.romStride, CC_BENDS.romSlip, CC_BENDS.romLineSlip],
  'font rom': [CC_BENDS.romRot],
  'caption box': ['ccBox'],
  'page bus': [CC_BENDS.pageAddr],
  'address bus': [CC_BENDS.romAddr, CC_BENDS.romCross],
  'data bus': [CC_BENDS.romData],
} as const satisfies Opens

export const DEFLECTION_KEYS = [
  'bendUs',
  'bendShape',
  'bendPeriod',
  'vSize',
  'vLin',
  'vFold',
  'retraceLines',
  'flybackLines',
  'hvSagUs',
  'hvRing',
  'abl',
] as const satisfies readonly ControlKey[]

export const DEFLECTION_OPENS = {
  limiter: ['abl'],
  tank: ['hvSagUs', 'hvRing'],
  bend: ['bendUs', 'bendShape', 'bendPeriod'],
  output: ['vSize', 'vLin', 'vFold'],
  flyback: ['flybackLines', 'retraceLines'],
} as const satisfies Opens

export const SYNC_KEYS = [
  'hHold',
  'syncSlicer',
  'vHold',
  'vFreqHz',
  'syncBendUs',
  'hDetuneHz',
] as const satisfies readonly ControlKey[]

export const SYNC_OPENS = {
  separator: ['syncSlicer'],
  flywheel: ['hHold', 'syncBendUs'],
  hosc: ['hDetuneHz'],
  vosc: ['vFreqHz', 'vHold'],
} as const satisfies Opens

export const TIMEBASE_OPENS = {
  capstan: ['tbWowNs', 'tbJitterNs'],
  shed: ['tbStickNs'],
  drum: ['headSwitchShiftUs', 'headSwitchNoise'],
} as const satisfies Opens

export const TIMEBASE_KEYS = Object.values(TIMEBASE_OPENS).flat()

export const VHS_OPENS = {
  tape: ['chromaNoiseIre'],
  up: ['underJitterDeg'],
  mix: ['colorUnderMix'],
  delay: ['ycDelayNs'],
  tracking: ['trackAmt', 'trackPos'],
  servo: ['trackHunt', 'trackKick'],
  capstan: ['shuttleX'],
  heads: ['headClog'],
} as const satisfies Opens

export const VHS_KEYS = Object.values(VHS_OPENS).flat()

export const ENHANCER_OPENS = {
  clamp: ['enhClampUs'],
  droop: ['enhDroopUs'],
  peaking: ['enhPeakMHz', 'enhPeakQ', 'enhPeakBoost'],
  regen: ['enhSync', 'enhSliceIre'],
} as const satisfies Opens

export const ENHANCER_KEYS = Object.values(ENHANCER_OPENS).flat()

export const LEAK_OPENS = {
  ghost: ['ghostDelayUs', 'ghostGain'],
  hum: ['humAmp', 'humMod'],
  sound: ['soundIre'],
  buzz: ['buzzLevel'],
} as const satisfies Opens

export const LEAK_KEYS = Object.values(LEAK_OPENS).flat()

export const NOISE_OPENS = {
  floor: ['noiseIre', 'noiseTilt'],
  arcs: ['impulseRate', 'impulseIre', 'impulseMains'],
  ignition: ['impulseHz'],
  strikes: ['strikeRate'],
} as const satisfies Opens

export const NOISE_KEYS = Object.values(NOISE_OPENS).flat()

export const CABLE_OPENS = {
  guard: ['macrovision', 'mvStripeDeg'],
  scramble: ['scramble', 'scrambleMode'],
  chroma: ['chromaPinOnly'],
  plug: ['connectorGlitch', 'connectorMode'],
  flip: ['polarityFlip'],
  load: ['termination'],
} as const satisfies Opens

export const CABLE_KEYS = Object.values(CABLE_OPENS).flat()

export const FEED_CABLE_OPENS = {
  a: {
    snow: ['aNoiseIre'],
    hum: ['aHumIre'],
    plug: ['aConnector', 'aConnectorMode'],
    flip: ['aPolarity'],
    load: ['aTermination'],
  },
  b: {
    snow: ['bNoiseIre'],
    hum: ['bHumIre'],
    plug: ['bConnector', 'bConnectorMode'],
    flip: ['bPolarity'],
    load: ['bTermination'],
  },
} as const satisfies Record<'a' | 'b', Opens>

export const FEED_CABLE_KEYS = {
  a: Object.values(FEED_CABLE_OPENS.a).flat(),
  b: Object.values(FEED_CABLE_OPENS.b).flat(),
}

export const AUDIO_OPENS = {
  wave: ['audioGain'],
  video: ['audioIre'],
  roll: ['audioRoll'],
  tear: ['audioTear'],
  sag: ['audioSagUs'],
  tank: ['audioLoad'],
  bend: ['audioBendUs'],
  hue: ['audioHueDeg'],
} as const satisfies Opens

export const AUDIO_KEYS = Object.values(AUDIO_OPENS).flat()

export const BUS_OPENS = {
  gainA: ['aGain'],
  timing: ['bLineHz', 'bRollLps', 'bDetuneHz'],
  lock: ['bGenlock'],
  gainB: ['bGain'],
  ring: ['bRing'],
  clip: ['busClip'],
} as const satisfies Opens

export const BUS_KEYS = Object.values(BUS_OPENS).flat()

export const SYNTH_OPENS = {
  luma: ['synthFm', 'synthFmSrc'],
  oscA: ['synthAHz'],
  oscB: ['synthBHz'],
  shape: ['synthShape'],
  mix: ['synthMix'],
  level: ['synthLevel'],
  colour: [
    'synthColor',
    'synthHueDeg',
    'synthColorSoftPx',
    'synthColorSrc',
    'synthColorMode',
  ],
  over: ['synthOver'],
} as const satisfies Opens

export const SYNTH_KEYS = Object.values(SYNTH_OPENS).flat()

export const RF_OPENS = {
  adjacent: ['rfAdjacent'],
  tuning: ['rfMistuneMHz'],
  snow: ['rfSnow'],
  ingress: ['ingress'],
} as const satisfies Opens

export const RF_KEYS = Object.values(RF_OPENS).flat()

export const DUB_OPENS = {
  drops: ['dropoutRate', 'dropoutLenUs'],
  patch: ['dropoutComp'],
  dub: ['dubGens'],
} as const satisfies Opens

export const DUB_KEYS = Object.values(DUB_OPENS).flat()

export const BEAM_OPENS = {
  strobe: ['strobeHz', 'strobeMs'],
  spot: ['crtSpot', 'crtGrain'],
  svm: ['crtSvm', 'crtSvmWidth'],
  recon: ['crtSharp'],
  lines: ['scanBeam', 'scanBloom'],
} as const satisfies Opens

export const BEAM_KEYS = Object.values(BEAM_OPENS).flat()

export const CROSSPOINT_OPENS = {
  wander: ['bWanderUs'],
  capture: ['bCaptureUs'],
  leak: ['bLeak'],
  cut: ['busCut'],
} as const satisfies Opens

export const CROSSPOINT_KEYS = Object.values(CROSSPOINT_OPENS).flat()

export const CHROMA_KEY_OPENS = {
  spill: ['bKeySpill'],
  delay: ['bKeyDelayUs'],
  keyer: ['bKeyHueDeg', 'bKeyAcceptDeg', 'bKeyClip', 'bKeySoft'],
  fill: ['bKeyFill', 'bKeyMatteY', 'bKeyMatteHueDeg', 'bKeyMatteSat'],
  mix: ['bKey'],
} as const satisfies Opens

export const CHROMA_KEY_KEYS = Object.values(CHROMA_KEY_OPENS).flat()

export const PHOSPHOR_OPENS = {
  primaries: ['phosphorMode'],
  persistence: ['phosphor', 'phosphorSkew'],
  scatter: ['phosphorBleed'],
  burn: ['burnRate', 'burnDepth'],
} as const satisfies Opens

export const PHOSPHOR_KEYS = Object.values(PHOSPHOR_OPENS).flat()

export const SCHEMATICS = [
  {
    group: CAMERA_LOOP_GROUP,
    keys: CAMERA_LOOP_KEYS,
    opens: CAMERA_LOOP_OPENS,
  },
  { group: TUBE_FACE_GROUP, keys: TUBE_FACE_KEYS, opens: TUBE_FACE_OPENS },
  { group: MIXER_LOOP_GROUP, keys: MIXER_LOOP_KEYS, opens: MIXER_LOOP_OPENS },
  {
    group: 'Character generator (chyron)',
    keys: CHYRON_KEYS,
    opens: CHYRON_OPENS,
  },
  { group: 'Captions', keys: CAPTION_KEYS, opens: CAPTION_OPENS },
  { group: 'Decoder', keys: DECODER_KEYS, opens: DECODER_OPENS },
  {
    group: 'Recording (luma & FM)',
    keys: RECORDING_KEYS,
    opens: RECORDING_OPENS,
  },
  { group: 'Sync', keys: SYNC_KEYS, opens: SYNC_OPENS },
  { group: 'Deflection', keys: DEFLECTION_KEYS, opens: DEFLECTION_OPENS },
  { group: 'Timebase', keys: TIMEBASE_KEYS, opens: TIMEBASE_OPENS },
  { group: 'VHS colour & tracking', keys: VHS_KEYS, opens: VHS_OPENS },
  { group: 'Enhancer (bent)', keys: ENHANCER_KEYS, opens: ENHANCER_OPENS },
  { group: 'Noise & interference', keys: NOISE_KEYS, opens: NOISE_OPENS },
  { group: 'A/B Mixer', keys: BUS_KEYS, opens: BUS_OPENS },
  { group: 'Crosspoint', keys: CROSSPOINT_KEYS, opens: CROSSPOINT_OPENS },
  { group: SYNTH_GROUP, keys: SYNTH_KEYS, opens: SYNTH_OPENS },
  { group: 'Dropouts & dubs', keys: DUB_KEYS, opens: DUB_OPENS },
  { group: 'RF / Tuner', keys: RF_KEYS, opens: RF_OPENS },
  { group: 'Cable / Wiring', keys: CABLE_KEYS, opens: CABLE_OPENS },
  { group: 'Audio routings', keys: AUDIO_KEYS, opens: AUDIO_OPENS },
  {
    group: FEED_A_CABLE_GROUP,
    keys: FEED_CABLE_KEYS.a,
    opens: FEED_CABLE_OPENS.a,
  },
  {
    group: FEED_B_CABLE_GROUP,
    keys: FEED_CABLE_KEYS.b,
    opens: FEED_CABLE_OPENS.b,
  },
  { group: 'Ghosting & leakage', keys: LEAK_KEYS, opens: LEAK_OPENS },
  {
    group: 'Chroma key (A through B)',
    keys: CHROMA_KEY_KEYS,
    opens: CHROMA_KEY_OPENS,
  },
  { group: 'Beam', keys: BEAM_KEYS, opens: BEAM_OPENS },
  { group: 'Phosphor', keys: PHOSPHOR_KEYS, opens: PHOSPHOR_OPENS },
] as const satisfies readonly {
  group: string
  keys: readonly ControlKey[]
  opens: Opens
}[]

export type SchematicGroup = (typeof SCHEMATICS)[number]['group']

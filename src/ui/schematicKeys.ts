import {
  CAMERA_LOOP_GROUP,
  MIXER_LOOP_GROUP,
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
  'key amp': ['cgKeyMHz'],
  slicer: ['cgClip'],
  fill: ['cgFill'],
  timing: ['cgKeyDelayNs'],
  edge: ['cgEdgeX', 'cgEdgeY'],
  invert: ['cgInvert'],
  mix: ['cgMix'],
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
] as const satisfies readonly {
  group: string
  keys: readonly ControlKey[]
  opens: Opens
}[]

export type SchematicGroup = (typeof SCHEMATICS)[number]['group']

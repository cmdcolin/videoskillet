import type { ControlKey } from '../core/controls'

// The controls each panel schematic draws a box for. ControlGroup folds these
// behind the drawing, so they live apart from the components that draw them.

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

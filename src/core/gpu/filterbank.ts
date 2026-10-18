// The GPU filter bank as a function of the five controls that shape it. Pure,
// so the headless profiler uploads the same taps the app does.

import { FSC } from '../signal/constants'
import {
  bandpass,
  demodKernel,
  lowpass,
  lowpassPeaked,
  packFilterBank,
  SEC_CHROMA_BP,
  SEC_DEMOD,
  SEC_ENC_CHROMA,
  SEC_LUMA,
  SEC_TAKEOFF,
  SEC_UNDER,
  takeoffBandpass,
  TAPS,
} from '../signal/filters'

import type { Controls } from '../controls'

export type FilterControls = Pick<
  Controls,
  'encChromaMHz' | 'demodMHz' | 'chromaTail' | 'lumaMHz' | 'lumaPeak'
>

export function designFilterBank(c: FilterControls): Float32Array<ArrayBuffer> {
  return packFilterBank(
    new Map([
      [SEC_ENC_CHROMA, lowpass(c.encChromaMHz * 1e6, TAPS.encChroma)],
      [SEC_DEMOD, demodKernel(c.demodMHz * 1e6, c.chromaTail)],
      [
        SEC_LUMA,
        lowpassPeaked(
          c.lumaMHz * 1e6,
          c.lumaPeak,
          c.lumaMHz * 0.75e6,
          TAPS.luma,
        ),
      ],
      [SEC_CHROMA_BP, bandpass(FSC, 0.6e6, TAPS.chromaBp)],
      [SEC_UNDER, lowpass(1.2e6, TAPS.under)],
      [SEC_TAKEOFF, takeoffBandpass()],
    ]),
  )
}

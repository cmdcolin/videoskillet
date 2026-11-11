import { usToSamples } from './constants'

// Oak Sigma (US 4,336,553, US 4,340,906) and VideoCipher II (Communications
// Technology, June 1986) send data where the line sync was. The sources give
// the timing and the gain. The data levels, the porch biases and the axis of
// VideoCipher's inversion are chosen here.
export const HBI_DATA_CELL = usToSamples(0.25)
export const SIGMA_DATA_CELLS = 20
export const SIGMA_CLOCK_CELLS = 8
export const SIGMA_DATA_IRE = 60
export const SIGMA_DATA_SWING_IRE = 30
export const SIGMA_PORCH_BIAS_IRE = 20
export const CIPHER_DATA_IRE = 100
export const CIPHER_PORCH_BIAS_IRE = 50
export const CIPHER_AXIS_IRE = 50
export const CIPHER_GAIN = 1.4

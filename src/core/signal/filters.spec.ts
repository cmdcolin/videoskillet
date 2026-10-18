import { describe, expect, it } from 'vitest'

import { FSC, SAMPLE_RATE } from './constants'
import {
  FILTER_STRIDE,
  TAPS,
  bandpass,
  centred,
  demodKernel,
  demodReach,
  lowpass,
  lowpassCausal,
  lowpassPeaked,
  mixTaps,
  packFilterBank,
} from './filters'

// Evaluate a real FIR's frequency response magnitude at freqHz.
// H(f) = sum_k h[k] e^{-j 2pi f k / fs}; the group delay (linear phase) drops
// out of |H|, so summing against a shifted index is unnecessary for magnitude.
function response(h: Float32Array, freqHz: number): number {
  const w = (2 * Math.PI * freqHz) / SAMPLE_RATE
  let re = 0
  let im = 0
  for (let k = 0; k < h.length; k++) {
    re += h[k]! * Math.cos(w * k)
    im -= h[k]! * Math.sin(w * k)
  }
  return Math.hypot(re, im)
}

function isSymmetric(h: Float32Array): boolean {
  const n = h.length
  for (let k = 0; k < n >> 1; k++) {
    if (Math.abs(h[k]! - h[n - 1 - k]!) > 1e-12) return false
  }
  return true
}

describe('lowpass', () => {
  it('has unity DC gain', () => {
    const h = lowpass(4.2e6, 49)
    let sum = 0
    for (const v of h) sum += v
    expect(sum).toBeCloseTo(1, 6)
  })

  it('passes below and rejects above the cutoff', () => {
    const cutoff = 3e6
    const h = lowpass(cutoff, 65)
    expect(response(h, 0.5e6)).toBeCloseTo(1, 1)
    // A Blackman window gives deep stopband rejection well past the cutoff.
    expect(response(h, 5.5e6)).toBeLessThan(0.02)
  })

  it('is linear-phase (symmetric taps)', () => {
    expect(isSymmetric(lowpass(4.2e6, 49))).toBe(true)
  })
})

describe('bandpass', () => {
  it('has unity gain at the center frequency', () => {
    const center = 3.579545e6
    const h = bandpass(center, 0.6e6, 55)
    expect(response(h, center)).toBeCloseTo(1, 1)
  })

  it('rejects DC and frequencies outside the passband', () => {
    const center = 3.579545e6
    const h = bandpass(center, 0.6e6, 55)
    expect(response(h, 0)).toBeLessThan(0.02)
    expect(response(h, center + 2e6)).toBeLessThan(0.1)
  })

  it('is linear-phase (symmetric taps)', () => {
    expect(isSymmetric(bandpass(3.579545e6, 0.6e6, 55))).toBe(true)
  })
})

describe('lowpassPeaked', () => {
  it('reduces to a plain lowpass when peak is zero', () => {
    const plain = lowpass(4.2e6, 49)
    const peaked = lowpassPeaked(4.2e6, 0, 3.15e6, 49)
    for (let k = 0; k < plain.length; k++)
      expect(peaked[k]).toBeCloseTo(plain[k]!, 12)
  })

  it('boosts high frequencies relative to the plain lowpass', () => {
    const plain = lowpass(4.2e6, 49)
    const peaked = lowpassPeaked(4.2e6, 1, 3.15e6, 49)
    // Peaking lifts the mid/high band where (delta - lp2) has its energy.
    expect(response(peaked, 3e6)).toBeGreaterThan(response(plain, 3e6))
  })

  it('preserves unity DC gain (peaking adds zero-DC content)', () => {
    const h = lowpassPeaked(4.2e6, 0.8, 3.15e6, 49)
    let sum = 0
    for (const v of h) sum += v
    expect(sum).toBeCloseTo(1, 6)
  })
})

// chroma_extract, channel (luma and the color-under up-convert),
// encode_composite, mix_b and under_down all fold mirrored taps onto a single
// coefficient. That halves the coefficient loads, and it is exact only while
// the kernel in that bank slot stays linear-phase.
describe('the bank sections the shader loops fold', () => {
  it('are symmetric, as the folded loops assume', () => {
    expect(isSymmetric(lowpass(1.3e6, TAPS.encChroma))).toBe(true)
    expect(isSymmetric(lowpassPeaked(2.8e6, 0.8, 2.1e6, TAPS.luma))).toBe(true)
    expect(isSymmetric(bandpass(FSC, 0.6e6, TAPS.chromaBp))).toBe(true)
    expect(isSymmetric(lowpass(1.2e6, TAPS.under))).toBe(true)
  })

  it('exclude the demod kernel, whose causal tail is asymmetric', () => {
    expect(isSymmetric(demodKernel(0.6e6, 0.5))).toBe(false)
  })
})

describe('lowpassCausal', () => {
  it('has unity DC gain', () => {
    const h = lowpassCausal(0.6e6, 41)
    let sum = 0
    for (const v of h) sum += v
    expect(sum).toBeCloseTo(1, 6)
  })

  it('is one-sided (no leading taps past the center)', () => {
    const h = lowpassCausal(0.6e6, 41)
    const m = (41 - 1) / 2
    for (let k = m + 1; k < h.length; k++) expect(h[k]).toBe(0)
    // energy sits behind the center: peak tap is the center, tail decays back
    expect(h[m]).toBeGreaterThan(h[m - 1]!)
    expect(h[m - 1]).toBeGreaterThan(h[0]!)
  })

  it('low-passes: rejects above the cutoff', () => {
    expect(response(lowpassCausal(0.6e6, 41), 4e6)).toBeLessThan(0.2)
  })
})

// The demod kernel as decode reads it: tap k against the sample k - m away.
function at(h: Float32Array, hz: number): [number, number] {
  const m = (h.length - 1) / 2
  const w = (2 * Math.PI * hz) / SAMPLE_RATE
  let re = 0
  let im = 0
  for (let k = 0; k < h.length; k++) {
    re += h[k]! * Math.cos(w * (k - m))
    im += h[k]! * Math.sin(w * (k - m))
  }
  return [re, im]
}

// How much of a luma component at lumaHz the synchronous detectors pass into U
// and V: the lowpass heterodyned to the subcarrier from both sides.
function intoChroma(h: Float32Array, lumaHz: number): number {
  const lo = at(h, lumaHz - FSC)
  const hi = at(h, lumaHz + FSC)
  return Math.hypot(lo[0] + hi[0], lo[1] + hi[1])
}

function halfAmplitudeHz(h: Float32Array): number {
  let f = 0
  while (response(h, f) > 0.5) f += 1e3
  return f
}

describe('demodKernel', () => {
  it('is the 41-tap lowpass at the stock setting, so stock decodes as before', () => {
    expect(Array.from(demodKernel(0.6e6, 0))).toEqual(
      Array.from(centred(lowpass(0.6e6, 41), TAPS.demod)),
    )
  })

  it('puts its half-amplitude point within 5% of the cutoff down to 0.4 MHz', () => {
    for (const mhz of [0.4, 0.45, 0.5, 0.6, 0.8, 1, 1.4, 2]) {
      const f = halfAmplitudeHz(demodKernel(mhz * 1e6, 0))
      expect(f / (mhz * 1e6), `${mhz} MHz`).toBeGreaterThan(0.99)
      expect(f / (mhz * 1e6), `${mhz} MHz`).toBeLessThan(1.05)
    }
  })

  it('keeps narrowing below 0.4 MHz until the slot runs out', () => {
    const f = [0.05, 0.3, 0.4].map(mhz =>
      halfAmplitudeHz(demodKernel(mhz * 1e6, 0)),
    )
    expect(f[0]!).toBeLessThan(f[1]!)
    expect(f[1]!).toBeLessThan(f[2]!)
    expect(f[0]!).toBeLessThan(0.275e6)
  })

  it('has unity DC gain at every cutoff and trail', () => {
    for (const mhz of [0.05, 0.4, 0.6, 1.4, 3])
      for (const tail of [0, 0.5, 1]) {
        let sum = 0
        for (const v of demodKernel(mhz * 1e6, tail)) sum += v
        expect(sum).toBeCloseTo(1, 5)
      }
  })

  it('has no tap past the reach decode loops over', () => {
    for (const mhz of [0.05, 0.3, 0.39, 0.45, 0.6, 1.4, 6])
      for (const tail of [0, 0.01, 1]) {
        const h = demodKernel(mhz * 1e6, tail)
        const m = (h.length - 1) / 2
        const r = demodReach(mhz * 1e6, tail)
        h.forEach((v, k) => {
          if (Math.abs(k - m) > r) expect(v, `${mhz} MHz tail ${tail}`).toBe(0)
        })
      }
  })

  // A real set's chroma takeoff bandpass keeps luma out of the detectors
  // whatever the post-detector lowpass does. The bare one-pole blend passed
  // 0.35 of a flat field into U and V at trail 0.5 and 1.4 MHz.
  it('keeps flat luma out of the colour path at any trail', () => {
    for (const mhz of [0.6, 1, 1.4])
      for (const tail of [0.5, 1]) {
        const h = demodKernel(mhz * 1e6, tail)
        expect(intoChroma(h, 0), `${mhz} MHz tail ${tail}`).toBeLessThan(0.002)
        expect(intoChroma(h, 0.5e6)).toBeLessThan(0.01)
        expect(intoChroma(h, 1e6)).toBeLessThan(0.03)
      }
  })

  it("trails by the one-pole's lag", () => {
    const lag = (h: Float32Array) => {
      const m = (h.length - 1) / 2
      return h.reduce((acc, v, k) => acc + v * (k - m), 0)
    }
    for (const mhz of [0.6, 1.4]) {
      const bare = lag(lowpassCausal(mhz * 1e6, TAPS.demod))
      const trail = lag(demodKernel(mhz * 1e6, 1))
      expect(trail / bare).toBeGreaterThan(0.9)
      expect(trail / bare).toBeLessThan(1.05)
    }
  })
})

// Stock is a trap set: the encoder's chroma reaches 1.3 MHz either side of the
// subcarrier and the 0.6 MHz demod takes back only the inner part, so the luma
// the trap leaves still carries the outer sidebands. That residue is the dot
// crawl a notch-filter set shows along colour edges, and stock keeps it.
describe('the stock trap', () => {
  const demod = demodKernel(0.6e6, 0)
  const encoder = lowpass(1.3e6, TAPS.encChroma)
  const leftInLuma = (lumaHz: number) => {
    const sent = Math.abs(
      at(encoder, lumaHz - FSC)[0] + at(encoder, lumaHz + FSC)[0],
    )
    const lo = at(demod, lumaHz - FSC)
    const hi = at(demod, lumaHz + FSC)
    return sent * Math.hypot(1 - lo[0] - hi[0], lo[1] + hi[1])
  }

  it('removes flat colour from luma', () => {
    expect(leftInLuma(FSC)).toBeLessThan(0.01)
  })

  it('leaves the outer chroma sidebands in luma as dot crawl', () => {
    expect(leftInLuma(FSC - 1e6)).toBeGreaterThan(0.6)
    expect(leftInLuma(FSC + 1e6)).toBeGreaterThan(0.6)
  })
})

describe('mixTaps', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    const a = lowpass(0.6e6, 41)
    const b = lowpassCausal(0.6e6, 41)
    const at0 = mixTaps(a, b, 0)
    const at1 = mixTaps(a, b, 1)
    for (let k = 0; k < a.length; k++) {
      expect(at0[k]).toBeCloseTo(a[k]!, 12)
      expect(at1[k]).toBeCloseTo(b[k]!, 12)
    }
  })

  it('preserves unity DC gain for a blend of unity-DC kernels', () => {
    const h = mixTaps(lowpass(0.6e6, 41), lowpassCausal(0.6e6, 41), 0.4)
    let sum = 0
    for (const v of h) sum += v
    expect(sum).toBeCloseTo(1, 6)
  })
})

describe('filter bank packing', () => {
  it('every kernel fits within its stride slot', () => {
    for (const [name, taps] of Object.entries(TAPS)) {
      expect(taps, `TAPS.${name} exceeds FILTER_STRIDE`).toBeLessThanOrEqual(
        FILTER_STRIDE,
      )
    }
  })

  it('places each section at its stride offset without bleeding into the next', () => {
    const a = lowpass(4.2e6, TAPS.luma)
    const b = bandpass(3.579545e6, 0.6e6, TAPS.chromaBp)
    const bank = packFilterBank(
      new Map([
        [0, a],
        [1, b],
      ]),
    )
    expect(Array.from(bank.subarray(0, a.length))).toEqual(Array.from(a))
    expect(
      Array.from(bank.subarray(FILTER_STRIDE, FILTER_STRIDE + b.length)),
    ).toEqual(Array.from(b))
    // Tail of slot 0 past the kernel must stay zero (no overrun from slot 1).
    for (let k = a.length; k < FILTER_STRIDE; k++) expect(bank[k]).toBe(0)
  })
})

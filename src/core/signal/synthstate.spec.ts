import { describe, expect, it } from 'vitest'

import { F_H, LINES, SAMPLE_RATE, SAMPLES_PER_LINE } from './constants'
import { SynthState } from './synthstate'

import type { SynthControls } from './synthstate'

const STILL: SynthControls = {
  synthAHz: 0,
  synthBHz: 0,
  synthDriftPct: 0,
  synthJitterUs: 0,
}

const step = (s: SynthState, c: Partial<SynthControls>, n: number) => {
  let out = s.update({ ...STILL, ...c })
  for (let i = 1; i < n; i++) out = s.update({ ...STILL, ...c })
  return out
}

// What the shader computes: phase in cycles at (row, sample).
const phaseAt = (u: ReturnType<SynthState['update']>, row: number, s: number) =>
  u.synthPhaseA + u.synthPerLineA * row + u.synthPerSampleA * s

describe('SynthState', () => {
  it('holds an unpatched oscillator at zero', () => {
    const out = step(new SynthState(), {}, 30)
    expect(out.synthPhaseA).toBe(0)
    expect(out.synthPerLineA).toBe(0)
    expect(out.synthPerSampleA).toBe(0)
  })

  // The mechanism the whole instrument rests on: an oscillator on an exact
  // multiple of line rate walks zero phase per line, so every line starts the
  // wave in the same place and the bars stand up straight. This is what makes
  // the leaning ones lean.
  it('walks no phase per line at an exact multiple of line rate', () => {
    const out = step(new SynthState(), { synthAHz: F_H * 8 }, 1)
    expect(out.synthPerLineA).toBeCloseTo(0, 9)
    // and eight whole cycles across a line
    expect(out.synthPerSampleA * SAMPLES_PER_LINE).toBeCloseTo(8, 9)
  })

  // Detuned off line rate, the per-line walk is the lean, and it is exactly the
  // fraction of a cycle the extra hertz buy in one line's worth of time.
  it('leans by the frequency error against line rate', () => {
    const out = step(new SynthState(), { synthAHz: F_H + 100 }, 1)
    expect(out.synthPerLineA).toBeCloseTo(100 / F_H, 9)
  })

  it('accumulates phase across frames so the pattern creeps', () => {
    const s = new SynthState()
    const one = step(s, { synthAHz: F_H + 100 }, 1).synthPhaseA
    const two = step(s, { synthAHz: F_H + 100 }, 1).synthPhaseA
    expect(one).not.toBe(two)
    // one frame of a 100 Hz error against line rate, wrapped
    const perFrame = (100 * SAMPLES_PER_LINE * LINES) / SAMPLE_RATE
    expect(two - one - (perFrame % 1)).toBeCloseTo(0, 6)
  })

  it('keeps phase in cycles, wrapped', () => {
    const out = step(new SynthState(), { synthAHz: 1e6 }, 40)
    expect(out.synthPhaseA).toBeGreaterThanOrEqual(0)
    expect(out.synthPhaseA).toBeLessThan(1)
  })

  // Splitting the walk has to reconstruct the same phase the unsplit product
  // would, modulo a whole cycle — otherwise the pattern is simply in the wrong
  // place and nothing else here would notice.
  it('reconstructs the true phase at the far corner of the frame', () => {
    const hz = 3579545
    const out = step(new SynthState(), { synthAHz: hz }, 1)
    const row = LINES - 1
    const s = SAMPLES_PER_LINE - 1
    const truth =
      out.synthPhaseA + (hz * (row * SAMPLES_PER_LINE + s)) / SAMPLE_RATE
    const got = phaseAt(out, row, s)
    expect((got - truth) % 1).toBeCloseTo(0, 6)
  })

  it('holds the frequency exact with no drift', () => {
    const s = new SynthState()
    const first = step(s, { synthAHz: F_H + 100 }, 1).synthPerSampleA
    const later = step(s, { synthAHz: F_H + 100 }, 300).synthPerSampleA
    expect(later).toBe(first)
  })

  it('wanders the frequency within its share of the setting', () => {
    const s = new SynthState()
    const hz = 1e6
    const walks = Array.from(
      { length: 600 },
      () => step(s, { synthAHz: hz, synthDriftPct: 1 }, 1).synthPerSampleA,
    ).map(w => (w * SAMPLE_RATE) / hz - 1)
    expect(Math.max(...walks.map(Math.abs))).toBeLessThanOrEqual(0.01)
    expect(Math.max(...walks) - Math.min(...walks)).toBeGreaterThan(0.002)
  })

  it('states jitter as a time error, so it scales with frequency', () => {
    const slow = step(new SynthState(), { synthAHz: 60, synthJitterUs: 1 }, 1)
    const fast = step(new SynthState(), { synthAHz: 6e6, synthJitterUs: 1 }, 1)
    expect(slow.synthJitA).toBeCloseTo(6e-5, 12)
    expect(fast.synthJitA).toBeCloseTo(6, 9)
  })

  it('integrates the audio input down the field', () => {
    const s = new SynthState()
    const lines = s.audioLines(new Float32Array(LINES).fill(0.5), 1000)
    const perLine = (500 * SAMPLES_PER_LINE) / SAMPLE_RATE
    expect(lines[0]).toBe(0)
    expect(lines[2 * 10]).toBeCloseTo((10 * perLine) % 1, 5)
    expect(lines[2 * 10 + 1]).toBeCloseTo(500 / SAMPLE_RATE, 9)
  })

  it('carries the frame of audio into the next starting phase', () => {
    const quiet = new SynthState()
    const loud = new SynthState()
    loud.audioLines(new Float32Array(LINES).fill(0.25), 1000)
    const gained = (250 * SAMPLES_PER_LINE * LINES) / SAMPLE_RATE
    const a = step(quiet, { synthAHz: F_H }, 1).synthPhaseA
    const b = step(loud, { synthAHz: F_H }, 1).synthPhaseA
    expect((b - a - (gained % 1) + 2) % 1).toBeCloseTo(0, 5)
  })

  it('runs the two oscillators independently', () => {
    const out = step(new SynthState(), { synthAHz: F_H, synthBHz: 60 }, 5)
    expect(out.synthPerSampleA).not.toBe(out.synthPerSampleB)
    expect(out.synthPhaseA).not.toBe(out.synthPhaseB)
  })
})

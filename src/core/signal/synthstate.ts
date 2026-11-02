// The video synth's two oscillators, as free-running phase. They are the only
// generators in the app that keep a phase across frames rather than being a
// function of the sample index, and that is the entire point of them: an
// oscillator that restarted every frame would draw a pattern nailed to the
// raster, which is a texture, not an instrument. Running free, where it sits
// relative to line and field rate is what the picture is.
//
// Phase is counted in cycles (0..1), never radians, so wrapping is fract() and
// the shader's waveform selector can slice a shape straight off it.
//
// The uniforms are the walk per line and per sample rather than the frequency
// they came from, for two reasons. Precision: a frame is 477750 samples, and an
// f32 phase accumulated to the far corner of one at subcarrier rate has lost
// several bits by the time it gets there — splitting the walk keeps both terms
// small. And legibility: the per-line walk IS the lean of the pattern, so the
// number the shader multiplies by the row is the number a reader can point at.

import { LINES, SAMPLE_RATE, SAMPLES_PER_LINE } from './constants'
import { valueNoise } from './noise'

const FRAME_SAMPLES = SAMPLES_PER_LINE * LINES

const fract = (x: number) => x - Math.floor(x)

export interface SynthControls {
  synthAHz: number // oscillator A frequency
  synthBHz: number // oscillator B frequency
  synthDriftPct: number
  synthJitterUs: number
}

interface SynthUniforms {
  synthPhaseA: number
  synthPerLineA: number
  synthPerSampleA: number
  synthPhaseB: number
  synthPerLineB: number
  synthPerSampleB: number
  synthJitA: number
  synthJitB: number
}

// One oscillator's three uniforms from its frequency and its running phase.
const walk = (hz: number, phase: number) => ({
  phase: fract(phase),
  perLine: fract((hz * SAMPLES_PER_LINE) / SAMPLE_RATE),
  perSample: hz / SAMPLE_RATE,
})

// A free-running VCO's tempco: its frequency wanders with temperature as a
// fraction of where it is set, so a fast oscillator moves by more hertz than a
// slow one. Two rates of wander, so the creep stalls and lurches.
const wander = (t: number, seed: number) =>
  0.7 * valueNoise(t * 0.13, seed) + 0.3 * valueNoise(t * 0.8, seed + 1)

export class SynthState {
  private phaseA = 0
  private phaseB = 0
  private frames = 0
  private readonly lines = new Float32Array(LINES * 2)

  update(c: SynthControls): SynthUniforms {
    const t = this.frames / 60
    this.frames++
    const drift = c.synthDriftPct / 100
    const hzA = c.synthAHz * (1 + drift * wander(t, 41))
    const hzB = c.synthBHz * (1 + drift * wander(t, 43))
    // Advance by a whole frame of samples, in f64 where the product is exact,
    // and hand the shader only the wrapped remainder.
    this.phaseA = fract(this.phaseA + (hzA * FRAME_SAMPLES) / SAMPLE_RATE)
    this.phaseB = fract(this.phaseB + (hzB * FRAME_SAMPLES) / SAMPLE_RATE)
    const a = walk(hzA, this.phaseA)
    const b = walk(hzB, this.phaseB)
    const jitterS = c.synthJitterUs * 1e-6
    return {
      synthPhaseA: a.phase,
      synthPerLineA: a.perLine,
      synthPerSampleA: a.perSample,
      synthPhaseB: b.phase,
      synthPerLineB: b.perLine,
      synthPerSampleB: b.perSample,
      synthJitA: hzA * jitterS,
      synthJitB: hzB * jitterS,
    }
  }

  // The audio patched into osc A's frequency input, integrated the way a VCO
  // integrates its control voltage: each line's offset in hertz adds to the
  // phase every line after it. Per line, the phase gained before the line
  // starts and the extra walk per sample within it. The frame's total carries
  // into the next frame's starting phase.
  audioLines(audio: Float32Array, hzPerUnit: number) {
    let gained = 0
    for (const [row, level] of audio.entries()) {
      const hz = hzPerUnit * level
      this.lines[2 * row] = fract(gained)
      this.lines[2 * row + 1] = hz / SAMPLE_RATE
      gained += (hz * SAMPLES_PER_LINE) / SAMPLE_RATE
    }
    this.phaseA = fract(this.phaseA + gained)
    return this.lines
  }
}

// Run a patch headless and hand back frames. The shared engine under
// `survey.ts` (does this knob do anything?) and `sheet.ts` (what does this
// patch look like?), both of which want the same thing: a device, a graph per
// arm, and pixels out without a browser in the room.

import { ACTIVE_HEIGHT, ACTIVE_WIDTH } from '../../src/core/signal/constants'
import { Graph } from './graph'
import { barsA, detailA, gradientB } from './sources'

import type { Controls } from '../../src/core/controls'

export interface Capture {
  // Which frames to keep, counted from the end: 0 is the last frame. A survey
  // wants [0, 1] (departure and motion); a contact sheet wants a spread, so the
  // tile can be played as a loop.
  tail: number[]
  // Cell size of the returned frames. The full 754x480 is only worth reading
  // back when the frame is going to a file.
  w: number
  h: number
}

export interface Frames {
  // One entry per `tail` index, in the order asked for, each `w*h*3` floats.
  shots: Float32Array[]
}

export class Runner {
  private constructor(
    readonly device: GPUDevice,
    private readonly srcA: Uint8Array<ArrayBuffer>,
    private readonly srcB: Uint8Array<ArrayBuffer>,
    private readonly read: GPUBuffer,
    private readonly bytesPerRow: number,
  ) {}

  // `bars` is flat colour and hard edges; `detail` is fine structure and
  // modelling. Which one is loaded decides half of what a survey concludes —
  // run both before calling anything invisible.
  static async create(source: 'bars' | 'detail' = 'bars'): Promise<Runner> {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    })
    if (adapter === null) throw new Error('no adapter')
    const device = await adapter.requestDevice()
    device.addEventListener('uncapturederror', e => {
      console.error('GPU error:', (e as GPUUncapturedErrorEvent).error.message)
    })
    const bytesPerRow = Math.ceil((ACTIVE_WIDTH * 4) / 256) * 256
    const read = device.createBuffer({
      size: bytesPerRow * ACTIVE_HEIGHT,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    })
    return new Runner(
      device,
      source === 'detail' ? detailA() : barsA(),
      gradientB(),
      read,
      bytesPerRow,
    )
  }

  // The tube's face, not the decoder's output: mask, bloom and glass are what
  // anyone actually looks at, and half the presets here live in that pass.
  private async grab(g: Graph, w: number, h: number): Promise<Float32Array> {
    const enc = this.device.createCommandEncoder()
    enc.copyTextureToBuffer(
      { texture: g.faceTex },
      { buffer: this.read, bytesPerRow: this.bytesPerRow },
      [ACTIVE_WIDTH, ACTIVE_HEIGHT],
    )
    this.device.queue.submit([enc.finish()])
    await this.read.mapAsync(GPUMapMode.READ)
    const rows = new Uint8Array(this.read.getMappedRange())
    // Box-average each destination cell rather than point-sampling: a
    // one-pixel scanline structure aliases to nothing at 64x48, and half the
    // looks here are made of scanlines.
    const out = new Float32Array(w * h * 3)
    const cw = ACTIVE_WIDTH / w
    const ch = ACTIVE_HEIGHT / h
    for (let y = 0; y < h; y++) {
      const y0 = Math.floor(y * ch)
      const y1 = Math.max(y0 + 1, Math.floor((y + 1) * ch))
      for (let x = 0; x < w; x++) {
        const x0 = Math.floor(x * cw)
        const x1 = Math.max(x0 + 1, Math.floor((x + 1) * cw))
        let r = 0
        let gg = 0
        let b = 0
        for (let sy = y0; sy < y1; sy++) {
          const row = sy * this.bytesPerRow
          for (let sx = x0; sx < x1; sx++) {
            const i = row + sx * 4
            r += rows[i]
            gg += rows[i + 1]
            b += rows[i + 2]
          }
        }
        const n = (y1 - y0) * (x1 - x0)
        const o = (y * w + x) * 3
        out[o] = r / n
        out[o + 1] = gg / n
        out[o + 2] = b / n
      }
    }
    this.read.unmap()
    return out
  }

  async run(controls: Controls, frames: number, cap: Capture): Promise<Frames> {
    const g = await Graph.create(this.device, {
      controls,
      bEnabled: true,
      sourceA: this.srcA,
      sourceB: this.srcB,
    })
    const wanted = new Map(cap.tail.map((t, i) => [frames - 1 - t, i]))
    const shots: Float32Array[] = cap.tail.map(
      () => new Float32Array(cap.w * cap.h * 3),
    )
    for (let f = 0; f < frames; f++) {
      const enc = this.device.createCommandEncoder()
      g.encode(enc, (_p, run) => {
        run()
      })
      this.device.queue.submit([enc.finish()])
      const slot = wanted.get(f)
      if (slot !== undefined) shots[slot] = await this.grab(g, cap.w, cap.h)
    }
    return { shots }
  }
}

export const meanAbs = (a: Float32Array, b: Float32Array): number => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

// The departure of the worst 1% of the frame. The column that tells a knob
// which is faint everywhere from one which is savage somewhere: an edge fault
// lives on a few hundred pixels, and a mean over the whole picture reports it
// as nothing. Read them as a pair — high mean is a look, high p99 alone is a
// detail, and neither is quality.
export const p99Abs = (a: Float32Array, b: Float32Array): number => {
  const d = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) d[i] = Math.abs(a[i] - b[i])
  d.sort()
  return d[Math.floor(d.length * 0.99)]
}

// Luma spread over the frame. A patch that has walled out to white or
// collapsed to black departs hugely from the reference and is still nothing to
// look at, so departure alone cannot rank a candidate — this is the column
// that catches it.
export function spread(s: Float32Array): { mean: number; sd: number } {
  const luma = (i: number): number =>
    0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2]
  let m = 0
  for (let i = 0; i < s.length; i += 3) m += luma(i)
  const n = s.length / 3
  m /= n
  let v = 0
  for (let i = 0; i < s.length; i += 3) v += (luma(i) - m) * (luma(i) - m)
  return { mean: m, sd: Math.sqrt(v / n) }
}

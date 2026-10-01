// The presented picture off the GPU for a recorder, without waiting for it.
//
// `new VideoFrame(canvas)` reads a WebGPU canvas synchronously, and Firefox
// Nightly spends 16-22 ms of main thread on it at a full-window canvas
// (1494x933), which is a whole frame at 48 Hz. Copying the swapchain texture
// into a mappable buffer inside the frame's own submit costs nothing to
// encode. The map lands 10-25 ms later, when building the VideoFrame is one
// memcpy, about 3 ms at that size (agent-docs/handoffs/record-clip-audio.md).
//
// The pool is the buzz readback's (buzzread.ts): a frame that finds every
// buffer still in flight is skipped, and the recorder keeps the frame before it
// up across the gap.

import rescaleSrc from './shaders/rescale.wgsl?raw'

const POOL = 3

export interface FrameSink {
  // Each frame that made it off the GPU, and when it was rendered
  // (performance.now()). The sink owns the frame and closes it.
  frame: (frame: VideoFrame, renderedAt: number) => void
}

export class FrameRead {
  private readonly staging: GPUBuffer[]
  private free: GPUBuffer[]
  private readonly stride: number
  private closed = false
  // A texture at the take's size and the pass that scales into it, built the
  // first time the canvas and the take disagree.
  private target: GPUTexture | null = null
  private rescale: GPURenderPipeline | null = null
  private sampler: GPUSampler | null = null

  constructor(
    private readonly device: GPUDevice,
    readonly width: number,
    readonly height: number,
    private readonly format: GPUTextureFormat,
    private readonly sink: FrameSink,
  ) {
    this.stride = Math.ceil((width * 4) / 256) * 256
    this.staging = Array.from({ length: POOL }, () =>
      device.createBuffer({
        size: this.stride * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      }),
    )
    this.free = [...this.staging]
  }

  // Encode this frame's copy if a buffer is spare. The buffer goes to `flush`
  // after the submit; null is a skipped frame.
  copy(enc: GPUCommandEncoder, presented: GPUTexture): GPUBuffer | null {
    const buf = this.free.pop()
    if (buf === undefined) return null
    const fits =
      presented.width === this.width && presented.height === this.height
    enc.copyTextureToBuffer(
      { texture: fits ? presented : this.scaled(enc, presented) },
      { buffer: buf, bytesPerRow: this.stride, rowsPerImage: this.height },
      [this.width, this.height],
    )
    return buf
  }

  flush(buf: GPUBuffer, renderedAt: number): void {
    void buf.mapAsync(GPUMapMode.READ).then(
      () => {
        if (this.closed) return
        const frame = new VideoFrame(new Uint8Array(buf.getMappedRange()), {
          format: this.format === 'bgra8unorm' ? 'BGRX' : 'RGBX',
          codedWidth: this.width,
          codedHeight: this.height,
          timestamp: 0,
          layout: [{ offset: 0, stride: this.stride }],
        })
        buf.unmap()
        this.free.push(buf)
        this.sink.frame(frame, renderedAt)
      },
      // A destroyed buffer or a lost device rejects the map, and both mean the
      // recording is going away.
      () => {},
    )
  }

  private scaled(enc: GPUCommandEncoder, presented: GPUTexture): GPUTexture {
    const d = this.device
    this.target ??= d.createTexture({
      size: [this.width, this.height],
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    })
    if (this.rescale === null) {
      const module = d.createShaderModule({ code: rescaleSrc })
      this.rescale = d.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'rescaleVs' },
        fragment: {
          module,
          entryPoint: 'rescaleFs',
          targets: [{ format: this.format }],
        },
      })
      this.sampler = d.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      })
    }
    const rp = enc.beginRenderPass({
      colorAttachments: [
        {
          view: this.target.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    })
    rp.setPipeline(this.rescale)
    rp.setBindGroup(
      0,
      d.createBindGroup({
        layout: this.rescale.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: presented.createView() },
          { binding: 1, resource: this.sampler ?? d.createSampler() },
        ],
      }),
    )
    rp.draw(3)
    rp.end()
    return this.target
  }

  destroy(): void {
    this.closed = true
    for (const b of this.staging) b.destroy()
    this.target?.destroy()
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FrameRead } from './frameread'

// A staging buffer that maps the way WebGPU does: a buffer still mapped
// refuses a second map.
function stagingBuffer(size: number) {
  let mapState: GPUBufferMapState = 'unmapped'
  const buffer: GPUBuffer = {
    __brand: 'GPUBuffer',
    label: '',
    size,
    usage: 0,
    get mapState() {
      return mapState
    },
    mapAsync: async () => {
      if (mapState !== 'unmapped') throw new Error('buffer is already mapped')
      mapState = 'mapped'
      return undefined
    },
    getMappedRange: () => new ArrayBuffer(size),
    unmap: () => {
      mapState = 'unmapped'
      return undefined
    },
    destroy: () => undefined,
  }
  return buffer
}

const unused = () => {
  throw new Error('only a take at a different size reaches this')
}

// 64 pixels wide is a 256-byte row, so the copy needs neither packing nor the
// rescale pass.
const WIDTH = 64
const HEIGHT = 2

const presented: GPUTexture = {
  __brand: 'GPUTexture',
  label: '',
  width: WIDTH,
  height: HEIGHT,
  depthOrArrayLayers: 1,
  mipLevelCount: 1,
  sampleCount: 1,
  dimension: '2d',
  format: 'bgra8unorm',
  usage: 0,
  createView: unused,
  destroy: () => undefined,
}

describe('FrameRead', () => {
  let failFrames = 0
  beforeEach(() => {
    failFrames = 0
    vi.stubGlobal('GPUBufferUsage', { COPY_DST: 8, MAP_READ: 1 })
    vi.stubGlobal('GPUMapMode', { READ: 1 })
    vi.stubGlobal(
      'VideoFrame',
      class {
        closed = false
        constructor() {
          if (failFrames > 0) {
            failFrames -= 1
            throw new Error('VideoFrame refused the buffer')
          }
        }
        close() {
          this.closed = true
        }
      },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns a buffer to the pool when a frame cannot be built', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    let received = 0
    const read = new FrameRead(
      {
        createBuffer: ({ size }) => stagingBuffer(size),
        createTexture: unused,
        createShaderModule: unused,
        createRenderPipeline: unused,
        createSampler: unused,
        createBindGroup: unused,
      },
      WIDTH,
      HEIGHT,
      'bgra8unorm',
      {
        frame: () => {
          received += 1
        },
      },
    )
    const enc = {
      copyTextureToBuffer: () => undefined,
      beginRenderPass: unused,
    }
    failFrames = 3
    for (let frame = 0; frame < 6; frame++) {
      const buf = read.copy(enc, presented)
      expect(buf, `frame ${frame} found no free buffer`).not.toBeNull()
      if (buf !== null) read.flush(buf, frame)
      await vi.waitFor(() =>
        expect(logged.mock.calls.length + received).toBe(frame + 1),
      )
    }
    expect(received).toBe(3)
    expect(logged).toHaveBeenCalledTimes(3)
  })
})

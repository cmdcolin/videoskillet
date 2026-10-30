import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BuzzRead } from './buzzread'

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

describe('BuzzRead', () => {
  beforeEach(() => {
    vi.stubGlobal('GPUBufferUsage', { COPY_DST: 8, MAP_READ: 1 })
    vi.stubGlobal('GPUMapMode', { READ: 1 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns a buffer to the pool when the sink throws', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const read = new BuzzRead({ createBuffer: () => stagingBuffer(16) }, 16)
    let copies = 0
    const enc = {
      copyBufferToBuffer: () => void (copies += 1),
    }
    const src = stagingBuffer(16)
    let delivered = 0
    for (let frame = 0; frame < 6; frame++) {
      read.copy(enc, src)
      read.flush(() => {
        delivered += 1
        if (frame < 3) throw new Error('sink failed')
      })
      await vi.waitFor(() => expect(delivered).toBe(frame + 1))
    }
    expect(copies).toBe(6)
    expect(logged).toHaveBeenCalledTimes(3)
  })
})

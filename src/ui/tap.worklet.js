// Audio-thread half of a take's sound (see recordAudio.ts). Plain JS with no
// imports, because the audio thread fetches and evaluates an AudioWorklet
// module itself.
//
// It hands the main thread planar blocks, each stamped with the context frame
// its first sample was processed at, and the main thread trims them to where
// the picture starts. A quantum with no input connected counts as silence, so
// the sound keeps the picture's length if the source goes away mid-take.

const BLOCK = 2048

class TapProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.channels = options?.processorOptions?.channels ?? 1
    this.done = false
    this.fresh()
    this.port.addEventListener('message', e => {
      if (e.data === 'stop') {
        this.post(true)
        this.done = true
      }
    })
    this.port.start()
  }

  fresh() {
    this.block = new Float32Array(BLOCK * this.channels)
    this.fill = 0
    this.at = -1
  }

  post(last) {
    const n = this.fill
    const pcm = n === BLOCK ? this.block : new Float32Array(n * this.channels)
    if (n !== BLOCK)
      for (let c = 0; c < this.channels; c++)
        pcm.set(this.block.subarray(c * BLOCK, c * BLOCK + n), c * n)
    this.port.postMessage({ pcm, frames: n, at: this.at, last }, [pcm.buffer])
    this.fresh()
  }

  process(inputs) {
    if (this.done) return false
    const input = inputs[0]
    const n = input.length > 0 ? input[0].length : 128
    let i = 0
    while (i < n) {
      if (this.at < 0) this.at = currentFrame + i
      const run = Math.min(n - i, BLOCK - this.fill)
      for (let c = 0; c < this.channels; c++) {
        const at = c * BLOCK + this.fill
        if (input.length === 0) this.block.fill(0, at, at + run)
        else
          this.block.set(
            input[Math.min(c, input.length - 1)].subarray(i, i + run),
            at,
          )
      }
      this.fill += run
      i += run
      if (this.fill === BLOCK) this.post(false)
    }
    return true
  }
}

registerProcessor('take-tap', TapProcessor)

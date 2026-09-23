// Audio-thread half of a take's sound (see recordAudio.ts). Plain JS with no
// imports, because the audio thread fetches and evaluates an AudioWorklet
// module itself.
//
// It holds everything until the first frame of picture is taken, so the sound
// starts where the picture does, then hands the main thread mono blocks. A
// quantum with no input connected counts as silence rather than as nothing, so
// the sound keeps the picture's length if the mic goes away mid-take.

const BLOCK = 2048

class TapProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.rolling = false
    this.done = false
    this.block = new Float32Array(BLOCK)
    this.fill = 0
    this.port.addEventListener('message', e => {
      if (e.data === 'go') this.rolling = true
      if (e.data === 'stop') {
        const pcm = this.block.slice(0, this.fill)
        this.port.postMessage({ pcm, last: true }, [pcm.buffer])
        this.done = true
      }
    })
    this.port.start()
  }

  process(inputs) {
    if (this.done) return false
    if (!this.rolling) return true
    const input = inputs[0]
    const channel = input.length > 0 ? input[0] : null
    const n = channel === null ? 128 : channel.length
    for (let i = 0; i < n; i++) {
      this.block[this.fill++] = channel === null ? 0 : channel[i]
      if (this.fill === BLOCK) {
        this.port.postMessage({ pcm: this.block, last: false }, [
          this.block.buffer,
        ])
        this.block = new Float32Array(BLOCK)
        this.fill = 0
      }
    }
    return true
  }
}

registerProcessor('take-tap', TapProcessor)

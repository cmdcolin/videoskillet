import { SAMPLE_RATE } from '../core/signal/constants'

export type Complex = [number, number]

// A kernel's response to e^{jωn} when the shader reads tap k at offset k − m,
// as every bank section in decode and channel does.
export function response(h: Float32Array, hz: number): Complex {
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

export const magnitude = ([re, im]: Complex) => Math.hypot(re, im)

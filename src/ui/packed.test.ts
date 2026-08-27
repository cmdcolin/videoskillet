import { describe, expect, it } from 'vitest'

import { CONTROL_KEYS, DEFAULT_CONTROLS } from '../core/controls'
import { SLIDER_BY_KEY } from './controls'
import { URL_KEY_ORDER, packControls, unpackControls } from './packed'
import {
  PRESETS,
  blendPresets,
  presetControls,
  randomPresetMix,
} from './presets'
import { atCents } from './vernier'

import type { ControlKey, Controls } from '../core/controls'

const round = (c: Controls): Controls => ({
  ...DEFAULT_CONTROLS,
  ...unpackControls(packControls(c)),
})

const rolls = (n: number, seed = 12345): Controls[] => {
  let s = seed
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32
  return Array.from({ length: n }, () =>
    blendPresets(DEFAULT_CONTROLS, randomPresetMix(true, rand)),
  )
}

// The alphabet the codec writes, so a test can forge a link byte by byte.
const bytesToText = (bytes: number[]): string => {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const varint: number[] = []
  for (let n of bytes) {
    while (n > 0x7f) {
      varint.push((n & 0x7f) | 0x80)
      n >>>= 7
    }
    varint.push(n)
  }
  let out = ''
  for (let i = 0; i < varint.length; i += 3) {
    const n =
      ((varint[i] ?? 0) << 16) |
      ((varint[i + 1] ?? 0) << 8) |
      (varint[i + 2] ?? 0)
    const left = varint.length - i
    out += (B64[(n >> 18) & 63] ?? '') + (B64[(n >> 12) & 63] ?? '')
    if (left > 1) out += B64[(n >> 6) & 63] ?? ''
    if (left > 2) out += B64[n & 63] ?? ''
  }
  return out
}

describe('the wire order', () => {
  it('names every control and no other', () => {
    // Append here when a control is added — never insert and never reorder, or
    // every link ever made decodes to a different look. This is the check that
    // makes the rule the build's rather than someone's memory.
    expect([...URL_KEY_ORDER].toSorted()).toEqual([...CONTROL_KEYS].toSorted())
    expect(new Set(URL_KEY_ORDER).size).toBe(URL_KEY_ORDER.length)
  })

  it('has a slider behind every name, which is what carries the value', () => {
    expect(URL_KEY_ORDER.filter(k => !SLIDER_BY_KEY.has(k))).toEqual([])
  })
})

describe('a look as bytes', () => {
  it('survives the round trip', () => {
    const look: Controls = {
      ...DEFAULT_CONTROLS,
      noiseIre: 7.5,
      hHold: 0.2,
      bendShape: 3,
      scDetuneKHz: 3.879,
      chromaGain: 1.79,
      invert: 1,
    }
    expect(round(look)).toEqual(look)
  })

  it('carries every preset exactly', () => {
    for (const preset of PRESETS) {
      const look = presetControls(preset.patch)
      expect({ preset: preset.name, look: round(look) }).toEqual({
        preset: preset.name,
        look,
      })
    }
  })

  it('carries a rolled look exactly', () => {
    for (const [i, look] of rolls(20).entries()) {
      expect({ roll: i, look: round(look) }).toEqual({ roll: i, look })
    }
  })

  it('carries a trim the vernier card left between two notches', () => {
    // The card moves a control in hundredths of its step (vernier.ts), which is
    // finer than the notch grid the wire counts in — so the value comes back
    // through the odd branch of the encoding rather than rounded onto a notch.
    const span = SLIDER_BY_KEY.get('fbZoom')!
    const trimmed = atCents(span, 1.064, -37)
    expect(trimmed).not.toBe(1.064)
    expect(round({ ...DEFAULT_CONTROLS, fbZoom: trimmed }).fbZoom).toBe(trimmed)
  })

  it('only carries what is off default', () => {
    expect(packControls(DEFAULT_CONTROLS)).toBe('')
    expect(unpackControls('')).toEqual({})
  })

  it('is several times shorter than the same look by name', () => {
    // Against the bare names, before a query string has spent three characters
    // on each separator. Measured over these rolls the margin runs 3.2 to 4.9,
    // mean 3.8; the assertion sits under the worst of them rather than at a
    // round number it would pass by luck.
    for (const look of rolls(20, 4242)) {
      const named = CONTROL_KEYS.filter(k => look[k] !== DEFAULT_CONTROLS[k])
        .map(k => `${k}:${look[k]}`)
        .join(',')
      expect(packControls(look).length * 2.8).toBeLessThan(named.length)
    }
  })

  it('spends only characters a query string carries as themselves', () => {
    for (const look of rolls(20, 999)) {
      const packed = packControls(look)
      expect(packed).toMatch(/^[A-Za-z0-9\-_]*$/)
      expect(new URLSearchParams({ p: packed }).toString()).toBe(`p=${packed}`)
    }
  })
})

describe('a link that is not what this build would have written', () => {
  it('reads past a control this build has never heard of', () => {
    // What a link from a newer app looks like here. The order only ever grows
    // at the end, so an unknown control is the last one on the wire — and
    // because every field is a varint the reader steps over it and keeps the
    // rest, rather than the link opening as the default look.
    const look: Controls = { ...DEFAULT_CONTROLS, hHold: 0.2, noiseIre: 7.5 }
    const at = (key: ControlKey) => URL_KEY_ORDER.indexOf(key)
    const bytes: number[] = []
    let prev = -1
    for (const key of (['hHold', 'noiseIre'] as ControlKey[]).toSorted(
      (a, b) => at(a) - at(b),
    )) {
      const def = SLIDER_BY_KEY.get(key)!
      const notch = Math.round(look[key] / def.step)
      bytes.push(
        at(key) - prev - 1,
        (notch < 0 ? -2 * notch - 1 : 2 * notch) * 2,
      )
      prev = at(key)
    }
    // the forged wire is the encoder's, or the rest of this proves nothing
    expect(bytesToText(bytes)).toBe(packControls(look))
    bytes.push(URL_KEY_ORDER.length - prev + 3, 9)
    expect(unpackControls(bytesToText(bytes))).toEqual({
      hHold: 0.2,
      noiseIre: 7.5,
    })
  })

  it('decodes junk to nothing rather than to a look', () => {
    expect(unpackControls('!!!!')).toEqual({})
    expect(unpackControls('....')).toEqual({})
    // a varint whose last byte never arrives stops the read where it is
    expect(unpackControls('gA')).toEqual({})
  })

  it('keeps most of a look out of a link that lost its tail', () => {
    const look: Controls = {
      ...DEFAULT_CONTROLS,
      hHold: 0.2,
      noiseIre: 7.5,
      chromaGain: 1.79,
      crtBloom: 0.68,
    }
    const cut = unpackControls(packControls(look).slice(0, 4))
    expect(Object.keys(cut).length).toBeGreaterThan(0)
    for (const [key, v] of Object.entries(cut)) {
      expect(v).toBe(look[key as ControlKey])
    }
  })

  it('reads a link padded the way another encoder would pad it', () => {
    const look: Controls = { ...DEFAULT_CONTROLS, hHold: 0.2, noiseIre: 7.5 }
    const packed = packControls(look)
    expect(unpackControls(`${packed}==`)).toEqual(unpackControls(packed))
    expect(
      unpackControls(packed.replace(/-/g, '+').replace(/_/g, '/')),
    ).toEqual(unpackControls(packed))
  })

  it('pulls a hand-edited value back onto the control', () => {
    // The safety property `parseSet` documents: `frameLock:0` gives the render
    // loop a divisor it cannot use, and a link must not be able to counterfeit
    // the lost rendering step in ADR 0004. Every value comes back through
    // `snapToStep`, so an index past the end of the travel lands on the rail.
    const def = SLIDER_BY_KEY.get('frameLock')!
    const at = URL_KEY_ORDER.indexOf('frameLock')
    const far = unpackControls(bytesToText([at, 9999 * 2 * 2])).frameLock
    expect(far).toBe(def.max)
    // and the other rail, which a count from zero can now reach
    expect(unpackControls(bytesToText([at, 9999 * 2 * 2 - 2])).frameLock).toBe(
      def.min,
    )
  })
})

// What a shared link is worth is whether it still opens the picture it was
// copied from, and nothing in a packed one is legible enough for a reader to
// notice that it has stopped. The name a link carries is an index and its value
// is a count of steps, so the two edits that would quietly redecode every link
// ever made are reordering URL_KEY_ORDER and changing a control's `step`.
//
// Neither is forbidden. Both are made loud here: these vectors are the format
// itself, written in physical units on one side and bytes on the other, so an
// edit that moves them fails the build with the control named rather than
// shipping and being discovered by somebody whose link opened wrong.
//
// Deliberately not built from a preset — a preset is content and gets retuned,
// and a golden vector that fails when somebody dials in more noise is one that
// gets updated without being read.
describe('the format, pinned', () => {
  const look: Controls = {
    ...DEFAULT_CONTROLS,
    noiseIre: 9,
    hHold: 0.2,
    cfbGain: -0.57,
    bendShape: 3,
    scDetuneKHz: 3.879,
  }

  it('writes these bytes for this look', () => {
    expect(packControls(look)).toBe('HZx5BFAEDCboAj_iAQ')
  })

  it('reads that look back out of those bytes', () => {
    expect(unpackControls('HZx5BFAEDCboAj_iAQ')).toEqual({
      noiseIre: 9,
      hHold: 0.2,
      cfbGain: -0.57,
      bendShape: 3,
      scDetuneKHz: 3.879,
    })
  })

  // The invariant behind the whole thing: what goes on the wire is the value in
  // units of `step`, and nothing else about the control's travel. That is why
  // widening a range — which this codebase does, and which `redline` is the
  // record of — leaves every existing link reading as it always did.
  it('counts steps from zero, so a control range is not part of the wire', () => {
    for (const [key, value] of [
      ['noiseIre', 9],
      ['cfbGain', -0.57],
      ['tintDeg', -45],
      ['crtGamma', 2.85],
    ] as const) {
      const def = SLIDER_BY_KEY.get(key)!
      const n = Math.round(value / def.step)
      expect(packControls({ ...DEFAULT_CONTROLS, [key]: value })).toBe(
        bytesToText([
          URL_KEY_ORDER.indexOf(key),
          (n < 0 ? -2 * n - 1 : 2 * n) * 2,
        ]),
      )
    }
  })
})

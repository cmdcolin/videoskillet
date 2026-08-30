import { describe, expect, it } from 'vitest'

import { CaptionState, CC_CR } from './captionstate'

// Everything the encoder does is arithmetic over character codes and a frame
// counter, which is exactly the kind of thing node can check every case of. What
// it cannot check is the other end — the slicer lives in WGSL and reads a
// waveform — so this pins what goes onto line 21 and nothing about what comes
// back off it.

// Codes the encoder actually put on the wire over `frames`, nulls dropped: a
// null is the encoder having nothing to say, which is most frames.
const sent = (cc: CaptionState, frames: number, vbi = 1): number[] => {
  const out: number[] = []
  for (let i = 0; i < frames; i++) {
    const { ccChar0, ccChar1 } = cc.update({ vbi })
    if (ccChar0 !== 0) out.push(ccChar0)
    if (ccChar1 !== 0) out.push(ccChar1)
  }
  return out
}

const text = (codes: number[]): string =>
  codes.map(c => (c === CC_CR ? '\n' : String.fromCodePoint(c))).join('')

describe('the caption encoder', () => {
  it('says nothing when it has nothing to say', () => {
    const cc = new CaptionState()
    expect(sent(cc, 120)).toEqual([])
    cc.setText('')
    expect(sent(cc, 120)).toEqual([])
  })

  it('is silent while the vertical interval carries no furniture', () => {
    const cc = new CaptionState()
    cc.setText('HELLO')
    expect(sent(cc, 120, 0)).toEqual([])
  })

  it('sends the text a character at a time, in order', () => {
    const cc = new CaptionState()
    cc.setText('BE KIND')
    expect(text(sent(cc, 60)).startsWith('BE KIND')).toBe(true)
  })

  it('ends every line with the code that rolls the page', () => {
    const cc = new CaptionState()
    cc.setText('ONE\nTWO')
    expect(text(sent(cc, 60))).toBe('ONE\nTWO\n')
  })

  // A caption is written far faster than it is read, so the gap after the last
  // character is not padding — it is what leaves the page up long enough to read.
  it('holds before it starts over', () => {
    const cc = new CaptionState()
    cc.setText('HI')
    const first = sent(cc, 30)
    expect(text(first)).toBe('HI\n')
    expect(sent(cc, 60)).toEqual([])
  })

  it('spends the wire at the rate it claims, not per frame', () => {
    const cc = new CaptionState()
    cc.setText('X'.repeat(200))
    // 30 characters a second at 60 frames, so a second of frames buys about 30.
    expect(sent(cc, 60).length).toBeGreaterThan(24)
    expect(sent(cc, 60).length).toBeLessThan(36)
  })

  it('cuts what a seven-bit encoder cannot carry down to a space', () => {
    const cc = new CaptionState()
    cc.setText('A█B')
    expect(text(sent(cc, 60))).toBe('A B\n')
  })

  it('starts the new text over rather than partway through the old', () => {
    const cc = new CaptionState()
    cc.setText('AAAA')
    sent(cc, 12)
    cc.setText('BBBB')
    expect(text(sent(cc, 30))).toBe('BBBB\n')
  })
})

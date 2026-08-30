// The caption encoder: the two characters line 21 carries this frame.
//
// Line 21 is a serial data channel, not an overlay, so text leaves here as
// bytes and arrives at the receiver as whatever survived the path — which is
// the whole reason the caption is worth having. Everything between is the
// signal chain doing what it already does to a waveform.
//
// A real encoder sends two seven-bit characters per field with odd parity on
// each, and sends nulls whenever it has nothing to say — which is most of the
// time, because a caption is written far faster than it is read. The gap is
// not padding: it is what makes a caption hold on screen after it arrives, and
// it is why a signal that dies mid-hold leaves the last caption sitting there
// rather than blanking.

// Characters a second on the wire. Real line 21 can burst at 120 and rarely
// does; this is roughly the rate a roll-up caption actually filled at, and slow
// enough that a fault lands on a caption you are still watching arrive.
const CPS = 30
// Nulls after the last character, before the stream loops. A caption is meant
// to be read, and a page that started again the moment it finished would never
// hold still long enough.
const HOLD_S = 2.5

// Carriage return. On a real decoder this is one of a pair of control bytes;
// here it is the single code that rolls the page up, because roll-up is the one
// caption mode this models and the pair would carry nothing else.
export const CC_CR = 0x0d

export interface CaptionInputs {
  vbi: number
}

export class CaptionState {
  private raw = ''
  private codes: number[] = []
  private at = 0
  private hold = 0
  private carry = 0

  text(): string {
    return this.raw
  }

  setText(text: string): void {
    if (text === this.raw) return
    this.raw = text
    this.codes = CaptionState.encode(text)
    this.at = 0
    this.hold = 0
    this.carry = 0
  }

  // Lines become rows, and a row ends with the code that rolls the page. Text
  // the ROM has no glyph for becomes a space rather than a hole: the encoder is
  // seven-bit, so this is the cut a real one made too.
  private static encode(text: string): number[] {
    if (text === '') return []
    const out: number[] = []
    for (const line of text.split('\n')) {
      for (const ch of line) {
        const code = ch.codePointAt(0) ?? 0x20
        out.push(code >= 0x20 && code <= 0x7f ? code : 0x20)
      }
      out.push(CC_CR)
    }
    return out
  }

  // Two codes a frame at the wire's rate, nulls the rest of the time. The
  // fractional carry is what keeps the rate honest: at 30 characters a second
  // and 60 frames, most frames send nothing and every fourth sends a pair.
  update(c: CaptionInputs): { ccChar0: number; ccChar1: number } {
    if (c.vbi === 0 || this.codes.length === 0)
      return { ccChar0: 0, ccChar1: 0 }
    if (this.hold > 0) {
      this.hold -= 1
      return { ccChar0: 0, ccChar1: 0 }
    }
    this.carry += CPS / 60
    if (this.carry < 2) return { ccChar0: 0, ccChar1: 0 }
    this.carry -= 2
    const first = this.next()
    // Running out mid-pair fills the second slot with a null rather than the
    // first character of the next time round. The hold is the caption sitting
    // on screen being read, and a pair that reached across it would put one
    // stray character on the page a beat before the rest of the line.
    return { ccChar0: first, ccChar1: this.hold > 0 ? 0 : this.next() }
  }

  private next(): number {
    const code = this.codes[this.at]
    this.at += 1
    if (this.at >= this.codes.length) {
      this.at = 0
      this.hold = Math.round(HOLD_S * 60)
    }
    return code
  }
}

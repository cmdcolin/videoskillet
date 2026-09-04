import { DEFAULT_CONTROLS } from '../core/controls'
import { ALL_SLIDERS, SLIDER_BY_KEY, snapToStep } from './controls'

import type { ControlKey, Controls } from '../core/controls'
import type { SliderDef } from './controls'

// The short form of a link's look: the same controls `?set=` names, written as
// bytes instead of words. A rolled look is a 252-character query written by
// name and 82 packed; `wornTape` is 248 against 65. Three times shorter, and
// four times shorter than the same look as the address bar used to carry it,
// which is the difference between a link that survives a chat window and one
// that arrives in three pieces.
//
// Compressing the names does not get you there. A 253-character look comes out
// of deflate at 256 and brotli at 239 once base64 has charged a third of the
// payload back — there is not enough text in a two-hundred-character string for
// a dictionary coder to earn its overhead. What pays is dropping the words: a
// control is a position in a frozen list, and its value is a count of its own
// steps.
//
// Nothing is lost doing that. `?set=` already writes six decimals because that
// is what `snapToStep` rounds to; the step count says the same thing in one
// varint. See urlParams.ts for which form goes in the query.

// The wire is numbered by the `id` each control carries in the control table
// (ui/controls.ts), not by where it sits in any list here. That is the whole
// difference: there is no order to keep, so moving a slider into the group it
// belongs in cannot silently repoint every link ever made at a different
// control. A number is assigned once and never changes or comes back — a
// deleted control just leaves a gap, and the reader steps over it.
const BY_ID = new Map<number, ControlKey>(ALL_SLIDERS.map(s => [s.id, s.key]))
// Ascending, because the encoder writes the *gap* since the last control it
// wrote and a gap has to be positive.
const IN_ORDER: readonly SliderDef[] = ALL_SLIDERS.toSorted(
  (x, y) => x.id - y.id,
)

// A value is counted from zero rather than from the control's `min`, and that
// is the whole of what makes a packed link keep meaning what it meant.
//
// Counting from `min` would have been a byte or two shorter (6% measured over
// every preset and twenty rolls), and it ties the link to a number this
// codebase demonstrably edits: `redline` exists precisely because controls have
// had their ranges widened, and every one of those retunes would have slid
// every existing link for that control by the distance `min` moved — silently,
// because a packed link has nothing in it a reader could check. From zero, a
// widened range is what it should be: the same values, with more of them now
// reachable. `?set=noiseIre:9` means 9 IRE forever, and so does this.
//
// Two things are still part of the wire. Every control's `id` is the dangerous
// one — change one and every link carrying that control decodes to a different
// one — and the golden vectors at the foot of packed.test.ts fail the moment
// any of them moves. The other is `step`, the unit the count is in:
// changing one moves every existing link for that control, but by less than a
// step, since the value is re-snapped to whatever grid the control now has.
// That is worth knowing before retuning a step and is not worth a 247-entry
// table to guard.
const CENTS = 100

// Signed, because a count from zero goes both ways on a control whose travel
// crosses it (`cfbGain`, `tintDeg`, every detune). Zigzag rather than a sign
// bit so that small departures either side of zero stay one byte.
const zig = (n: number) => (n < 0 ? -2 * n - 1 : 2 * n)
const zag = (n: number) => (n % 2 === 1 ? -(n + 1) / 2 : n / 2)

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

// The wire's grid, told by the low bit rather than by which control it is, so
// the reader never has to know which controls carry a vernier card: even counts
// whole steps, odd counts hundredths of one (what the card leaves behind —
// vernier.ts). Reading that off the live schema instead would have put every
// existing link for a control a hundred-fold wrong the day it gained a card.
//
// A hundredth of a step is therefore the format's floor. Nothing in the app
// writes finer — the tests round-trip every preset and twenty rolls exactly —
// and anything that did would land on the nearest hundredth without saying so.
function toInt(key: ControlKey, v: number): number {
  const def = SLIDER_BY_KEY.get(key)
  if (def === undefined) return 0
  const notch = Math.round(v / def.step)
  if (near(notch * def.step, v)) return zig(notch) * 2
  return zig(Math.round((v * CENTS) / def.step)) * 2 + 1
}

function fromInt(key: ControlKey, n: number): number | undefined {
  const def = SLIDER_BY_KEY.get(key)
  if (def === undefined) return undefined
  // Through the same snap `?set=` goes through, so the value lands where the
  // named form would land — and a hand-edited link cannot put one past the
  // rails, which is the safety property `parseSet` documents at length.
  const grid = (n & 1) === 1 ? { ...def, step: def.step / CENTS } : def
  return snapToStep(grid, zag(n >>> 1) * grid.step)
}

function putVarint(out: number[], n: number) {
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  out.push(n)
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

// Two characters of checksum, a '.', then the bytes: `?p=9K.HZx5BFAEDCboAj_iAQ`.
//
// A packed link that loses its tail decodes to a shorter look, and one with a
// character changed decodes to a different one — neither is an error, and
// nothing in the bytes is legible enough for a reader to notice. The seal is
// what makes either loud: twelve bits of FNV-1a over the bytes, so a damaged
// link is refused with a notice rather than opened on a picture nobody made.
//
// In front rather than behind, because behind is exactly what a cut takes: a
// link truncated ahead of a trailing seal has no seal, and reads as an honest
// unsigned link. Ahead of the body it survives any cut the body does not.
//
// The '.' is outside the alphabet and is not one `URLSearchParams` escapes, so
// a link written before the seal existed has none anywhere in it and reads as
// unsigned, and a link written after it survives a paste that escapes it.
const SEAL = '.'
const SEAL_LEN = 2

function seal(bytes: readonly number[]): string {
  let h = 0x811c9dc5
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193)
  h >>>= 0
  const n = (h ^ (h >>> 12) ^ (h >>> 24)) & 0xfff
  return `${B64[n >> 6]}${B64[n & 63]}`
}

// Written out rather than handed to btoa, which wants a binary string and then
// wants three characters swapped out of its answer to be url-safe. The alphabet
// above is already the one a query string carries as itself, which is half of
// why the short form wins by more than the byte count says: `?set=` spends
// three characters on every `:` and `,` once the browser has encoded it.
//
// Nothing pads: dropping the '=' costs the reader nothing, because n bytes
// always come back out of ceil(n * 4 / 3) characters exactly.
function toBase64Url(bytes: readonly number[]): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n =
      ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    const left = bytes.length - i
    out += (B64[(n >> 18) & 63] ?? '') + (B64[(n >> 12) & 63] ?? '')
    if (left > 1) out += B64[(n >> 6) & 63] ?? ''
    if (left > 2) out += B64[n & 63] ?? ''
  }
  return out
}

function fromBase64Url(text: string): number[] | null {
  const bytes: number[] = []
  let acc = 0
  let bits = 0
  // '=' because a link may have been through something that pads, '.' because a
  // link pasted at the end of a sentence picks one up, and the other two
  // because the plain alphabet is what most encoders reach for.
  for (const ch of text.replace(/[=.]+$/, '')) {
    const v = B64.indexOf(ch === '+' ? '-' : ch === '/' ? '_' : ch)
    if (v < 0) return null
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((acc >> bits) & 0xff)
    }
  }
  return bytes
}

/** A look as bytes: every control off default, by its `id` in the table. */
export function packControls(c: Partial<Controls>): string {
  const bytes: number[] = []
  let prev = -1
  for (const { key, id } of IN_ORDER) {
    const v = c[key]
    if (v === undefined || v === DEFAULT_CONTROLS[key] || !Number.isFinite(v)) {
      continue
    }
    const i = id
    // The gap since the last control written rather than the index itself: what
    // a look holds arrives in runs — a preset moves a whole group of the panel
    // at once — so a run costs one byte a control instead of two.
    putVarint(bytes, i - prev - 1)
    prev = i
    putVarint(bytes, toInt(key, v))
  }
  return bytes.length === 0 ? '' : `${seal(bytes)}${SEAL}${toBase64Url(bytes)}`
}

// Whatever look the bytes carry. Junk decodes to an empty patch rather than
// throwing: a link is untrusted input, and a mangled one opening on the default
// look is the failure `?set=` already has for a name it cannot place.
//
// Null is the one answer that is not a look: the link was sealed and the seal
// does not match what arrived, so the bytes are not the ones that were written
// and no prefix of them is the picture either. The caller says so.
export function unpackControls(text: string): Partial<Controls> | null {
  const sealed = text[SEAL_LEN] === SEAL
  const bytes = fromBase64Url(sealed ? text.slice(SEAL_LEN + 1) : text)
  // A character the alphabet does not have is damage too, and under a seal it
  // has to answer the way a turned character does. This used to fall through to
  // the unsealed answer — an empty look, `damaged: false`, and the app opening
  // on the default picture with nothing said — so which of the two a damaged
  // link got came down to whether whatever mangled it happened to land inside
  // the alphabet.
  if (bytes === null) return sealed ? null : {}
  if (sealed && seal(bytes) !== text.slice(0, SEAL_LEN)) return null
  const out: Partial<Controls> = {}
  let at = 0
  let prev = -1
  const varint = (): number | null => {
    let n = 0
    let shift = 0
    for (;;) {
      const byte = bytes[at++]
      if (byte === undefined || shift > 28) return null
      n |= (byte & 0x7f) << shift
      if ((byte & 0x80) === 0) return n >>> 0
      shift += 7
    }
  }
  while (at < bytes.length) {
    const gap = varint()
    const value = gap === null ? null : varint()
    if (gap === null || value === null) break
    const i = prev + 1 + gap
    prev = i
    // A number this build has no control for: a retired one, or one from a
    // newer app. Either way every field is a varint, so the reader steps over
    // it and keeps the rest of the look rather than opening on the default.
    const key = BY_ID.get(i)
    if (key === undefined) continue
    const v = fromInt(key, value)
    if (v !== undefined) out[key] = v
  }
  return out
}

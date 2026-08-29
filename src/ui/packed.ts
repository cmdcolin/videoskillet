import { DEFAULT_CONTROLS } from '../core/controls'
import { SLIDER_BY_KEY, snapToStep } from './controls'

import type { ControlKey, Controls } from '../core/controls'

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

// The wire order, and the reason this list is written out rather than taken
// from CONTROL_KEYS: a packed link says "control 84", so the day someone
// reorders DEFAULT_CONTROLS — moving a control into the group it belongs to is
// a tidy, and the panel already reads its own order from GROUPS — every link
// ever made would quietly decode to a different look. Adding a control means
// appending here, never inserting and never reordering. packed.test.ts fails if
// the two lists stop holding the same names, which turns "append" from a rule
// someone remembers into one the build checks.
export const URL_KEY_ORDER: readonly ControlKey[] = [
  'deint',
  'capLumaMHz',
  'capChromaMHz',
  'capYcDelayNs',
  'capNoiseIre',
  'capChromaNoiseIre',
  'srcNoiseBwMHz',
  'srcNoiseLine',
  'srcNoiseLevel',
  'srcNoiseHz',
  'synthAHz',
  'synthBHz',
  'synthShape',
  'synthMix',
  'synthLevel',
  'synthColor',
  'synthHueDeg',
  'synthOver',
  'synthFm',
  'encChromaMHz',
  'invert',
  'demodMHz',
  'chromaTail',
  'chromaCoarse',
  'chromaGain',
  'burstLock',
  'tintDeg',
  'demodAxisDeg',
  'matrixClip',
  'scDetuneKHz',
  'killThresh',
  'accLagLines',
  'svideoBleed',
  'combMode',
  'hHold',
  'vHold',
  'vFreqHz',
  'syncBendUs',
  'bendUs',
  'bendShape',
  'bendPeriod',
  'vSize',
  'hvSagUs',
  'hvRing',
  'abl',
  'hDetuneHz',
  'clipHz',
  'clipPoint',
  'clipBite',
  'clipDwellMs',
  'clipChatter',
  'audioGain',
  'audioBendUs',
  'audioLoad',
  'audioIre',
  'audioHueDeg',
  'audioSagUs',
  'audioRoll',
  'audioTear',
  'lumaMHz',
  'polarityFlip',
  'termination',
  'chromaPinOnly',
  'connectorGlitch',
  'connectorMode',
  'scramble',
  'scrambleMode',
  'macrovision',
  'mvStripeDeg',
  'vbi',
  'enhClampUs',
  'enhDroopUs',
  'enhPeakMHz',
  'enhPeakQ',
  'enhPeakBoost',
  'enhSync',
  'enhSliceIre',
  'lumaPeak',
  'noiseIre',
  'noiseTilt',
  'impulseRate',
  'impulseIre',
  'impulseHz',
  'impulseMains',
  'strikeRate',
  'soundIre',
  'buzzLevel',
  'rfAdjacent',
  'rfMistuneMHz',
  'rfSnow',
  'ingress',
  'agc',
  'ghostDelayUs',
  'ghostGain',
  'humAmp',
  'humMod',
  'colorUnderMix',
  'chromaNoiseIre',
  'underJitterDeg',
  'dropoutRate',
  'dropoutLenUs',
  'dropoutComp',
  'headSwitchNoise',
  'headSwitchShiftUs',
  'headClog',
  'ycDelayNs',
  'diffGain',
  'diffPhaseDeg',
  'fmOverdev',
  'fmStreakUs',
  'tbJitterNs',
  'tbWowNs',
  'tbStickNs',
  'dubGens',
  'fbMix',
  'fbZoom',
  'fbRotateDeg',
  'fbShiftX',
  'fbShiftY',
  'fbGain',
  'fbIris',
  'fbFocus',
  'fbVign',
  'fbBlack',
  'fbKnee',
  'crtCutoff',
  'crtGamma',
  'crtSat',
  'crtSpot',
  'crtGrain',
  'crtBloom',
  'crtHalation',
  'crtGlow',
  'crtHaloKey',
  'crtSvm',
  'crtSvmWidth',
  'crtConverge',
  'crtPurity',
  'crtPurityX',
  'crtPurityY',
  'crtPuritySize',
  'cfbMix',
  'cfbGain',
  'cfbDelayUs',
  'cfbLines',
  'cfbKey',
  'cfbKeyLevel',
  'cfbKeySoft',
  'cfbHold',
  'cfbTrail',
  'cfbFilterMHz',
  'cfbFilterQ',
  'cfbFilterBoost',
  'cfbServoUs',
  'cfbRing',
  'tapeMix',
  'tapeLoopMm',
  'tapeGain',
  'tapeHfLoss',
  'tapeNoiseIre',
  'tapeWear',
  'tapeSplice',
  'tapeRecord',
  'tapeTransport',
  'tapeShuttle',
  'tapeHeads',
  'tapeHeadSpread',
  'tapeWowPct',
  'tapeColourFrame',
  'aScramble',
  'aScrambleMode',
  'aTermination',
  'aNoiseIre',
  'aPolarity',
  'aHumIre',
  'aConnector',
  'aConnectorMode',
  'aPause',
  'aDropoutRate',
  'aDropoutLenUs',
  'bScramble',
  'bScrambleMode',
  'bTermination',
  'bNoiseIre',
  'bPolarity',
  'bHumIre',
  'bConnector',
  'bConnectorMode',
  'bDropoutRate',
  'bDropoutLenUs',
  'aGain',
  'bGain',
  'bRing',
  'bLineHz',
  'bDetuneHz',
  'bRollLps',
  'bHueDeg',
  'bVidGain',
  'bInv',
  'bPause',
  'bGenlock',
  'wipeMode',
  'wipePos',
  'wipeSoft',
  'wipeRate',
  'pipMix',
  'pipX',
  'pipY',
  'pipW',
  'pipH',
  'pipBorder',
  'pipSoft',
  'pipKey',
  'pipKeyLevel',
  'pipKeySoft',
  'bKey',
  'bKeyHueDeg',
  'bKeyAcceptDeg',
  'bKeyClip',
  'bKeySoft',
  'bKeySpill',
  'bKeyDelayUs',
  'bKeyFill',
  'bKeyMatteY',
  'bKeyMatteHueDeg',
  'bKeyMatteSat',
  'trackAmt',
  'trackPos',
  'trackHunt',
  'trackKick',
  'shuttleX',
  'strobeHz',
  'strobeMs',
  'scanBeam',
  'scanBloom',
  'phosphor',
  'phosphorMode',
  'phosphorSkew',
  'phosphorBleed',
  'crtSharp',
  'maskAmt',
  'maskPitch',
  'crtZoom',
  'crtZoomX',
  'crtZoomY',
  'timeScale',
  'frameLock',
  'cc',
  'ccBox',
]

const INDEX = new Map(URL_KEY_ORDER.map((k, i) => [k, i]))

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
// Two things are still part of the wire. The order of URL_KEY_ORDER is the
// dangerous one — reorder it and every link ever made decodes to a different
// control — and the golden vectors at the foot of packed.test.ts fail the
// moment it moves, which is the check the "append, never insert" comment above
// only asks for politely. The other is `step`, the unit the count is in:
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
  // '=' because a link may have been through something that pads, and the other
  // two because the plain alphabet is what most encoders reach for.
  for (const ch of text.replace(/=+$/, '')) {
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

/** A look as bytes: every control off default, by position in URL_KEY_ORDER. */
export function packControls(c: Partial<Controls>): string {
  const bytes: number[] = []
  let prev = -1
  for (const key of URL_KEY_ORDER) {
    const v = c[key]
    if (v === undefined || v === DEFAULT_CONTROLS[key] || !Number.isFinite(v)) {
      continue
    }
    const i = INDEX.get(key) ?? 0
    // The gap since the last control written rather than the index itself: what
    // a look holds arrives in runs — a preset moves a whole group of the panel
    // at once — so a run costs one byte a control instead of two.
    putVarint(bytes, i - prev - 1)
    prev = i
    putVarint(bytes, toInt(key, v))
  }
  return toBase64Url(bytes)
}

// Whatever look the bytes carry. Junk decodes to an empty patch rather than
// throwing: a link is untrusted input, and a mangled one opening on the default
// look is the failure `?set=` already has for a name it cannot place.
export function unpackControls(text: string): Partial<Controls> {
  const bytes = fromBase64Url(text)
  if (bytes === null) return {}
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
    // A control this build has never heard of is a link from a newer app. The
    // order only grows at the end, so an unknown control is off the end of this
    // build's list — and because every field is a varint the reader steps over
    // it and keeps the rest, rather than the whole link opening as default.
    const key = URL_KEY_ORDER[i]
    if (key === undefined) continue
    const v = fromInt(key, value)
    if (v !== undefined) out[key] = v
  }
  return out
}

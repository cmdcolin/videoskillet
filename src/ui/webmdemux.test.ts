import { describe, expect, it } from 'vitest'

import { demuxWebm } from './webmdemux'

// EBML written by hand: an ID as its bytes, a size as a variable-length integer
// (eight bytes, or all ones for unknown), then the payload.
const size = (n: number | null): number[] => {
  if (n === null) return [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
  const out = [0x01]
  for (let i = 6; i >= 0; i--) out.push(Math.floor(n / 256 ** i) % 256)
  return out
}
const el = (id: number[], payload: number[], unknown = false): number[] => [
  ...id,
  ...size(unknown ? null : payload.length),
  ...payload,
]
const uint = (id: number[], n: number) => el(id, [n >> 8, n & 0xff])

const EBML = [0x1a, 0x45, 0xdf, 0xa3]
const SEGMENT = [0x18, 0x53, 0x80, 0x67]
const INFO = [0x15, 0x49, 0xa9, 0x66]
const TIMECODE_SCALE = [0x2a, 0xd7, 0xb1]
const TRACKS = [0x16, 0x54, 0xae, 0x6b]
const CLUSTER = [0x1f, 0x43, 0xb6, 0x75]

const track = (codec: string, extra: number[] = []) =>
  el(TRACKS, [
    ...el(
      [0xae],
      [
        ...uint([0xd7], 1),
        ...uint([0x83], 1),
        ...el([0x86], Array.from(new TextEncoder().encode(codec))),
        ...el([0xe0], [...uint([0xb0], 640), ...uint([0xba], 480)]),
        ...extra,
      ],
    ),
  ])

// A SimpleBlock on track 1 at `time` ticks after its cluster.
const simple = (time: number, key: boolean, frame: number[], flags = 0) =>
  el([0xa3], [0x81, time >> 8, time & 0xff, (key ? 0x80 : 0) | flags, ...frame])

const cluster = (base: number, blocks: number[][], unknown = false) =>
  el(CLUSTER, [...uint([0xe7], base), ...blocks.flat()], unknown)

const file = (tracks: number[], clusters: number[][], scale = 1_000_000) =>
  new Uint8Array([
    ...el(EBML, []),
    ...el(SEGMENT, [
      ...el(INFO, [
        ...el(TIMECODE_SCALE, [
          (scale >> 16) & 0xff,
          (scale >> 8) & 0xff,
          scale & 0xff,
        ]),
      ]),
      ...tracks,
      ...clusters.flat(),
    ]),
  ])

describe('demuxWebm', () => {
  it('reads blocks across clusters in their own time', () => {
    const bytes = file(track('V_VP8'), [
      cluster(0, [simple(0, true, [1, 2, 3]), simple(33, false, [4])]),
      cluster(1000, [simple(0, false, [5, 6])]),
    ])
    const t = demuxWebm(bytes)!
    expect(t.codec).toBe('vp8')
    expect([t.codedWidth, t.codedHeight]).toEqual([640, 480])
    expect(t.timescale).toBe(1000)
    expect(t.samples.map(s => [s.cts, s.dts, s.key])).toEqual([
      [0, 0, true],
      [33, 33, false],
      [1000, 1000, false],
    ])
    const first = t.samples[0]!
    expect([
      ...bytes.subarray(first.offset, first.offset + first.size),
    ]).toEqual([1, 2, 3])
  })

  it('counts time in the timecode scale', () => {
    const t = demuxWebm(
      file(track('V_VP8'), [cluster(0, [simple(0, true, [1])])], 100_000),
    )!
    expect(t.timescale).toBe(10_000)
  })

  it('reads a block group as a keyframe unless it references another', () => {
    const group = (time: number, ref: boolean) =>
      el(
        [0xa0],
        [
          ...el([0xa1], [0x81, 0, time, 0, 9]),
          ...(ref ? el([0xfb], [0xff]) : []),
        ],
      )
    const t = demuxWebm(
      file(track('V_VP8'), [cluster(0, [group(0, false), group(40, true)])]),
    )!
    expect(t.samples.map(s => s.key)).toEqual([true, false])
  })

  it('ends a cluster of unknown size where the next one starts', () => {
    const t = demuxWebm(
      file(track('V_VP8'), [
        cluster(0, [simple(0, true, [1]), simple(33, false, [2])], true),
        cluster(500, [simple(0, false, [3])], true),
      ]),
    )!
    expect(t.samples.map(s => s.cts)).toEqual([0, 33, 500])
  })

  it('declines laced blocks and files that are not WebM', () => {
    expect(
      demuxWebm(file(track('V_VP8'), [cluster(0, [simple(0, true, [1], 2)])])),
    ).toBeNull()
    expect(
      demuxWebm(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])),
    ).toBeNull()
    expect(
      demuxWebm(file(track('V_THEORA'), [cluster(0, [simple(0, true, [1])])])),
    ).toBeNull()
  })

  it('reads the VP9 profile and bit depth off the first keyframe', () => {
    // An uncompressed header: frame marker 0b10, profile low then high bit, a
    // reserved bit in profile 3, four flags (a shown keyframe), the sync code,
    // and from profile 2 the ten_or_twelve_bit flag.
    const header = (profile: number, twelve = false) => {
      const bits = [1, 0, profile & 1, profile >> 1]
      if (profile === 3) bits.push(0)
      bits.push(0, 0, 1, 0)
      for (const b of [0x49, 0x83, 0x42])
        for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1)
      if (profile >= 2) bits.push(twelve ? 1 : 0)
      while (bits.length % 8 !== 0) bits.push(0)
      return Array.from({ length: bits.length / 8 }, (_, i) =>
        bits.slice(i * 8, i * 8 + 8).reduce((v, b) => (v << 1) | b, 0),
      )
    }
    const vp9 = (frame: number[]) =>
      demuxWebm(file(track('V_VP9'), [cluster(0, [simple(0, true, frame)])]))!
        .codec
    expect(vp9(header(0))).toBe('vp09.00.41.08')
    expect(vp9(header(1))).toBe('vp09.01.41.08')
    expect(vp9(header(2))).toBe('vp09.02.41.10')
    expect(vp9(header(2, true))).toBe('vp09.02.41.12')
    expect(vp9(header(3, true))).toBe('vp09.03.41.12')
  })

  it('reports a display size apart from the coded one', () => {
    const t = demuxWebm(
      file(
        track('V_VP8', [
          ...el(
            [0xe0],
            [...uint([0x54, 0xb0], 853), ...uint([0x54, 0xba], 480)],
          ),
        ]),
        [cluster(0, [simple(0, true, [1])])],
      ),
    )!
    expect([t.displayWidth, t.displayHeight]).toEqual([853, 480])
  })

  it('ends a clip with no Duration one frame after its last start', () => {
    const t = demuxWebm(
      file(track('V_VP8'), [
        cluster(0, [
          simple(0, true, [1]),
          simple(40, false, [2]),
          simple(80, false, [3]),
        ]),
      ]),
    )!
    expect(t.duration).toBe(120)
  })

  it('keeps the clusters a truncated file still holds', () => {
    const whole = file(track('V_VP8'), [
      cluster(0, [simple(0, true, [1])]),
      cluster(500, [simple(0, false, [2, 3, 4, 5])]),
    ])
    const t = demuxWebm(whole.subarray(0, whole.length - 3))!
    expect(t.samples.map(s => s.cts)).toEqual([0])
  })

  it('declines a track whose first block is not a keyframe', () => {
    expect(
      demuxWebm(file(track('V_VP8'), [cluster(0, [simple(0, false, [1])])])),
    ).toBeNull()
  })

  it('spells AV1 out of its av1C record', () => {
    // Profile 0, level 8 (4.0), main tier, 10-bit.
    const av1C = [0x81, 0x08, 0x40, 0x00]
    const t = demuxWebm(
      file(track('V_AV1', el([0x63, 0xa2], av1C)), [
        cluster(0, [simple(0, true, [1])]),
      ]),
    )!
    expect(t.codec).toBe('av01.0.08M.10')
    expect([...t.description!]).toEqual(av1C)
  })
})

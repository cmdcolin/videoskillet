# 0008 — Record H.264 High, pick the level from the frame, and know where the chroma went

**Status:** accepted, 2026-08-24.

## Context

`ui/record.ts` asked for `avc1.42002a` — H.264 Baseline, level 4.2 — as a
constant, with a comment calling it "the profile every editor and phone
decodes". Both halves of that string turned out to be wrong, and the second one
had been quietly costing picture since the module was written.

**The level is not a label, it is a budget, and Chrome enforces it.** A level
caps the coded picture area. Level 4.2 allows 8704 macroblocks — 2228224
samples. A 2560x1592 retina window codes as 2560x1600, which is 16000
macroblocks, and `configure` refuses it outright:

```
The provided resolution (2560x1592) has a coded area (2560*1600=4096000)
which exceeds the maximum coded area (2228224) supported by the AVC level
(4.2) indicated by the codec string (0x2A).
```

So recording did not degrade on a large display, it failed to start. Firefox on
a smaller window never hit it, which is why it survived this long.

**Baseline was an argument from 2010.** It forbids CABAC and the 8x8 transform,
and both are worth most on exactly this content — grain, dot crawl, a new noise
field every frame. Measured with `scripts/enccheck.mjs` on Chrome 151.0.7922.174
/ macOS 15.7.6, 16 frames of grain and one-pixel structure at 2560x1600, handed
over as `I420` and decoded back to score:

| arm          | asked | written    | luma PSNR |
| ------------ | ----- | ---------- | --------- |
| baseline 5.0 | 60M   | 175 Mbps   | 24.52 dB  |
| main 5.0     | 60M   | 142.9 Mbps | 24.63 dB  |
| high 5.0     | 60M   | 143 Mbps   | 24.63 dB  |

The same picture for 18% fewer bits. Nothing that has shipped this decade fails
to decode High.

Three other things fell out of the same run, and they are the reason this record
exists rather than a commit message.

**`bitrate` is close to advisory.** VideoToolbox overshot every target — 60M
asked, 143 written; 400M asked, 751 written. The `MIN_BITRATE`/`MAX_BITRATE`
clamp in `record.ts` is therefore not the control its comment implies, and
raising the ceiling is not a reliable way to buy quality.
`bitrateMode: 'quantizer'` **is** honoured (QP 24 → 35.85 dB, QP 20 → 39.71 dB,
QP 16 → 43.85 dB) and is the only knob here that does what it says.

**`hardwareAcceleration: 'prefer-software'` is a downgrade, not an upgrade.**
Chrome's software H.264 encoder is OpenH264, which is Baseline-only: 186.6 Mbps
for 24.26 dB, worse than hardware on both axes. The instinct that software
encoders are the higher-quality option is correct for x264 and wrong here.

**The remaining ceiling is chroma, and it is structural.** H.264 as offered here
is 4:2:0 — High 4:2:2, High 4:4:4 and High 10 are all declined by
`isConfigSupported` on this machine. Against a source carrying one-pixel
alternating chroma, which is what dot crawl _is_ (1280x800, 12 frames, 80M
asked, decoded chroma upsampled to full resolution before scoring, so each arm
is judged on what a viewer sees rather than on its own sample grid):

| arm              | written    | luma PSNR | chroma PSNR  |
| ---------------- | ---------- | --------- | ------------ |
| H.264 High 4:2:0 | 178.7 Mbps | 32.32 dB  | **15.54 dB** |
| VP9 p0 4:2:0     | 82.3 Mbps  | 27.18 dB  | 12.54 dB     |
| VP9 p1 4:4:4     | 146.7 Mbps | 23.47 dB  | 23.13 dB     |
| AV1 high 4:4:4   | 114.8 Mbps | 28.29 dB  | **43.38 dB** |

28 dB of chroma, for fewer bits. No bitrate recovers the 4:2:0 arms: the samples
are not there to spend bits on. Chrome will encode VP9 4:4:4 and AV1 4:4:4 here
today; what is missing is muxing, since `ui/mp4.ts` writes `avc1`/`avcC` sample
entries and nothing else.

## Decision

**The codec string is computed per recording, not declared.** `record.ts` builds
a candidate list — profiles best-first (`6400`, `4d00`, `4200`), and within each
the levels whose `maxFS` covers the frame, smallest first — and takes the first
one `VideoEncoder.isConfigSupported` admits. Profile is the outer loop because a
lesser profile costs picture on every frame, where a level larger than the frame
needs costs nothing at all.

The probe is not decoration: `isConfigSupported` discriminates on this machine,
declining High 10 and both higher chroma formats, so a platform without High
falls back to Main or Baseline rather than failing the take.

**4:2:0 is accepted as the current ceiling.** The AV1 4:4:4 route is not taken.

## Consequences

- **The muxer needed no change and must not grow one for this.** `normaliseAvcc`
  takes the profile/compat/level triplet from the SPS itself rather than from
  the `avcC` header, so it follows the encoder wherever the profile goes. Its
  duplicate-NAL-header check compares a set's second byte against its own NAL
  type, which is safe for every profile byte in use (0x64, 0x4d, 0x42 against
  0x67/0x68) — but it is a check about byte values, so a future profile byte of
  0x67 would break it silently.
- **Do not pin the codec string again**, and do not "simplify" the candidate
  list back to one entry. The whole failure above was a constant that was true
  of the window somebody happened to test on.
- **Do not add `hardwareAcceleration: 'prefer-software'`** in pursuit of
  quality. It selects OpenH264 and costs both bitrate and dB.
- **Do not reach for a screen recorder.** OBS and its kind timestamp by wall
  clock, which is the variable-framerate problem the whole module header exists
  to explain: a frame that took 40ms lands 40ms in, and an NLE conforms the file
  by dropping or duplicating. `renderTake` in `ui/render.ts` is the answer to "I
  want it to look better" — it is not realtime, so it can spend as long per
  frame as it needs.
- **`bitrate` cannot be trusted as a quality control**, so a future quality
  setting should be `bitrateMode: 'quantizer'` with a QP, not a bigger number in
  `MAX_BITRATE`.
- **Chroma detail is lost before the encoder's rate control ever sees it.** When
  someone reports that fine colour detail looks mushy, the answer is 4:2:0 and
  not the bitrate — reopen the AV1 4:4:4 option rather than turning knobs.

`scripts/enccheck.mjs` re-derives every number above against a new browser
build. Its source is deliberately harder to compress than the app's picture, so
the Mbps figures are an upper bound and the dB figures a lower one; what
transfers between runs is the ordering between arms.

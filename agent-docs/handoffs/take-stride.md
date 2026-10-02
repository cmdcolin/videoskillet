# Handoff: sheared live takes, and what Chrome still has to confirm

Written 2026-10-02 on the Linux dev box (Firefox Nightly 151, Chrome 154). The
owner reported that every main-app take since v2.7.0 exported as diagonal
streaks, for example a 1494x902 take from 2026-10-01.

## Status

Fixed in Firefox Nightly by
`fix(gpu): pack a live take's rows before building its VideoFrame`. Chrome on
this box has no WebGPU, so the take path has not run in Chrome at all. The
WebCodecs half has, through `scripts/stridecheck.mjs`.

## Cause

`FrameRead` (`src/core/gpu/frameread.ts`) copies the swapchain texture into a
mappable buffer, and WebGPU pads each row of that copy to a multiple of 256
bytes. At 1494 wide a row holds 5976 bytes of picture in 6144. The old code
passed the padded buffer to `new VideoFrame` with `layout: [{ stride: 6144 }]`.
Firefox Nightly ignores that stride and reads each row at 5976, so every row
starts 42 px earlier than the one above it, and the picture shears into
near-horizontal streaks. A width that is a multiple of 64 has no padding, which
is why `rectakecheck.mjs` at 1280x800 never saw it.

`FrameRead` now packs the rows into a reused buffer when the stride has padding.
The packing costs 0.53 ms a frame at 1494x902, and the VideoFrame copy from a
tight buffer costs 4.35 ms against 5.33 ms from the padded one, so a take costs
what it did before.

## What `stridecheck.mjs` measured

`node scripts/stridecheck.mjs --browser=firefox|chrome` builds a frame from
padded rows three ways and reads it back. It needs no WebGPU and no dev server.

| check   | Firefox Nightly 151     | Chrome 154    |
| ------- | ----------------------- | ------------- |
| layout  | wrong from pixel (0, 1) | right         |
| crop    | right                   | right         |
| encoded | bars 62.24 px apart     | bars 64.00 px |

`crop` describes the padded buffer as a frame `stride / 4` wide and crops it
with `visibleRect`. Firefox reads that back correctly, but its H.264 encoder
scales the whole coded width down to the visible one, so bars drawn 64 px apart
come back 62.24 px apart. That ruled out the crop as a zero-copy fix. Chrome
crops correctly on every route, so the old code was most likely correct there.

## To check on a machine with Chrome and WebGPU

1. `node scripts/stridecheck.mjs --browser=chrome` should still match the table.
2. Record a take in Chrome at a window whose canvas is not a multiple of 64
   wide, and confirm it plays upright. `rectakecheck.mjs` launches Firefox only
   (open item 1 in `record-clip-audio.md`), so this is a manual take or a Chrome
   arm for that harness.
3. Watch the console during the take for
   `[Invalid CommandBuffer] is invalid due to a previous error`. The owner saw
   it in Firefox around the same time, and the cause is not pinned down. One way
   to produce it is fixed in
   `fix(gpu): keep a take's canvas usage when the surface is rebuilt`:
   `recoverSurface` reconfigured the canvas without `COPY_SRC` and
   `TEXTURE_BINDING`, which made every later frame's copy invalid. If the error
   still appears during a take, that commit did not cover the cause.
4. Before switching `FrameRead` back to the `layout` stride, rerun
   `stridecheck.mjs` against a newer Firefox build. Its layout row has to read
   `right` first.

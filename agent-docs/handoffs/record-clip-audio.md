# Handoff: record the clip's sound with a main-app take

Written 2026-09-30, after two design reviews and a spike in Firefox Nightly on
the Linux dev box. A user asked for recordings to carry the audio of the video
they were playing with.

## Status

The feature is on main and passes in Firefox Nightly.
[ADR 0013](../../docs/adr/0013-a-live-take-runs-on-the-wall-clock.md) records
the design. `scripts/rectakecheck.mjs` checks a silent take and a take with
sound through the app's own record key at 1280x800 and 1920x1080: renders per
second unchanged while recording, file length within 0.2 s of the take, stereo
sound within 0.1 s of the picture, and a sync median of 7-25 ms across runs.

The spike that produced the measurements below is the patch committed in
`c7a126b`, a diff against `1e4dd29`:
`git show c7a126b:agent-docs/handoffs/record-clip-audio.spike.patch`.

## Still open

In the order they matter:

1. **Chrome, on the MacBook.** This box's Chrome has no WebGPU.
   - AAC takes probably start 21-48 ms late. `recordAudio.ts` ignores the
     encoder's priming, and `mp4.ts` writes an edit list for the picture only.
     Only Chrome encodes AAC. Opus carries its pre-skip in `dOps`.
   - Measure what `outputLatency` returns and whether it moves the sync median.
   - `rectakecheck.mjs` launches Firefox only, so it needs a Chrome arm first.
2. **Editors and players on a take with held frames.** A live take holds a frame
   as one longer sample on the 1/60 s grid (ADR 0013). Import one into Resolve
   and Premiere, and open it in Photos and QuickTime: holds should keep their
   length, sound should stay in sync, and nothing should resample the file.
3. **A recording-size setting.** Takes record at full size, the default the
   owner chose. The setting goes in the Advanced dialog beside render scale and
   frame lock. Smaller sizes (1080p, 720p) encode faster: at a full window
   Firefox encodes about 34 fps at full size and 49 fps at 720p. `FrameRead`
   already scales a resized window into the take's size, which is the pass a
   smaller size would reuse.
4. **The camera page** still reads its canvas per frame: `cam/useShutter.ts`
   passes no `engine` to `useCapture`. ADR 0013 names moving it onto the
   engine's frame sink.
5. **Bluetooth output.** A large `outputLatency` should subtract cleanly.
   `rectakecheck.mjs`'s sync clip measures it.

## Measurements

All numbers come from Firefox Nightly on the dev box: a 1920x1080 panel at 47.89
Hz, so rAF runs near 48 Hz. A full window gives a 1494x933 canvas.

| What                                                                       | Number                                                             | Script                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `new VideoFrame(canvas)`, 1494x933                                         | 16-22 ms of main thread per frame                                  | `spike-readback.mjs`                                                      |
| `new VideoFrame(canvas)`, 480x488                                          | 3-5 ms                                                             | `spike-readback.mjs`                                                      |
| `copyTextureToBuffer` + `mapAsync`, 1494x933                               | ~0 ms to submit, ~3 ms when the map lands 10-25 ms later           | `spike-readback.mjs`, `spike-take.mjs`                                    |
| Live rate while recording, today's main-app path on `be1d298`, full window | 48.1 Hz falls to 40.5 Hz; `frame()` blocks 16 ms median            | in-page loop over `record.ts`                                             |
| The camera page's clocked catch-up loop, full window                       | 45 Hz falls to 25.6 Hz: each repeated frame reads the canvas again | `spike-take.mjs --silent` (the spike routed silent takes through `clock`) |
| Live rate while recording, spike path, full window                         | unchanged, ~47 Hz                                                  | `spike-take.mjs`                                                          |
| H.264 encode, `quality`, 1494x932 / 1280x720 / 754x480                     | 34.5 / 49 / 69.5 fps                                               | `spike-encoder.mjs`                                                       |
| H.264 encode, `realtime`, same sizes                                       | 11.2 / 15.7 / 36.6 fps                                             | `spike-encoder.mjs`                                                       |
| `currentTime` refreshes on the main thread                                 | 74 per second, stale by 7.7 ms median, 33 ms p99, 56 ms max        | `spike-take.mjs` clock probe                                              |
| A/V offset per flash, any sane clock                                       | median within ±25 ms of zero, p10-p90 spread ~40 ms                | `spike-take.mjs` + `spike-avsync.mjs`                                     |
| Drift over a 5-minute take                                                 | none: +16.2 ms median in the first and last quarter                | `spike-take.mjs --secs=300`                                               |
| 5-minute full-window take                                                  | 605 MB, file ready 1.6 s after stop                                | same                                                                      |
| 150 ms main-thread stall every 2 s                                         | sound continuous, sync holds, frames held across each stall        | `spike-take.mjs --hitch=150`                                              |

The canvas readback is the cost that matters. Audio costs nothing measurable:
the worklet posts about 23 blocks a second, and encoding them takes
microseconds.

The A/V spread comes from the source. The engine samples the `<video>` element
at render time, and the frame lock often renders every second refresh, so a
flash reaches the picture anywhere in a window of roughly two frames. The viewer
sees the same spread live. Every clock tried kept the median well inside
lip-sync tolerance (the EBU recommends at most 40 ms of audio lead).

The encoder caps a full-window take near 34 fps on this box. Encoding runs off
the main thread (`encode()` returns in ~0 ms), so the cap costs frames in the
file and nothing in the live picture.

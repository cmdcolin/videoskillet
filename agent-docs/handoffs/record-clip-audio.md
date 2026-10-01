# Handoff: record the clip's sound with a main-app take

Written 2026-09-30, after two design reviews and a spike in Firefox Nightly on
the Linux dev box. A user asked for recordings to carry the audio of the video
they were playing with. The owner asked for the feature to work and to be
extremely fast.

## Status

Nothing has landed. The spike lives in two places:

- `agent-docs/handoffs/record-clip-audio.spike.patch`, a diff against `1e4dd29`.
  It applies cleanly there and nowhere later. To run it:
  `git worktree add --detach ../vs-spike 1e4dd29`, then `git apply` the patch
  inside that worktree.
- The local branch `spike/record-clip-audio` on the Linux box holds the same two
  commits.

The spike is throwaway. `src/app.tsx` reads the URL switches `rectake`,
`recclock`, `recpool` and `recq` and puts `__audio`, `__capture`, `__rec` and
`__take` on `window` for the harness. `record.ts` logs `SPIKE` lines.

Two commits landed on `main` during the spike and overlap it. `a90ecfb` gives
the recorder `busy()`/`hold()`, a `MAX_QUEUE` of 3 and per-sample `frames`
durations in the muxer. `be1d298` adds take logging (`takeLog.ts`). The real
implementation starts from `main` and reuses both.

## What the main app records today

`src/app.tsx` calls `useCapture` with no `audio`, so every main-app take is
silent. The camera page passes `audioState.tap()`, which carries the microphone
only. `AudioState.tap()` exposes `input` (mic, screen share, picked file). A
clip's sound travels through `routeMedia` into `dry`, the reverb send and the
analyser, so no tap reaches it. `BuzzOut` and a picked file connect straight to
`ctx.destination`.

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

## Bugs in the shipping recorder

These exist on `main` today, independent of sound.

1. **Firefox's H.264 encoder emits B-frames, and the muxer writes no `ctts`.** A
   silent take from today's path decodes in the presentation order 1, 4, 3, 5,
   2, …, so players can show frames out of order. `mp4.ts`'s header says
   B-frames "don't apply here", and in Firefox they do, in both latency modes.
   The spike fixes it with a presentation time per sample (from
   `chunk.timestamp`), a `ctts` box and an edit list. `a90ecfb`'s per-sample
   `frames` counts holds in decode order, so it lengthens the wrong frame once
   B-frames reorder.
2. **Main-app takes play fast.** The rAF path stamps each recorded tick at 1/60
   s and skips ticks while the encoder is busy. On this 48 Hz panel at a full
   window, 10.03 s of recording made a 6.3 s file, which plays at 1.6x.
3. **`finish` copies the file about five times.** `writeMp4` joins everything,
   then `record.ts` copies into a fresh `ArrayBuffer`. The spike's `mp4Parts`
   hands the Blob the parts and drops the copies.
4. **Box sizes and `stco` are 32-bit**, so a file over 4 GiB comes out silently
   corrupt. That is roughly four minutes at a retina canvas and 0008's measured
   143 Mbps. Nothing guards it yet.
5. **AAC takes start 21-48 ms late.** `recordAudio.ts` ignores the encoder's
   priming and the muxer writes no edit list for the sound track. Opus carries
   its pre-skip in `dOps`. Only Chrome encodes AAC, so this is untested.

## Recommended design

1. **A bus for what the speakers play.** `ensureGraph` builds a `bus` gain into
   `ctx.destination`. `dry`, `wet`, the picked-file source and `BuzzOut`
   (constructor takes the output node) connect to it. The spike does this in
   `audiostate.ts` and `buzz.ts`.
2. **`heard()` beside `tap()`.** Both come from one `tapOf(node)`. The camera
   page keeps `tap()`.
3. **A stereo tap stamped with context frames.** The worklet takes
   `processorOptions.channels`, posts planar blocks in one transfer and stamps
   each with the `currentFrame` of its first sample. The main thread trims
   everything before the take's origin. The `go` message goes away.
4. **Frames from the engine after it renders.** `Engine.setFrameSink`
   reconfigures the canvas with `COPY_SRC` and copies each rendered frame into a
   pool of mappable buffers in the same submit (`frameread.ts`, modelled on
   `buzzread.ts`). A landed map becomes a `VideoFrame`. The sink sees only
   frames `renderFrame` produced. A held present or a frame-lock skip sends
   nothing. Use this path for silent takes too: it takes the 16 ms readback off
   every recorded frame.
5. **Time frames on the sound's clock, snapped to the 1/60 s grid.** Map a
   frame's render time onto the audio clock with a 1-second windowed mean of
   `currentTime * 1000 - performance.now()`, sampled every 2 ms. Subtract
   `outputLatency + baseLatency`, and warm the window for 300 ms before the
   first frame fixes the origin. The spike's per-frame `currentTime` read put
   frames up to a slot off. The windowed mean lands every frame within ±0.5
   slot, which is rounding. `getOutputTimestamp` spread its pairs over 62 ms in
   Firefox, so the spike dropped it. A frame whose slot is taken, or that
   arrives while the encoder is `busy()`, is dropped, and its predecessor stays
   up.
6. **Every live take runs on the wall clock.** A silent take snaps frames to the
   same grid from `performance.now()`, since it has no audio clock to follow,
   and holds frames the same way. The file then lasts as long as the take did,
   and turning sound on does not change its speed. This reverses `record.ts`'s
   count-based timing for live takes; see _Why live takes leave strict constant
   framerate_ below.
7. **Mux from presentation times.** Each sample carries its pts in frames; the
   muxer sorts them for decode times, writes `ctts` when any offset is nonzero,
   and adds an edit list for the reorder delay. A held frame is then whatever
   gap its pts leaves, which supersedes `frames`. Build the Blob from parts. Add
   an edit list for AAC priming once Chrome can test it.
8. **Recording size is a setting, and full size is the default.** The owner
   chose maximum quality: a take is worth keeping for its fine detail. The
   setting goes in the Advanced dialog beside render scale and frame lock, which
   trade picture against cadence the same way. Full records the canvas as it is
   when the take starts. Smaller sizes (1080p, 720p) render the present pass a
   second time into a fixed-size texture for the recorder, which encodes faster:
   on the dev box at a full window, Firefox encodes about 34 fps at full size
   and 49 fps at 720p. A full-size take holds a frame wherever the encoder falls
   behind, so the file stays in step with the sound at a lower frame rate. A
   fixed-size texture also survives a resize mid-take, which the full-size path
   has to handle separately.
9. **Guard the 4 GiB limit**, by stopping the take or by writing `co64` and
   `largesize`.
10. **Harness.** `reccheck.mjs` gains an arm with sound that asserts both
    tracks, monotonic pts and the A/V median from `spike-avsync.mjs`. Its
    `r_frame_rate == avg_frame_rate` assertion becomes "every pts lies on the
    1/60 s grid", which a take with held frames still meets.

## Why live takes leave strict constant framerate

`record.ts` stamps frames by count because `MediaRecorder`'s wall-clock
timestamps made files an editor conforms unevenly, which ruins a piece cut to
music. That argument still holds for arbitrary timestamps. A wall-clock take
snapped to the 1/60 s grid keeps every frame on a frame boundary and differs
only where a frame is held, as a longer sample. `a90ecfb` already writes camera
takes this way.

Writing a held frame as repeated samples would keep the file strictly
constant-framerate, and `scripts/repeatcost.mjs` measured what that costs. A run
of repeats is nearly free, but a repeat between fresh frames costs the encoder
about two thirds of a fresh one, because its B-frames code the repeat against
neighbours it does not match. At a full window (1494x932) that cuts a take from
31.4 fresh frames a second to 19.2.

Frame-exact, strictly constant output is the offline render's job (`render.ts`),
which steps the engine at a full 60 fps and drops nothing. So the live recorder
offers one timing, the wall clock, and there is no setting for count-based
takes. The owner left this call to the spike on 2026-09-30, and the repeat
measurement made it.

The assumption still to check is that editors treat an on-grid held frame as one
frame shown for longer. Import a take with holds into Resolve and Premiere, and
open it in Photos and QuickTime: holds should keep their length, sound should
stay in sync, and nothing should resample the file.

## Still untested

- **Editors and players on a take with held frames.** See the end of the section
  above.
- **Chrome.** This box's Chrome has no WebGPU. On the MacBook, check AAC
  priming, whether `new VideoFrame(canvas)` is cheap there, what
  `getOutputTimestamp` and `outputLatency` return, and the A/V median.
  `spike-take.mjs --browser=chrome` launches Chrome with WebGPU and autoplay
  switched on, and has never run.
- **Bluetooth output.** A large `outputLatency` should still subtract cleanly.
  Measure it with the sync clip.
- **A canvas resize mid-take.** `FrameRead.copy` skips frames of the wrong size,
  so going fullscreen during a take freezes the picture. The real implementation
  needs a fixed-size target or a rebuilt pool.
- **Device loss and HMR during a take.** The engine handoff does not carry a
  frame sink across.

## Running the spike

On a checkout of `1e4dd29` with the patch applied:

```
pnpm install
sh scripts/spike-syncclip.sh                  # public/spike/sync.mp4, needs ffmpeg
node_modules/.bin/vite --config vite.spike.config.ts   # port 5311, own cacheDir
node scripts/spike-take.mjs --secs=20 --clock=smooth --q=4 | python3 scripts/spike-sum.py run1
```

`spike-take.mjs` turns on the clip's sound through the audio picker, presses
record through the app's own hook, and POSTs the finished file to a server on
port 5399. Then it runs `spike-avsync.mjs` on the file. `spike-sum.py` prints
one line for the take and one for the sync. In the sync line, `MID` is the
per-flash offset in milliseconds (positive means the click comes after the
flash) and `q1/q4` compares the first and last quarter for drift.

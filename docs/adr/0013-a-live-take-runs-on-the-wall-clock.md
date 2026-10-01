# 0013 — A live take runs on the wall clock, and its frames come off the GPU

**Status:** accepted, 2026-09-30.

## Context

`ui/record.ts` stamped every frame by count, `i * 1e6 / fps`, because
`MediaRecorder`'s wall-clock timestamps gave files an editor conforms unevenly.
That holds for the offline render (`ui/render.ts`), which steps the engine and
drops nothing. The main app's live recorder used the same stamping, fed one
frame per rAF, and three things went wrong with it. All were measured in Firefox
Nightly on a 47.89 Hz panel; `agent-docs/handoffs/record-clip-audio.md` has the
runs.

**A live take played fast.** The engine renders below 60 Hz whenever the display
or the frame lock says so, and every render counted as 1/60 s. A 10.03 s take at
a full window came back as a 6.3 s file, playing at 1.6x, with the clip in it at
1.6x too.

**Sound cannot follow count-stamped picture.** A take that carries what the
speakers play has to keep real time, because sound cannot be stretched to match
a picture that was.

**Reading the canvas blocked the page.** `new VideoFrame(webgpuCanvas)` costs
Firefox 16-22 ms of main thread per frame at a 1494x933 canvas, and recording
took the page from 48.1 Hz to 40.5 Hz.

A held frame can be written as one longer sample or as repeated samples.
Repeated samples keep the file strictly constant-framerate, and
`scripts/repeatcost.mjs` measured what they cost: between fresh frames a repeat
costs the encoder about two thirds of a fresh one, because Firefox's B-frames
code it against neighbours it does not match. At a full window that cuts 31.4
fresh frames a second to 19.2.

## Decision

A live take places each frame the engine renders by when it was rendered, on the
take's clock, snapped to the 1/60 s grid. With sound, the clock is the audio
context's, averaged against `currentTime`, which the main thread sees refreshed
74 times a second and up to 56 ms stale, and moved back by the output latency
(`ui/takeClock.ts`). Without sound it is `performance.now()`. A frame whose
period is taken, or that finds the encoder three behind, is dropped, and the
frame before it stays up as a longer sample.

The engine copies each rendered frame into a pool of mappable buffers inside the
frame's own submit (`core/gpu/frameread.ts`). The map lands 10-25 ms later, and
building the `VideoFrame` then costs about 3 ms at that size. A window resized
mid-take is scaled into the take's size on the GPU.

The muxer writes from presentation times, with `ctts` and an edit list for the
B-frames Firefox's encoder emits.

The offline render keeps count stamping and strict constant framerate. It is
where a frame-exact file comes from.

## Consequences

- A live take is constant-framerate only where no frame was held. Every frame
  still lies on the 1/60 s grid. `scripts/reccheck.mjs` asserts strict CFR for
  the count path, and `scripts/rectakecheck.mjs` asserts the grid for a live
  take.
- Whether Resolve, Premiere, Photos and QuickTime keep a held frame's length is
  unmeasured. If one resamples, revisit holds before reverting to count
  stamping.
- A take with sound starts about 0.2 s after the click: the audio encoder's
  setup and 100 ms of clock readings come first.
- Forbidden: stamping a live take by count, writing a held frame as repeated
  samples, and reading the canvas synchronously per frame on the live path.
- The camera page still pumps frames from rAF and reads the canvas per frame.
  Moving it onto the engine's frame sink would take the same readback cost off a
  phone, and is unmeasured there.

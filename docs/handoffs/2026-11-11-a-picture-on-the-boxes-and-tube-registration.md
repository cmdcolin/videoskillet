# A picture on A's boxes, and tube registration in the loop camera

**2026-11-11.** The starting question was a review of the app for new effects,
with cooler visuals weighted a little above physical realism. Colin picked two
of the six proposals, and both landed in `b6153b23`. This note records what was
checked, what was not checked, and the four proposals that were left.

## What landed

- **`synthCvSrc`** (`those boxes, driven by`) patches a picture into the control
  input of the delay line, the level control and the sync pull on input A's
  cable. The choices are the synth, picture A and picture B. `pictureCv` in
  `feed.wgsl` reads sixteen taps two samples apart and clamps at black, so sync
  and burst read as zero volts.
- **`fbRegShiftPx` and `fbRegSizePct`** (`tube centring`, `tube size`) are the
  registration errors of a three-tube camera. `camTubes` in `compose.wgsl` reads
  red and blue either side of green's position, which costs 21 lens taps in
  place of 7 while either control is off zero.
- **The B gates split.** A's feed reads B's waveform when the control input is
  on picture B, and B's fader may be closed at the time. `bChainOn` now
  dispatches B's encoders for the mixer or for A's boxes, and `bOn` gates `mixB`
  alone. `feedgates.spec.ts` holds the new containment, and
  `scripts/gpuprof/graph.ts` carries the same change.
- **Feed binding 5** is the other input's waveform. `feedA` is handed
  `bCompBuf`, which holds B as it stood a frame ago. `feedB` is handed `compA`
  and reads none of it, because `bCompBuf` is its own destination and a bind
  group cannot hold one buffer as both.

## What was checked

Everything was rendered headless with `scripts/gpuprof/sheet.ts candidates` on
the detail chart, with the gradient chart as source B. No frame came from a
browser, and no frame came from real footage.

- Picture A at 3 µs drew hue contour bands across the shaded sphere, and the
  line start held.
- Picture B at 2 µs turned A's hue along B's gradient with `bGain` at 0, which
  confirms the gate split dispatches B's chain.
- Picture B on the level control at 0.8 dimmed A inside B's ellipse.
- Tube centring at 0.6 px in a loop at `fbMix` 0.75 was barely visible. At
  `fbMix` 0.9, `fbGain` 1.08, `fbZoom` 1.004 and `fbFocus` 0, 2 px of centring
  turned the chart's grey bars into spectrum bands, and 1% of size gave warm and
  cool rims that widen toward the corners.

The candidate files and sheets were in a session scratchpad and are gone. Each
candidate was a one-line patch of the values above.

## Next steps

- **Screen both on a moving portrait in Firefox Nightly.** The chart cannot show
  whether a face reads through the contour bands, or whether the registration
  fan looks like a camera fault on real motion. Use a detached worktree with its
  own vite server, and announce the run, because a headed Firefox covers Colin's
  screen.
- **Check picture B with a video source in the app.** The headless graph uploads
  B every frame. In the app, confirm a clip or a webcam on B keeps updating
  while `bGain` is 0 and the control input is on picture B.
- **Author presets.** No preset uses any of the three controls, so no roll and
  no chip reaches them. Build layered looks: picture A on the delay line at 0.5
  to 3 µs over a subtle camera loop, picture B driving the delay with B faded
  down, and tube centring under a tenth of a degree of turn at a high mix.
  Follow `CURATION.md` › _A camera loop at unity zoom wants a gain of about one_
  for the loop's gain.
- **Decide where the selector row lives.** The three boxes sit in the Video
  synth group, which the generator gate hides until the synth or one of the
  boxes is running. With a picture on the control input the synth is no longer
  involved, so the rows are reachable only through search until a preset raises
  one. Moving the four rows to Feed A's cable group would fix that, and it would
  change the chain map and `schematicKeys.ts`.
- **Consider a vertical centring control.** `tube centring` is horizontal only.
  A real camera has a vertical pot per tube as well. Add it if the screening
  shows the horizontal fan reads as axis-aligned.
- **Profile the two paths.** `pictureCv` adds sixteen buffer reads per sample of
  A's feed, and `camTubes` triples the camera's lens taps. Neither was timed
  with `pnpm gpuprof`.

## Proposals not taken

These came out of the same review and were not built. Move them to `IDEAS.md` if
this note is retired.

- **Lens barrel distortion on the loop camera.** A radial term on the zoom makes
  the centre expand while the edges contract, which gives an expanding loop a
  ring where the round trip is unity.
- **Tube camera on source A.** `tubeRead` acts on the loop return alone. Pointed
  at source A it would give a webcam orange lag and comet tails with no loop.
- **Hand-held camera on the loop.** One control that wanders shift, rotate and
  zoom by sub-percent amounts from `signal/noise.ts`, so a near-unity loop over
  a still keeps moving.
- **The picture as a modulation source.** `buzz_tap` already reads each line's
  mean level back to the CPU, so average picture level and frame-to-frame change
  could drive any control in the bay.

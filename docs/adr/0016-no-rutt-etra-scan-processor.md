# 0016 — No Rutt/Etra scan processor

## Status

Accepted.

## Context

`IDEAS.md` listed a Rutt/Etra scan processor under "Boxes in the rack": the
picture's own level patched into the vertical deflection amplifier, so the
raster becomes a relief map of the picture. It fits the deflection domain, and
the idea noted that it needs a per-pixel vertical gather in `crt_face` over the
decoded image, since `decode` stages one tile per row.

A spike built it that way (`76ba28e9`, "spike a scan processor that patches
picture level into vertical deflection"). It adds three controls: `scanDepth`
(how far full white lifts a line, as a fraction of picture height), `scanSkip`
(draw every Nth line) and `scanBand` (the horizontal width the deflection signal
is averaged over). For each output pixel, `scanTrace` in `crt_face.wgsl` walks
the nearby source rows, displaces each one by its luma, and spreads the beam's
light over the vertical distance the trace covers, so steep slopes come out dim.
The spike has no panel rows, presets or schematic.

It was rendered headless with `scripts/render` in two rounds:

- **2026-11-01**, on carnival, holi and close-ups from _Night of the Living
  Dead_ (1968), alone, with noise into the deflection, under `wornTape`, and
  inside the camera loop.
- **2026-11-02**, on four public-domain still portraits (Einstein, Kahlo,
  Jemison, Ride) with a slow push-in so the relief moves, at `scanDepth` 0.2 and
  `scanSkip` 4. Each portrait was rendered alone and layered with
  `subcarrierComb`, a bowed scan (`bendUs` 10), a 3 µs multipath ghost, loop
  trails, mains hum and `scrambledChannel`. The subcarrier comb was the best of
  these: it smooths the luma, so the ridges come out as clean contours, and it
  steps the hue between generations. Ghost-plus-comb ran away to a flat grey
  slab, and the ripple bend, `ignitionStorm` and the camera loop shredded the
  face.

The verdict on the second round was that it "looks a bit too digital". Every
trace is a line of the same width (`crtSpot`) at the same spacing (`scanSkip`),
and the layered effects change what the traces carry but leave the traces
themselves alone.

## Decision

Do not merge the scan processor. The spike stays at `76ba28e9` in the
`.claude/worktrees/dark-effects` worktree, on top of the dark-effects batch that
was moved off main in `08fdb0d1`. The entry is removed from `IDEAS.md`.

## Consequences

- Main has no `scanDepth`, `scanSkip` or `scanBand`, and `crt_face` keeps its
  current structure.
- Re-proposing the effect needs a different model of the beam, one where the
  trace's width, brightness or spacing comes from the signal, judged on still
  portraits against the 2026-11-02 renders. Layering more of the existing
  effects on top of the same traces was tried and did not change the verdict.
- The spike commit is reachable only through that worktree's detached HEAD.
  Removing the worktree lets `git gc` collect it, so this record is what
  remains.

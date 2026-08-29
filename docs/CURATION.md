# Curating the presets and the control table

A working record, not a conclusion. The question behind it: the preset table has
grown to 85 entries and the roll draws from all of them, so a preset that is not
worth clicking is also a preset dragging every `surprise` toward mush. Same
question one level down for the 215 controls — which of them are looks, and
which are trims that belong behind `fine: true`.

Measured with `scripts/gpuprof/survey.ts`, which runs the real pass graph
headless in Deno and reads pixels back. No browser, so it costs minutes and
nobody's screen.

```
deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/survey.ts \
  presets --source=detail
  sliders --base=vhs
```

## Read the columns together or not at all

- **dep** — mean channel departure from the reference, 0-255. How much of the
  picture moved.
- **p99** — the departure of the worst 1% of the frame. `fmOverdev` is dep 1.55
  and p99 71: faint over the picture, savage on a few hundred pixels. A mean
  alone calls every edge fault nothing.
- **motion** — difference between the last two frames. `trackingBand` is dep 20
  and motion 28; the number that says it is worth having is the second one.
- **mean/sd** — luma level and spread, which is how an arm that "departed" by
  collapsing to black gets caught. `chromaOnly` departs by 101 and is a black
  frame: mean 0.0, sd 0.0.

**Departure is not quality.** It says a patch went somewhere, never that
somewhere is worth going. Every list below is a shortlist to look at, not a
verdict.

## What the harness cannot see, and who that is unfair to

Four blind spots, each of which makes a real preset score like a dead one:

- **A trigger nobody pulls.** `punchIn` rests just short of trouble and is
  supposed to sit still until you hit ⚡. It scores dep 4.3 because the harness
  never fires it. Anything with a `trig` routing is exempt from the low-dep
  list by construction.
- **A still source.** The three feedback loops eat their own output, so over a
  frozen frame they converge and stop. What they do to *moving* picture is the
  whole point of them and is not in these numbers.
- **A source with no detail.** SMPTE bars are flat fields, so the entire
  tape-wear family — soft luma, chroma noise, dropouts — moves them by almost
  nothing. `--source=detail` swaps in a multiburst, text-scale structure and a
  lit sphere, and the tape looks move on it. Run both.
- **Modulation.** The bay is a UI-layer thing; the graph here never sees it.

## Presets that barely leave clean

From `survey presets --frames=200` on bars, lowest first, trigger-driven
entries removed. Everything else in the table scores dep > 15.

| preset | group | dep | p99 | motion |
| --- | --- | ---: | ---: | ---: |
| fmFold | Tape wear | 2.95 | 22.9 | 1.79 |
| vhs | Tape wear | 4.17 | 32.3 | 2.79 |
| tapeCapture | Tape wear | 8.68 | 33.8 | 6.91 |
| adjacentChannel | RF / Broadcast | 8.87 | 64.8 | 1.99 |
| stickyShed | Tape wear | 9.52 | 62.9 | 6.93 |
| colourLate | Tape wear | 12.50 | 156.9 | 1.96 |
| broadcast | RF / Broadcast | 12.53 | 36.9 | 0.86 |
| cbBreakthrough | RF / Broadcast | 12.81 | 76.4 | 4.54 |
| mixerLoop | Feedback loops | 12.86 | 83.3 | 3.55 |

Two of those are not candidates. `broadcast` is a near-clean baseline on
purpose, and `mixerLoop` is the README's hero shot — it scores low because a
loop over a frozen frame converges, which is the still-source blind spot above,
not the preset. The tape-wear cluster needs re-reading on `--source=detail`
before anyone judges it; that run was still going when this was written.

`colourLate` is the interesting row: dep 12 with p99 157 says it does something
violent to a narrow part of the picture and nothing to the rest.

## Presets that depart into nothing

Caught by mean/sd rather than by dep — these leave clean decisively and arrive
at a blank frame:

| preset | dep | mean | sd | what it renders |
| --- | ---: | ---: | ---: | --- |
| chromaOnly | 101.1 | 0.0 | 0.0 | pure black |
| reversePolarity | 100.8 | 1.1 | 5.5 | all but black |

`chromaOnly` promises "burst-locked color glowing on black" and renders black
with no colour in it at all. `reversePolarity` sits next to `negative`, which
inverts properly (mean 170). Both want a look before they want removing: a
preset that renders black is as likely to be a bug in the path it turns on as it
is a bad idea.

## Near-duplicates

Control-space distance (`scripts/gpuprof/list.ts`), normalized per slider
travel. Closest pairs:

| pair | distance |
| --- | ---: |
| vhs / pictureSearch | 0.076 |
| dirtyMix / dirtyDissolve | 0.090 |
| strobeTrails / ladderClimb | 0.123 |
| fbBloom / woundSpiral | 0.133 |
| neonTube / blackRestore | 0.139 |

`keyLoop` and `shadowLadder` move the same five controls exactly (Jaccard 1.00)
at different values, and render 3 dep apart. Distance in control space
under-weights a slider with a huge range, so treat this as a list of pairs to
look at side by side, not as a similarity score to sort by.

## The control table

`fmOverdev` — the question that started this — measures dep 1.55, p99 71.2 at
full travel on bars, which puts its mean departure below `lumaMHz` and its 99th
percentile above most of the table. Looking at the frame says the same thing:
at maximum it is a hairline of noisy black on the leading edge of a bright bar,
a few pixels wide. The help text promises "a black comet" that "smears rightward
for about a microsecond" and the streak's decay is ~10 samples, so the mechanism
is doing roughly what it says — it is the *scale* the prose oversells, not the
direction.

So it is a trim, and it is not flagged as one. Two ways to go, and they are
different products:

- mark it `fine: true` and pull the prose back to what a few pixels of edge
  fringe is, or
- give the fold enough travel to earn the description — the ceiling only slides
  to 112 IRE at full knob, and nothing lets it go under sustained white.

The full `sliders` sweep with p99 was still running when this was written; the
run before it (dep only) put 40-odd controls under dep 2 from stock, almost all
of them dependency-gated rather than weak — nothing in the camera loop moves
until `fbGain` is up, and `fmStreakUs` cannot smear a fold `fmOverdev` is not
making. That is what `--base=` is for, and the gated ones need re-running from a
base that opens their path before any of them is called a trim.

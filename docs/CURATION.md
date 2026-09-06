# Curating looks

Which looks are worth keeping, and how anyone knows. The preset table grew to 85
entries and the roll draws from all of them, so a preset that is not worth
clicking is also a preset dragging every `surprise` toward mush. Same question
one level down for the 215 controls — which are looks, and which are trims that
belong behind `fine: true`.

Most of this is a working record rather than a conclusion. The screening
harness, its blind spots, what the surveys found and what the eye said are the
live half. A labelling system was also built to answer the same question with a
model; it has barely been used, and the last section is what it would take to
pick that up.

## Measuring: the survey harness

`scripts/gpuprof/survey.ts` runs the real pass graph headless in Deno and reads
pixels back. No browser, so it costs minutes and nobody's screen.

```
deno run -A --config scripts/gpuprof/deno.json scripts/gpuprof/survey.ts \
  presets --source=detail
  sliders --base=vhs
```

### Read the columns together or not at all

- **dep** — mean channel departure from the reference, 0-255. How much of the
  picture moved.
- **p99** — the departure of the worst 1% of the frame. `fmOverdev` is dep 1.55
  and p99 71: faint over the picture, savage on a few hundred pixels. A mean
  alone calls every edge fault nothing.
- **motion** — difference between the last two frames. `trackingBand` is dep 20
  and motion 28; the number that says it is worth having is the second one.
- **mean/sd** — luma level and spread, which catches an arm that "departed" by
  collapsing to black. `chromaOnly` departs by 101 and is a black frame: mean
  0.0, sd 0.0.

**Departure is not quality.** It says a patch went somewhere, never that
somewhere is worth going. Every list below is a shortlist to look at.

### What the harness cannot see, and who that is unfair to

Four blind spots, each of which makes a real preset score like a dead one:

- **A trigger nobody pulls.** `punchIn` rests just short of trouble and is
  supposed to sit still until you hit ⚡. It scores dep 4.3 because the harness
  never fires it. Anything with a `trig` routing is exempt from the low-dep list
  by construction.
- **A still source.** The feedback loops eat their own output, so over a frozen
  frame they converge and stop. What they do to _moving_ picture is the whole
  point of them and is not in these numbers.
- **A source with no detail.** SMPTE bars are flat fields, so the entire
  tape-wear family — soft luma, chroma noise, dropouts — moves them by almost
  nothing. `--source=detail` swaps in a multiburst, text-scale structure and a
  lit sphere. Run both.
- **Modulation.** The bay is a UI-layer thing; the graph never sees it unless
  driven — see _The routings were never applied_ below.

## What the surveys found

### Presets that barely leave clean

`survey presets --frames=200`, run twice — once on flat bars, once on
`--source=detail`. A preset is only weak if it is weak on both; anything that
moves one and not the other is telling you which kind of picture it needs.

| preset          | group          | dep bars | dep detail | p99 detail | motion |
| --------------- | -------------- | -------: | ---------: | ---------: | -----: |
| vhs             | Tape wear      |      4.2 |        2.0 |       10.1 |    2.5 |
| punchIn         | Circuit bent   |      4.3 |        3.1 |       11.0 |    1.0 |
| fmFold          | Tape wear      |      3.0 |        7.0 |       60.3 |    2.2 |
| adjacentChannel | RF / Broadcast |      8.9 |        3.4 |       13.3 |    1.9 |
| stickyShed      | Tape wear      |      9.5 |        4.5 |       18.0 |    6.3 |
| tapeCapture     | Tape wear      |      8.7 |        6.8 |       27.5 |    8.1 |

Those six are the whole of it: every other preset clears dep 12 on at least one
of the two sources. Four sit just over the line on bars alone and are worth a
second look — `tiredAmplifier` (16.7 / 4.1), `cbBreakthrough` (12.8 / 6.4),
`colourLate` (12.5 / 9.1) and `broadcast` (12.5 / 11.2).

Not all are candidates. `punchIn` is designed to sit still until you hit ⚡ and
the harness never fires it. `broadcast` is a near-clean baseline on purpose.
`mixerLoop` (8.4 on detail) is not in the list but would be on a third source:
it is the README's hero shot, and it scores low only because a loop over a
frozen frame converges.

What is left is one cluster: **the quiet end of Tape wear**. Four of the twelve
entries in that family — `vhs` itself among them — move the picture less than
anything else in the table.

`fmFold` and `colourLate` are the two to look at rather than cut. Both carry a
p99 far above their dep: they do something violent to a narrow part of the
picture and nothing to the rest, which is the signature of an effect that works
and is scoped too small.

One caution on the detail source: the clean NTSC path already turns its
multiburst and text bands to cross-colour mush, so a preset whose whole job is
softening has less left to soften. Two disagreeing sources are a reason to look
at the frame.

### Presets that depart into nothing

Caught by mean/sd rather than by dep — these leave clean decisively and arrive
at a blank frame:

| preset          |  dep | mean |  sd | what it renders |
| --------------- | ---: | ---: | --: | --------------- |
| chromaOnly      | 98.9 |  0.1 | 0.3 | pure black      |
| reversePolarity | 98.0 |  1.1 | 5.5 | all but black   |

Both render black on bars _and_ on the detail chart, so it is not the source.
`chromaOnly` promises "burst-locked color glowing on black" and renders black
with no colour in it. `reversePolarity` sits next to `negative`, which inverts
properly (mean 170). Both wanted a look before they wanted removing: a preset
that renders black is as likely to be a bug in the path it turns on as a bad
idea. (`reversePolarity` was the bug —
[ADR 0009](adr/0009-the-receiver-finds-its-own-black.md) is the fix, and
`signalAndGroundSwapped` is the look that came out of it.)

### Near-duplicates

Control-space distance (`scripts/gpuprof/list.ts`), normalized per slider
travel. Closest pairs:

| pair                       | distance |
| -------------------------- | -------: |
| vhs / pictureSearch        |    0.076 |
| dirtyMix / dirtyDissolve   |    0.090 |
| strobeTrails / ladderClimb |    0.123 |
| fbBloom / woundSpiral      |    0.133 |
| neonTube / blackRestore    |    0.139 |

`keyLoop` and `shadowLadder` move the same five controls exactly (Jaccard 1.00)
at different values, and render 3 dep apart. Distance in control space
under-weights a slider with a huge range, so treat this as pairs to look at side
by side rather than a similarity score to sort by.

### The control table

`fmOverdev` — the question that started this — measures dep 1.55, p99 71.2 at
full travel on bars, which puts its mean departure below `lumaMHz` and its 99th
percentile above most of the table. The frame says the same: at maximum it is a
hairline of noisy black on the leading edge of a bright bar, a few pixels wide.
The help text promises "a black comet" that "smears rightward for about a
microsecond" and the streak's decay is ~10 samples, so the mechanism does what
it says — the _scale_ is what the prose oversells.

So it is a trim and is not flagged as one. Two ways to go, and they are
different products: mark it `fine: true` and pull the prose back to what a few
pixels of edge fringe is, or give the fold enough travel to earn the description
(the ceiling only slides to 112 IRE at full knob).

A dep-only sweep put 40-odd controls under dep 2 from stock, almost all of them
dependency-gated rather than weak — nothing in the camera loop moves until
`fbGain` is up, and `fmStreakUs` cannot smear a fold `fmOverdev` is not making.
That is what `--base=` is for, and the gated ones need re-running from a base
that opens their path before any of them is called a trim.

## What the eye said that the numbers did not

Screening rounds went in front of Colin as contact sheets, each candidate a
playable strip rather than a still. These verdicts are worth more than the
measurements, because they are the only signal about quality rather than about
movement.

**Round one, the cut list.** Cut outright: `chromaOnly` and `reversePolarity`,
the two that render black, and the quiet end of Tape wear — "many of the vhs
settings are quite similar", "I don't want so many subtle things". Nine presets
went. `vhs` stayed: it is the canonical one, and reading subtle is an argument
for making it less subtle.

Six of fourteen random rolls were rejected as well, and the composition of the
rejects says something the preset table alone does not: **`pastTheYoke` is in
three of the six and in none of the fourteen keepers**, `transmissionFault` in
two. Neither is subtle — they are patches that flatten whatever they are blended
with. That is a roll-blending problem rather than a preset problem, and it is
still open.

One piece closed later from the other end. `pastTheYoke` was the only preset
holding `bendShape` on ripple — a sine down the whole frame at a wavelength
nothing in the picture sets, which reads as a grating laid over the raster
rather than as a scan going wrong. It bows now, and `ROLL_NEVER_LANDS`
(`mutate.ts`) keeps every roll off that shape unless the board is already on it.
What made the blend worse than the preset: `bendShape` is an enum key, so a
follower at weight 0.25 handed the shape over whole while the amplitude around
it scaled down.

The same session turned up the neighbouring one. Every preset using the HV tank
was authored between 0.8 and 0.9 on `hvRing`, and the dial is steep up there:
damping ratio 0.66 at 0.5, where a bright edge overshoots once and settles
within seven lines, against 0.32 at 0.9, where the wobble is still going half a
cycle later and the next line of content kicks it again. Stacked under a roll it
stopped reading as a supply under load and started reading as the picture
sliding about. The four presets carrying it as texture under something else came
down to a light application; the three it is _about_ kept their tuning, and
`ROLL_STAYS_UNDER` holds a roll to 0.6 ring and 12us sag.

**Round two, the loops.** Seven of fourteen feedback candidates kept:
`zoom bloom`, `tunnel out`, `spiral`, `subcarrier comb`, `ring loop`,
`servo warp`, `both loops`. The pattern in what survived is sharper than any
number here produced. **Geometry that accumulates and colour arithmetic were
kept; ringing, blur, texture and stutter were not.** Both keyed resonators went,
and they were the strongest prior going in. `both loops` was kept at dep 26, the
lowest departure in its sheet, while `iris hunt` was cut at 106. Departure did
not order these at all.

So: propose looks that **change where the picture is** (zoom, rotation, timebase
pull) or **what colour it is by arithmetic** (subcarrier delay, ring
modulation). Do not propose looks whose content is texture — a blur, a ring, a
grain, a stutter.

**Round three, the controls nobody had used.** Counting control names across the
table found seventy-five appearing in no preset: the whole chyron and caption
family, the PiP inset, every per-feed cable fault, tint, the hard polarity flip,
Y/C delay, adjacent-channel leak, the raster underscan.
`scripts/candidates.round3.mjs` screened one candidate per family and retuned a
dozen; fourteen shipped, under a new `Switcher` group for the four that are
about a box at the switcher rather than the mixer.

Three things that round established about the harness itself. The scorer was
blind to hue — a tint walked round the whole wheel scored `still` — so it now
carries a colour-motion term beside the luma one. Under Chrome it read a black
canvas at half its checkpoints until it stepped and read in one task. And a
preset that turns on the caption decoder or the chyron does nothing on a bare
board, because the caption is blank until somebody types, so those chips seed
the teletype default when the caption is empty.

One retirement: `dirtyDissolve` was `dirtyMix` with A pulled halfway down, and
`cleanDissolve` already owns the dissolve. `pictureSearch` stays despite the
0.076 distance from `vhs` — the distance under-weights `shuttleX`'s range, and
cueing at 5x is a different mechanism rather than a retune.

## Five findings that generalise

### Ring modulation does not make rainbows

Worth writing down because the name promises otherwise, and because six
candidates were built on the assumption before anything was rendered.

`cfbRing` multiplies the loop bus against the live program. Both signals carry
their subcarrier on the **same crystal**, so the products land at the sum (7.16
MHz, above the chroma passband) and at the difference (DC, which is luma). The
chroma filter discards the first, and the second is brightness. Six candidates
varying the detune, the line offset, the chroma trap, the demodulator axis and
the comb rendered within a point of each other as the same desaturated grey-blue
wash — and pulling the crystal 60 kHz did not change it, because 60 kHz off 3.58
MHz is still DC as far as the passband is concerned.

Three routes do make colour by multiplication, by putting the terms at genuinely
different frequencies so the difference lands back inside the chroma band.
**`bRing` with `bDetuneHz`** — B's subcarrier against A's, kilohertz apart —
gives saturated bands, though at `bGain` 0.55 it renders at mean 209, which is
blown out. **The synth oscillator near 3.58 MHz over the picture** translates
luma up into the chroma band, so brightness arrives as hue; strong, but one hue
at a time. And **`cfbRingSrc`**, which is the finding above turned into a
control: the ring modulator had one input on the loop and the other wired
permanently to the program, and the program is the one signal guaranteed to be
on the same crystal as the return. Put an oscillator on that input, detune it
with `cfbCarrierKHz`, and the bridge is an encoder's chroma modulator — the
return's brightness translates up into the chroma band and its colour translates
down into brightness, so a lap swaps the two.

Measured with `scripts/colourcheck.mjs` on `clip-haunted-house`, a 1929 film, so
a clean arm reads sat 0.018 and any hue on screen was manufactured by the chain:

| arm                |   sat | hues | colour% |
| ------------------ | ----: | ---: | ------: |
| clean              | 0.018 |    0 |     0.0 |
| loop, no ring      | 0.020 |    0 |     0.1 |
| ring on program    | 0.008 |    0 |     0.4 |
| ring on oscillator | 0.265 |    3 |    51.6 |
| oscillator +12kHz  | 0.377 |   10 |    49.7 |
| oscillator +120kHz | 0.282 |   12 |    46.1 |

Against the program the ring mod takes away the little colour the chain had
(0.020 down to 0.008). `sat` and `hues` disagree on which detune is best: on
frequency the invented colour lands on one phase, which is why three sectors
hold it, and the detune is what turns it into a wheel.

**A colour claim measured on a saturated source is not measured.** The same
sheet on `clip-test` puts every one of those arms between 0.29 and 0.39 against
a clean 0.487, so the mechanism that makes colour out of nothing reads as one
that slightly reduces it. This section fell into that trap once already.

### Chaotic is not the same as wild

The correction that cost the most to learn. Three rounds came back "very
subtle", so the next round stacked everything: both ring modulators, both loops
run hard, sync marginal, deflection past the supply. Those scored `motion` 105 —
five times anything kept before — and the verdict was **"too chaotic ... they
need work"**.

What survived instead: `runaway` at motion 33, `sync in the loop` at 14,
`lorenz loop` at 14, `strobe bloom` at 14. Everything at 55 or above was cut. So
the axis is not amount of movement and certainly not entropy: what reads as wild
is **large, coherent structure that evolves** — a loop crossing unity and
bleeding back, a stack of roll seams at different ages, an echo whose spacing
never repeats. High-entropy hash reads as noise however energetic the numbers
say it is.

Read `motion` as a rank within one sheet, never as a threshold. The absolute
figures scale with frame spacing (`--video` reads adjacent frames, a stills
strip reads every fourth) and with the source; what survives re-measurement is
the ordering. And it is measured between _adjacent_ frames, so a slow sweep
reports as motionless: a hue rotation at 0.2 Hz moves 1.2° a frame and scores
under 3 while cycling the whole wheel in five seconds.

### The routings were never applied

The largest correction here, and it invalidates numbers in the tables above
rather than adding to them.

`sheet.ts` grew the ability to drive the modulation bay, and every part of the
plumbing landed except one line: the candidate loader built its items without
copying `mod` off the spec, and its inline cast did not mention the field, so
`tsc` had nothing to object to. The local name for the imported spec module was
`mod`, which is how it went unseen. Presets went the same way, and that is the
more expensive half: 23 of the 84 carry a routing, including every feedback look
in the table above.

`survey.ts` had the same hole and is now wired the same way, which matters more
— it is the script the cut lists were drawn from. Driving the routings moves 21
of the 84 presets:

| preset           | dep resting | dep driven |
| ---------------- | ----------: | ---------: |
| sync in the loop |       22.15 |      67.24 |
| spiral           |       25.47 |      68.24 |
| subcarrier comb  |       13.20 |      43.21 |
| both loops       |       11.03 |      29.05 |

`both loops` at 11.03 sits _below_ the dep 12 line this page uses to call a
preset weak, and `subcarrier comb` at 13.20 sits just over it; both are in the
thirties and forties with the LFO they ship with running. A resting-frame survey
systematically under-reports exactly the family whose movement lives in the
routing, which is the family the last two rounds were curating. `runaway` moves
the other way — its whole description is a gain walked past unity by an LFO, and
driving that LFO drops its motion from 37.7 to 4.9, because the sweep spends
half its time below unity.

The cut list already applied is unaffected: the six presets on it carry no
routing. `--nomod` renders any sheet at its resting frame, which is both the
ablation for "is this the patch or the LFO" and the way to reproduce anything
measured before the fix.

### A routing based at a slider end does nothing

The bay's LFOs are **bipolar**: a routing swings `±depth × travel` around
wherever the control rests. So a control resting at its own minimum loses half
its excursion to the clamp, and a slow routing loses all of it — the triangle is
`1 - 4|ph - 0.5|`, which starts at −1 and takes most of a four-second clip to
climb back to zero.

`synthHueDeg` runs 0–360 and defaults to 0. A candidate routed a 0.06 Hz
triangle onto it at full depth and rendered identically, to two decimal places,
with the routing driven and with it off: the control sat clamped at 0 for 96% of
the run. As shipped the picture held R170 G199 B15 from the first frame to the
last; based at 180 the same patch walks green → cyan → blue. This was previously
written up as a level problem — the field was blown to near-white, and rotating
the hue of near-white does nothing — and that was wrong. The hue was not
rotating at all.

`Runner.run` now warns when a routing spends more than a quarter of the run
against an end, naming the base and the range. It catches `bDetuneHz` based at
1500 in a ±3000 span as well, at 28%. None of the 23 presets trip it.

### The two failures a feedback look actually has

"Not dramatic enough" and "too chaotic" were reported about the same family
within a minute of each other, and they turned out to be one setting apart in
opposite directions with almost nothing in between. Measured with
`scripts/gpuprof/looplock.ts`, which reads the sync separator's own per-line
verdict beside the picture — the number a contact sheet cannot show, because a
frame torn into displaced slabs and a frame full of coherent structure both
score high on departure. Across the 44 looks in the group: 16 had the separator
finding under 30% of lines (`motion` 35–112, raster rolling), 15 had the loop
contributing under 32 (`motion` 5–11, the source slightly soft), 13 sat between.

**The mixer loop crossfaded the sync tip.** `fb_composite` faded the loop return
over every sample of the raster, blanking interval included. So a delay of a
microsecond put the previous frame's sync tip a dozen samples inside the line,
the live tip was faded 85% toward whatever active video the return carried
there, and `sync_measure` stopped finding a falling edge in its hunt window. The
flywheel free-ran, its phase noise grew with the age of the last real edge, and
the structure the loop had spent a second building was thrown across a raster no
longer under it. Nothing about that came from the loop's own settings. The
rack's answer is a frame synchronizer: a store genlocked to house reference
writes its own sync and burst on the way out. That is `cfbGenlock`, and with it
at 1 every look in the group returns `lock` 99.8, `age` 0, `vroll` 0 — which is
what then allows `cfbMix` 0.9+ and multi-microsecond delays. `meltdown` keeps
the bare cable, because losing the raster is what it is for.

**The camera loop's round trip is the mix times the gain.** `fbGain`'s help
called unity "the knife edge where patterns persist indefinitely". It is not:
`compose` crossfades, so the round trip is `fbMix × fbGain`, and every
camera-loop preset was authored against the wrong number. `zoomBloom` at mix
0.62 and gain 1.07 ran a round trip of **0.66** — a three-frame smear rather
than a loop. Swept at fixed mix, its loop contribution goes 22 → 35 → 89 as the
product crosses 1, with `lock` untouched. The camera loop sits ahead of the
encoder and cannot reach the sync path at all, which makes it the half of the
family that was free to be pushed.

**But only inward.** Above unity the direction of the transport decides whether
there is a picture:

| zoom  | round trip | result                    |
| ----- | ---------: | ------------------------- |
| 1.02  |       1.08 | white-out, mean 242 sd 8  |
| 1.08  |       1.08 | white-out, mean 243 sd 8  |
| 1.045 |       1.00 | white-out, mean 224 sd 22 |
| 0.93  |       1.13 | tunnel, mean 66 sd 71     |
| 0.955 |       1.10 | spiral, mean 81 sd 80     |

An expanding loop spreads what it gains over the whole raster and pins it; a
collapsing one concentrates it into a shrinking core while the surround is
refreshed from the live picture every lap, so it holds a high-contrast frame
well past unity. `tunnelOut` and `spiral` are now that. Everything else that
expands stays under unity, and `crtCutoff` in a camera loop is not an option at
all — 0.22 of it takes the loop to black in under a second.

Three cautions on reading that group's numbers:

- **A keyed loop cannot be judged by `loop`**, a whole-frame mean, when the
  keyer confines it to the shadows by design. `ringInTheShadows` reads 11 where
  `ringLoop` reads 77 on settings that look comparable on the glass, and raising
  the gain until the numbers match walks the highlight-keyed ones to white at
  `cfbGain` 1.22.
- **`sd` is a luma number and half this group is not.** `subcarrierSiren`
  renders as saturated magenta and blue bands with the picture gone and reads
  `sd` 9.2 — the same spread a flat grey field reads, because `spread()`
  measures luma alone and those bands sit at one brightness. It was nearly cut
  for being flat. `looplock` now prints `csd` beside it, mean distance from
  grey, where the same frame reads 46.4, the highest in the group.
- **Loop contributions fall on a source that carries its own structure**
  (`mixerLoop` 66 → 41, `subcarrierComb` 52 → 22 from bars to detail), because
  `loop` is a departure from the same patch with the loops out and there is more
  underneath to depart from. The sync result is source-independent, as it should
  be — the separator hunts in the blanking interval and never sees the picture.

**The group boundary is not where the loops are.** The data test written to hold
this line caught six more presets running the same displacing mixer loop from
other groups. Three keep the raster without help — `keyIntoTheLoop` at lock 100,
`bentEnhancer` 99.8, `howlroundLoom` 99.1. Three do not, and two say so in their
own blurbs. The sixth, `twoMultipliers`, did not: its blurb is about two
balanced bridges in series and a spectrum reorganising itself, and it was
running at lock 0, `motion` 82, deep in the band this page cut as chaos.
Genlocked it holds the raster at `motion` 8.8 with the highest chroma spread of
anything measured that afternoon. The list of presets allowed to run a bare
cable is now explicit in `presets.test.ts`, split into the ones that tear on
purpose and the ones measured to hold without it.

## Labelling: the collectors, and what they were for

**Barely used, and kept as reference.** The idea was to answer "which settings
are cool" with a model rather than with `surprise`'s uniform roll, which needs
labels. Three collectors were built and the dataset never got past a few
sessions, so nothing here has been fitted. What follows is enough to pick it
back up or to delete it on purpose.

- **The tags menu** (`src/ui/TagsPopover.tsx`), a button in the look bar beside
  `saved`: ten perceptual tags and a 1-5 rating over whatever is on screen,
  filed in one click. It lives in the app because a separate page only collects
  from someone who set out to label.
- **The stream** (`/stream/`, `src/vote/StreamPage.tsx`): one look on one
  engine, the `z`–`b` 1-5 keys, the next one. Built for rate — the pair page
  yields one comparison per ~4 s of two engines.
- **The comparison page** (`/vote/`, its own vite entry so `index.html` never
  downloads a byte of it): a pair of candidates on two engines side by side,
  `←`/`→` to pick. Absolute ratings drift between sessions where pairwise
  comparisons are scale-free, so this was the calibration and the blind holdout
  rather than the volume.

All three write into one dataset with a `provenance` field, so a fit reads them
together and can slice any of them back out. Nothing leaves the browser until
somebody signs in; a signed-out session queues to `localStorage`.

**Four rules that would still apply to any replacement.**

- **Rating must be cheaper than moving on.** If scoring a bad roll costs more
  than rolling again, nobody scores the bad ones and the dataset is all
  positives — the one shape a preference model cannot be fitted from. Hence one
  click to commit, and a stream where a key advances at once and waiting
  advances in 5 s.
- **Silence is never a label.** A ready look waits `HOLD_MS` and moves on
  unanswered; after `IDLE_AFTER` of those the stream stops and says so. A row is
  a claim somebody looked, and a page left running over lunch would otherwise
  file a hundred 1s.
- **The vocabulary avoids mechanism**
  (`calm violent warm cold geometric organic legible destroyed rhythmic dreamy`
  — no `vhs`, no `feedback`). The record stores the preset weights and the
  resolved board, so a model can read the mechanism off the parameters; what it
  cannot read is how the result feels, which is the only thing a human adds.
- **The stimulus has to be controlled on the pair page and deliberately is not
  in the app.** On `/vote/`: nothing on screen names a preset or a seed,
  identical boxes, the same synthetic source at a pinned 640×480, the same
  wall-clock develop window on both sides (`FLUSH_MS` 600 then `DEVELOP_MS` 3000
  — frame counts were the first instinct and stretched the wait in proportion to
  how busy the GPU was), an engine each so neither develops in the other's
  leftovers, ~15% authored anchors, and a per-side fps readout because a stutter
  on one side only would collect a vote about the stutter. In the app, judging
  looks over your own content is the deployment condition.

**The search space is a recipe**, not a board: a sparse weighting over the ~70
authored presets that `blendPresets` expands into the full ~215 controls — the
same space `randomPresetMix` samples. That is what makes it tractable, since no
preference model fits 215 free dimensions from a few hundred votes. Sampling is
seeded, so a label can be re-rendered.

**Two collections**, the shape a Bradley–Terry fit wants:

```
/candidates/{id}   { v, id, seed, kind: 'mix'|'anchor', weights, query, by, sat }
/votes/{auto}      { v, a, b, choice: 'a'|'b'|'skip'|'neither', ms, seed, source, at, by, sat }
/ratings/{auto}    { v, tagSet, look, query, weights, preset, provenance, tags, cool, ms, source, at, by, sat }
```

`look` is a hash of the resolved board rather than of a recipe, because a look
dialled in by hand has no recipe and both collectors have to land in one key
space. `query` is the packed `#p=` form, so prefixing the origin makes any row
openable in the instrument. `a`/`b` are in the order they were on screen, so a
left-hand bias is measurable after the fact; `ms` is deliberation time; `by` and
`sat` are pinned by the rules, so a client cannot forge who voted or when.

**Export is an admin job**, because the rules allow `get` and not `list` — no
signed-in client can enumerate these collections.

```
node scripts/labels.mjs [outDir=labels]
```

It writes the three collections as JSONL plus `ratings.csv` (tags as one-hot
columns) and `ratings_weights.csv` (long form, one row per rating × preset ×
weight — the design matrix that separates "worn tape is dreamy" from "the look
it happened to appear in was dreamy"). It authenticates from
`GOOGLE_APPLICATION_CREDENTIALS` or from whatever `firebase login` left on this
machine, and `FIRESTORE_EMULATOR_HOST` points it at the emulator, which is how
the flattening is tested. `pnpm test:rules` exercises the rules boundary.

**How many labels would be enough**, from `node scripts/affinity.mjs simulate` —
it generates ratings from a known affinity, fits, and measures how much came
back:

```
ratings   tag r    cool r
    100    0.23     0.65
    200    0.25     0.80
    400    0.39     0.87
    800    0.49     0.92
   1600    0.66     0.96
```

**`cool` is usable at ~200 ratings; the tags need something like 1600**, because
`cool` is 1-5 and every rating carries it where a tag is one noisy bit that is
mostly absent. An earlier estimate of "about 150 for everything" was wrong by
roughly 10x for the tags. So `surprise: cooler` is an evening or two of rating
away and `random → dreamy` is a much longer haul, and a small, high-prevalence
tag vocabulary is worth more than a broad one. Coverage binds before volume:
each roll names 2-3 presets, so ~150 rolls gets each of the ~70 presets seen
about five times.

The fitter is verified — against a noiseless target it returns r = 1.000 at
every sample size, so those numbers measure noise rather than bias — and that
check is what caught its one bug: it centered the target but not the columns of
the design, leaving no intercept to absorb the base rate. It did not look like a
bug; it looked like a hard problem needing more data.

**If anyone picks this up**, the shape it was aimed at: a heuristic viability
filter on image statistics (black, blown out, frozen, flat) as the baseline the
learned model has to beat and the pre-filter that stops humans voting on
garbage; a warm start with no votes at all, since the 70 authored presets are
"cool" by construction and turbo-mutate rolls mostly are not; a Bradley–Terry
head over the preset-weight vector plus frozen vision features; active learning
on the pairs the model is least sure about; and CMA-ES over preset weights with
the model as fitness, which would be the new `surprise` button.

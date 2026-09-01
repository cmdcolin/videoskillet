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
  never fires it. Anything with a `trig` routing is exempt from the low-dep list
  by construction.
- **A still source.** The three feedback loops eat their own output, so over a
  frozen frame they converge and stop. What they do to _moving_ picture is the
  whole point of them and is not in these numbers.
- **A source with no detail.** SMPTE bars are flat fields, so the entire
  tape-wear family — soft luma, chroma noise, dropouts — moves them by almost
  nothing. `--source=detail` swaps in a multiburst, text-scale structure and a
  lit sphere, and the tape looks move on it. Run both.
- **Modulation.** The bay is a UI-layer thing; the graph here never sees it.

## Presets that barely leave clean

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

Those six are the whole of it: every other preset in the table clears dep 12 on
at least one of the two sources. Four sit just over the line on bars alone and
are worth a second look — `tiredAmplifier` (16.7 / 4.1), `cbBreakthrough` (12.8
/ 6.4), `colourLate` (12.5 / 9.1) and `broadcast` (12.5 / 11.2).

Not all of those are candidates. `punchIn` is _designed_ to sit still until you
hit ⚡, and the harness never fires it. `broadcast` is a near-clean baseline on
purpose. `mixerLoop` (8.4 on detail) is not in the list but would be on a third
source: it is the README's hero shot, and it scores low only because a loop over
a frozen frame converges — the still-source blind spot, not the preset.

What is left is one cluster: **the quiet end of Tape wear**. Four of the twelve
entries in that family — `vhs` itself among them — move the picture less than
anything else in the table.

`fmFold` and `colourLate` are the two to look at rather than cut. Both carry a
p99 far above their dep — they do something violent to a narrow part of the
picture and nothing to the rest, which is the signature of an effect that is
working and is scoped too small, not one that is absent.

One caution on the detail source: the clean NTSC path already turns its
multiburst and text bands to cross-colour mush, so a preset whose whole job is
softening has less left to soften. Detail under-reports the tape family too,
differently from bars. Neither source is the arbiter; two disagreeing sources
are a reason to look at the frame.

## Presets that depart into nothing

Caught by mean/sd rather than by dep — these leave clean decisively and arrive
at a blank frame:

| preset          |  dep | mean |  sd | what it renders |
| --------------- | ---: | ---: | --: | --------------- |
| chromaOnly      | 98.9 |  0.1 | 0.3 | pure black      |
| reversePolarity | 98.0 |  1.1 | 5.5 | all but black   |

Both render black on bars _and_ on the detail chart, so it is not the source.

`chromaOnly` promises "burst-locked color glowing on black" and renders black
with no colour in it at all. `reversePolarity` sits next to `negative`, which
inverts properly (mean 170). Both want a look before they want removing: a
preset that renders black is as likely to be a bug in the path it turns on as it
is a bad idea.

## Near-duplicates

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
under-weights a slider with a huge range, so treat this as a list of pairs to
look at side by side, not as a similarity score to sort by.

## The control table

`fmOverdev` — the question that started this — measures dep 1.55, p99 71.2 at
full travel on bars, which puts its mean departure below `lumaMHz` and its 99th
percentile above most of the table. Looking at the frame says the same thing: at
maximum it is a hairline of noisy black on the leading edge of a bright bar, a
few pixels wide. The help text promises "a black comet" that "smears rightward
for about a microsecond" and the streak's decay is ~10 samples, so the mechanism
is doing roughly what it says — it is the _scale_ the prose oversells, not the
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

## What the eye said that the numbers did not

Two rounds of screening went in front of Colin as contact sheets — twelve
flagged presets with two controls, then fourteen feedback patches, each rendered
as a playable strip rather than a still. The verdicts are worth more than the
measurements, because they are the only signal here that is about quality rather
than about movement.

### Round one, the cut list

Cut outright: `chromaOnly` and `reversePolarity`, the two that render black, and
the quiet end of Tape wear — with the note that "many of the vhs settings are
quite similar" and "I don't want so many subtle things". Nine presets went.
`vhs` stayed: it is the canonical one, and reading subtle is an argument for
making it less subtle rather than for cutting it.

Six of fourteen random rolls were rejected as well, and the composition of the
rejects says something the preset table alone does not: **`pastTheYoke` is in
three of the six and in none of the fourteen keepers**, `transmissionFault` in
two. Neither is subtle — they are the opposite, patches that flatten whatever
they are blended with. That is a roll-blending problem rather than a preset
problem, and it is still open.

One piece of it closed later, from the other end: `pastTheYoke` was the only
preset holding `bendShape` on ripple — a sine down the whole frame at a
wavelength nothing in the picture sets, which reads as a grating laid over the
raster rather than as a scan going wrong. It bows now, and `ROLL_NEVER_LANDS`
(`mutate.ts`) keeps every roll — jitter, throw and preset blend — off that shape
unless the board is already on it. The shape stays on the control for a hand to
pick. What made the blend worse than the preset was: `bendShape` is an enum key,
so a follower at weight 0.25 handed the shape over whole while the amplitude
around it scaled down.

The same session turned up the neighbouring one. Every preset that used the HV
tank was authored between 0.8 and 0.9 on `hvRing`, and the dial is steep up
there: damping ratio 0.66 at 0.5, where a bright edge overshoots once and has
settled within seven lines, against 0.32 at 0.9, where the wobble is still going
half a cycle later and the next line of content kicks it again. Stacked under a
roll it stopped reading as a supply under load and started reading as the
picture sliding about. The four presets carrying it as texture under something
else — `ignitionStorm`, `bassSmack`, `huntingServos`, `meltdown` — came down to
a light application; the three it is _about_ (`supplyChaos`, `fullCollapse`,
`pastTheYoke`) kept what they were tuned at, and `ROLL_STAYS_UNDER` holds a roll
to 0.6 ring and 12us sag instead.

### Round two, the loops

Seven of fourteen feedback candidates kept: `zoom bloom`, `tunnel out`,
`spiral`, `subcarrier comb`, `ring loop`, `servo warp`, `both loops`.

The pattern in what survived is sharper than any number here produced.
**Geometry that accumulates and colour arithmetic were kept; ringing, blur,
texture and stutter were not.** Both keyed resonators went, and they were the
strongest prior going in — the previous round's own note says keying is what
puts the ringing back _on_ the picture rather than over it, which is true and
turned out not to be the point. So did `defocus blobs`, `drift smear`,
`line ladder` and `strobed trail`.

`both loops` was kept at dep 26, the lowest departure in its sheet, while
`iris hunt` was cut at 106. Departure did not order these at all.

### What this means for a future round

Propose looks that **change where the picture is** (zoom, rotation, timebase
pull) or **what colour it is by arithmetic** (subcarrier delay, ring
modulation). Do not propose looks whose content is texture — a blur, a ring, a
grain, a stutter. Two sources disagreeing is a reason to look at the frame; the
eye disagreeing with the numbers means the numbers were measuring the wrong
thing.

## Ring modulation does not make rainbows

Worth writing down because the name promises otherwise, and because six
candidates were built on the assumption before anything was rendered.

`cfbRing` multiplies the loop bus against the live program. Both signals carry
their subcarrier on the **same crystal**, so the products land at the sum (7.16
MHz, above the chroma passband) and at the difference (DC, which is luma). The
chroma filter discards the first, and the second is brightness rather than
colour. Six candidates varying the detune, the line offset, the chroma trap, the
demodulator axis and the comb around a strong `cfbRing` rendered within a point
of each other on every measure, as the same desaturated grey-blue wash — and
pulling the crystal 60 kHz did not change it, because 60 kHz off 3.58 MHz is
still DC as far as the passband is concerned.

Two routes do make colour by multiplication, both by putting the terms at
genuinely different frequencies so the difference lands back inside the chroma
band:

- **`bRing` with `bDetuneHz`** — B's subcarrier against A's, kilohertz apart.
  Saturated bands, and at `bGain` 0.55 it also renders at mean 209, which is
  blown out. The level wants pulling well back before this is a look.
- **the synth oscillator near 3.58 MHz over the picture** — `synthOver` with
  `synthColor`, which translates luma up into the chroma band, so brightness
  arrives as hue. Strong, but one hue at a time; the colorizer needs sweeping
  for a spectrum rather than an olive wash.

`scripts/gpuprof/candidates.rainbow.ts` holds the set and the finding.

### The third route, and the finding above as the reason for it

The two routes above are both "put the terms at different frequencies". Said
that way it names the missing piece: the loop's ring modulator had one input on
the loop and the other wired permanently to the program, and the program is the
one signal on the board guaranteed to be on the same crystal as the return. So
the box could only ever make the products the chroma filter throws away.

`cfbRingSrc` puts an oscillator on that input instead, and `cfbCarrierKHz`
detunes it. With the carrier at the subcarrier the bridge is an encoder's chroma
modulator: the return's brightness translates up into the chroma band and its
colour translates down into brightness, so a lap swaps the two.

Measured with `scripts/colourcheck.mjs`, which was written for this question —
`clip-haunted-house` is a 1929 film, so a clean arm reads sat 0.018 and any hue
on screen was manufactured by the chain:

| arm                |   sat | hues | colour% |
| ------------------ | ----: | ---: | ------: |
| clean              | 0.018 |    0 |     0.0 |
| loop, no ring      | 0.020 |    0 |     0.1 |
| ring on program    | 0.008 |    0 |     0.4 |
| ring on oscillator | 0.265 |    3 |    51.6 |
| oscillator +12kHz  | 0.377 |   10 |    49.7 |
| oscillator +120kHz | 0.282 |   12 |    46.1 |

Read the first three rows as this section's own claim, reproduced: against the
program the ring mod does not merely fail to add colour, it takes away the
little the chain had (0.020 down to 0.008). Read the last three as the fix, and
note that `sat` and `hues` disagree on which is best — the +12 kHz arm is the
most saturated, the +120 kHz arm spreads across every sector at lower
saturation. On frequency the invented colour lands on one phase, which is why
three sectors hold it; the detune is what turns it into a wheel.

**A colour claim measured on a saturated source is not measured.** The same
sheet on `clip-test` puts every one of those arms between 0.29 and 0.39 against
a clean 0.487, so the mechanism that makes colour out of nothing reads as a
mechanism that slightly reduces it. That is the trap this whole section fell
into once already.

## Chaotic is not the same as wild

The correction that cost the most to learn, and it was learned by getting it
wrong. Three rounds of candidates came back "very subtle", so the next round
stacked everything: both ring modulators, both loops run hard, sync marginal,
deflection past the supply. Those scored `motion` 105 — five times anything kept
before — and the verdict was **"too chaotic ... they need work"**.

What survived that round instead:

| kept             | motion |
| ---------------- | -----: |
| runaway          |     33 |
| sync in the loop |     14 |
| lorenz loop      |     14 |
| strobe bloom     |     14 |

Everything at motion 55 or above was cut. So the axis is not amount of movement
and it is certainly not entropy: what reads as wild here is **large, coherent
structure that evolves** — a loop crossing unity and bleeding back, a stack of
roll seams at different ages, an echo whose spacing never repeats. What reads as
noise is high-entropy hash, however energetic the numbers say it is.

`motion` is worth watching from both ends, but **only within one sheet** — see
the section below. The absolute figures in the table above are not reproducible
from any invocation this repo records, and motion scales with the frame spacing
(`--video` reads adjacent frames, a stills strip reads every fourth) and with
the source. What survives re-measurement is the _ordering_: on the same sheet,
every look kept sat below every look cut, by a factor of three or more. Read it
as a rank, never as a threshold.

One more thing that number cannot see: it is measured between _adjacent_ frames,
so a slow sweep reports as motionless. A hue rotation at 0.2 Hz moves 1.2° a
frame and scores under 3 while cycling the whole wheel in five seconds. Read it
alongside a clip, never instead of one.

## The routings were never applied

The largest correction in this file, and it invalidates numbers in the tables
above rather than adding to them.

`sheet.ts` grew the ability to drive the modulation bay, and every part of the
plumbing landed except one line: the candidate loader built its items without
copying `mod` off the spec, and its inline cast did not mention the field, so
`tsc` had nothing to object to. `Item.mod` was declared, `runner.run` was handed
it, and it was `undefined` for every tile ever rendered. The local name for the
imported spec module was `mod`, which is how it went unseen.

Presets went the same way, and that is the more expensive half: 23 of the 84
carry a routing, including every feedback look in the table above.

What it changes, measured on the same sheet with the routings off and on:

| preset             | dep off | dep on | motion off | motion on |
| ------------------ | ------: | -----: | ---------: | --------: |
| vertical hold gone |    60.6 |   30.3 |       72.2 |      70.7 |
| runaway            |    46.0 |   38.1 |       37.7 |       4.9 |
| spiral             |    29.4 |   44.9 |       12.7 |      12.1 |
| sync in the loop   |    53.2 |   56.7 |       12.4 |      26.1 |
| chroma rails       |    86.8 |   99.0 |       58.5 |      70.7 |
| zoom bloom         |    21.3 |   29.8 |       15.4 |      13.1 |
| both loops         |    25.1 |   33.4 |       11.4 |      10.0 |
| lorenz loop        |    41.5 |   31.7 |       13.3 |      18.9 |

`both loops` is the one to notice: the note above keeps it "at dep 26, the
lowest departure in its sheet", and with its LFO running it is 33.4. `runaway`
is the other direction — its whole description is a gain walked past unity by an
LFO, and driving that LFO drops its motion from 37.7 to 4.9, because the sweep
spends half its time below unity where the constant setting never did. Neither
look was judged as itself.

`survey.ts` had the same hole and is now wired the same way, which matters more:
it is the script the cut lists on this page were drawn from. Driving the
routings moves 21 of the 84 presets, and it moves them in the direction that was
quietly costing feedback looks their place:

| preset           | dep resting | dep driven |
| ---------------- | ----------: | ---------: |
| sync in the loop |       22.15 |      67.24 |
| spiral           |       25.47 |      68.24 |
| subcarrier comb  |       13.20 |      43.21 |
| both loops       |       11.03 |      29.05 |

`both loops` at 11.03 sits _below_ the dep 12 line this page uses to call a
preset weak, and `subcarrier comb` at 13.20 sits just over it. Both are in the
thirties and forties with the LFO they ship with running. A resting-frame survey
systematically under-reports exactly the family whose movement lives in the
routing, and that is the family the last two rounds were curating.

The cut list already applied is not affected: the six presets on it — `vhs`,
`punchIn`, `broadcast`, `mixerLoop` and the two that render black — carry no
routing, and re-measuring with the bay driven leaves them where they were.

`--nomod` renders any sheet at its resting frame, which is both the ablation for
"is this the patch or the LFO" and the way to reproduce anything measured before
the fix.

## A routing based at a slider end is a routing that does nothing

The other half of the same afternoon, and the reason `synth in the loop` came
back locked to one hue.

The bay's LFOs are **bipolar**: a routing swings `±depth × travel` around
wherever the control rests. So a control resting at its own minimum loses half
its excursion to the clamp, and a slow routing loses all of it — the triangle is
`1 - 4|ph - 0.5|`, which starts at −1 and takes most of a four-second clip to
climb back to zero.

`synthHueDeg` runs 0–360 and defaults to 0. The candidate routed a 0.06 Hz
triangle onto it at full depth and rendered identically, to two decimal places,
with the routing driven and with it off: the control sat clamped at 0 for 96% of
the run. Sampling the frame mean per clip says it plainly — as shipped the
picture holds R170 G199 B15 from the first frame to the last, and based at 180
the same patch walks green → cyan → blue.

This was previously written up here as a level problem: the field was blown to
near-white, and rotating the hue of near-white does nothing. That was wrong. The
hue was not rotating at all, and the three routings that "produced dep 88.61 /
88.64 / 88.68, essentially identical" were identical because none of them ran.

`Runner.run` now warns when a routing spends more than a quarter of the run
against an end, naming the base and the range. It catches `bDetuneHz` based at
1500 in a ±3000 span as well, at 28%. None of the 23 presets trip it — those
were authored with the bipolar swing in mind, and the candidate was not.

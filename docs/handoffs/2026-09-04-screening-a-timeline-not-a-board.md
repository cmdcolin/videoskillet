# Screening a timeline, not a board

_2026-09-04._ The day before had left the carousel playing three recordings of
the app's window. Two of them had nothing happening in them, and the third spent
five of its sixteen seconds on a white field. This is what it took to find that
out and what fixed it — including the instrument that was wrong, and the two
hours it cost before anyone noticed it was wrong.

## The measurement that came first, and what it settled

[The previous note](2026-09-03-the-carousel-that-builds-something.md) left the
lead slide at 914K with "length is the lever, and the timeline has about a
second of slack in its holds". `ffprobe` on the shipped file, summed per beat,
says the lever is real and the slack is not where it looked:

| beat           | secs | K/s |
| -------------- | ---- | --- |
| opening hold   | 1.0  | 65  |
| drag mix       | 1.7  | 55  |
| drag auto-iris | 1.5  | 52  |
| press mixer    | 1.0  | 79  |
| drag loop mix  | 1.8  | 51  |
| finish hold    | 2.4  | 65  |

**The bitrate is flat**, so a second of hold costs exactly what a second of drag
costs and no more — there is no fat to find, only a length to choose. Colour
bars at rest cost as much as a feedback runaway, because what h264 is paying for
in both is the picture's own noise floor; the panel is static and codes once.
Across the whole reel it is the _look_ that sets the price: the two colour-bars
slides ran 57–58K/s and the fuzzy-feedback one 12K/s.

That last number is the useful one, and it is not about file size. **A slide
that encodes at a fifth of the going rate is a slide with nothing moving in
it.** The encoder had been saying so all along.

## Three slides, three different faults

**The fault slide dragged a row three per cent and claimed a raster that
breathes.** `HV sag` runs -100..100 on a `zero` curve, so the travel expands
around the middle — and `{ drag: { slider: 'HV sag', to: 0.53 } }` is
**+1.6us**, not the +6us the old note guessed. The bars sat there looking clean.
At 0.93 it is +70us: they bow, and the black between them bows with them, which
is the whole argument for it being geometry. Screened against the group's other
rows — `bend` at 60 and 120, `v size` underscan, the beam limiter — and those
are more violent but they tear the bars into diagonals and ribbons. A fault you
cannot still read the picture through says nothing about geometry.

**The map walk ran over mud.** `Fuzzy color bars feedback` is a soft brown smear
that does not change; the 12K/s above is its file saying so. It runs over
`Wiggity` now, which is the gallery's own first look, carries two mod wires, and
is a bright scanline arch that bends while the map is walked.

**The lead slide's auto-iris was the problem, not the solution.** A camera loop
driven past unity _latches_: the frame saturates to white and nothing later in
the timeline gets it back, so the clip's middle was a white field and its finish
a smear over one. Held under unity the optical loop only holds trails, and the
colour is the electrical loop's job.

## The instrument was wrong

This is the part worth keeping.

`contact.mjs` renders a candidate by putting the whole board on the URL and
letting it settle. That is exactly right for a preset — a preset _is_ a board,
and whoever clicks the chip gets that load. It is wrong for a slide, because **a
loop applied at load grows from an empty frame buffer**, and that is a transient
which happens once and which no hand can reproduce.

The cost of not knowing that: `fbMix:0.9, fbIris:0.6, fbZoom:0.97, cfbMix:0.95`
screened as a **radial starburst on black**, sharpest of eleven neighbours,
reachable in four non-fine rows. Recorded, it is a horizontal smear. Two rounds
of contact sheets, a lap-count check (the starburst is fully formed by frame
100, so it is not settling time), and eight orderings of the same four rows —
all eight land on the same wash. The board is not reachable at all.

`scripts/pathprobe.mjs` is what came out of it. It walks the rows the way a
timeline does, at the timeline's own pace, and grabs the canvas at the end — no
screenshot per frame and no encode, so a variant costs seconds where a take
costs ninety, and a dozen fit in the time one recording does. Every finish in
the shipped slide was chosen on its output.

What it found, in one round of twelve:

- **`loop delay` is the row the whole picture turns on.** Every variant without
  it is a pale wash; with it the frame is flowing green and magenta. 0.14us on a
  loop carrying its own subcarrier is half a turn of hue every lap.
- **and its thumb moves a third of a per cent of the track**, because the row is
  linear over 0..63us. The readout and the picture are what say the drag
  happened. Same shape as the `HV sag` fault above, from the other direction:
  one row hides its mechanism behind a curve, the other behind a span.
- `rotate` at 6° beats `zoom` at ×0.97 for the same job and is a quarter of a
  track rather than four per cent of one.
- Dropping the iris altogether is what removes the blowout. Nothing gentler
  worked: iris at 0.35 and 0.45 wash out the same way.

## What ships

Four rows on the lead slide — `mix`, `rotate`, `loop mix`, `loop delay` — and
the finish is a field of flowing colour with "4 off stock" and the delay row's
own readout in frame. 823K wide against 936K, 762K narrow against 923K.

The other two slides cost **more** than they did (deflection 491K → 625K,
signal-path 85K → 657K), and that is the flat-bitrate measurement read from the
other side: they are moving now. The page still fetches one clip at a time, so
what a visitor pays on arrival is the lead slide's, which went down.

## Recorder bug this turned up

`reel-taken.json` had been recording the poster's frame number where it should
have been recording a release: a `const at` for the still frame shadowed the
module-scope `const at = capturedAt()`, so the manifest went out holding `374`.
`--check` reads that back as `taken at vundefined` and reports every clean tree
as stale. Entries for slides no longer in the reel are dropped now too, rather
than carried forever — the file still had `control`, `window` and `feedback` in
it.

## Left open

- **The phone pays desktop weight for a third of the picture.** The narrow take
  encodes at 624x992 into a box 356 CSS pixels wide; the wide one encodes 825K
  pixels for a box of 1110. Measured on the real frames, dropping the narrow
  output to 512x814 is 823K → 607K, a 26% cut for a clip that would still be
  1.44x its own CSS box. `reel.mjs` argues 624 from the 1.75x ratio and that
  argument is written down, so this is a call to make rather than a bug to fix.
- **Raising crf is still refused**, on the previous note's measurement: 36/38/40
  is 871/782/695K off the same frames, and what 38 and 40 take is the fine
  dropout speckle.
- `showcase` is still one demo. The flag is the right shape and barely used.
- Recording is ~90s a take and there are six; `pathprobe.mjs` is seconds a
  variant, so the shape of a session here is now "probe a dozen, record once".

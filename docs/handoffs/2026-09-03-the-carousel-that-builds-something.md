# The carousel that builds something

_2026-09-03._ The landing page's stage read as three screenshots. A visitor
could not tell there was a video in it, and the two slides that moved were a
slider bending a photograph of a cat. This is what was tried on the way to
slides that start on a clean board and get somewhere by hand, including the two
approaches that were wrong.

## Three things were wrong, and only one of them was the carousel

**`/guide/*` was not served in dev at all.** The docs site is a separate static
build (`scripts/build-guide.mjs` → `dist/guide/`) that Pages hosts beside the
app; the dev server knew nothing about it. A miss under `/guide` fell through to
vite's HTML fallback, so `/guide/img/signal-path-callout.jpg` came back as
`index.html` **with a 200**. An `<img>` holding a document paints as an empty
box and the network log shows nothing wrong — a 404 would have said so on the
first look. `vite-plugin-guide.ts` serves figures straight out of `docs/img`
(which is where the builder copies them from, so a figure is right without a
guide build having been run) and pages out of `dist/guide` when there is one.

**Nothing on the stage moved on arrival.** It played only after a `Play` chip
that sat in a row of visually identical tab chips. It autoplays on
scroll-into-view now and the chip is gone; the tabs are the only control, and
they are the way in for every reader rather than the fallback for one kind.

**The header was a clip.** 86K fetched before anybody had scrolled anywhere, at
55% opacity under a scrim closing to the page colour — about a fifth of it
reached the screen. It is the demo flagged `hero` in `demos.json` as a still
now, at 8K, and the flag is also what `ogimage.mjs` grounds the link preview in,
so the page and the card standing in for it are the same picture.

The wash had to change with it. The old one ran top-to-bottom and held the whole
width near 55%: a _moving_ fifth of a picture reads where a still one is mud. It
is the link preview's angled wash instead — opaque down the type column,
clearing past it — and **where it clears is the measure, not a fraction of the
window**. Written as a percentage it cleared at 336px on a 390px phone, straight
through the middle of the sentence under the buttons.
`calc(50% + var(--measure) / 2)` lands past the right edge below the measure, so
a phone simply gets an even wash, which is the right answer where there is no
"beside the type".

## Two wrong turns on the slides

**The cat.** The slides ran on the bundled photograph through a tape path,
chosen because damage is legible on a cat. That is true and it is also the
problem: a stranger watching a slider bend a photograph has been shown that the
program has sliders, and nothing else.

**Winding one row back.** So they were moved onto the looks the gallery lists,
with one row of each wound back through `?set=` (which layers over `?p=`) so a
drag could arrive at the demo. Worse. The board was ninety per cent of the way
there before the clip started and the drag took the credit. It also does not
work: chroma gain on that board is _inside_ a feedback loop, so arriving at
15.79x is not arriving at the look — the loop needs laps to breed it, and the
clip cut away on a black frame with a slider reading 15.79x, which says the
control does nothing.

## What ships, and what the probes said

`params: {}` — a bare load, which is the app's own near-blank board: stock
controls, colour bars on both sources. Every value that ends up on screen was
put there by the hand in the frame. The lead slide raises three rows and
finishes on a field of rainbow that was not there sixteen seconds earlier; "This
look · 3 off stock" in the frame is the proof.

Which three took a probe rather than a guess (`?set=` from clean, warm 300,
shoot the window — one browser per spec, because a single Firefox does not
survive a long WebGPU batch and a lost device paints a "rebuilding" toast over
the shot):

- **Colour bars hide chroma gain.** They are already saturated, so 12x clips
  them back to almost the same bars. The photograph was in there for a reason.
- **`fbMix` and `fbGain` multiply.** A loop under unity decays to a dark wash
  however far the fader goes: `fbMix:0.95` alone is a dim green smear. What
  makes a picture breed rather than fade is the round trip sitting just over 1,
  which is what the group's own readout says on screen while the hand is on it.
- **`gain` is unreachable.** It is `fine: true`, so it lives behind the group's
  "N fine tweaks" disclosure and there is no row to reach for.
- **`auto-iris hunt` is the row.** Non-fine, fourth in the group, and the better
  demonstration: winding up a servo that is metering its own output shows _why_
  the runaway happens. `fbMix:0.9, fbIris:0.6, cfbMix:0.95` is a white-hot core
  with rainbow ripples across the frame.

## Recorder bugs this turned up

- **A map box is aimed at its label now, not its group.** The two loop pills
  carry the dotted band they ride on inside the same `<g>`, so the group's box
  is 271x38 of mostly empty band and its centre lands on a bare `<path>`. The
  press was a silent no-op that only showed up as the rest of the timeline being
  wrong.
- **A stage opened from the map unfolds its _first_ group.** The receiver's is
  SYNC, so a timeline that pressed RECEIVER and reached for a deflection row
  found none. Seed the group instead; walking the map is the third slide's job.
- **A `scrollTo` on a panel with nothing to scroll is a still beat**, not a
  crash. `scrollPlan` returns null there and the caller read `.from` off it. The
  same timeline is recorded at two widths and a row below a phone's fold is
  already on screen at 1112px.
- **`stillAt` per slide.** The poster was fixed at 0.55 of the timeline, which
  suits a walk and is wrong for a build: the middle is a picture on the way to
  the one the slide is about, and it is the whole of what a reduced-motion
  reader sees.

## Left open

- **The lead slide is 914K**, the heaviest file the page has ever had. Per-slide
  crf was tried and removed: 36/38/40/42 is 871/782/695/618K off the same
  frames, and smooth gradient is where a raised quantizer bands. **Length is the
  lever**, and the timeline has about a second of slack in its holds.
- **The stage no longer plays anything for a reader on
  `prefers-reduced-motion`**, by instruction. They get the stills and the tabs
  and step through by hand. The old `Play` chip existed for exactly them.
- **`showcase` is down to one demo**, since only the third slide names a look.
  The flag is still the right shape; it is just barely used.
- Recording is ~90s a take and there are six. It wants a `git worktree` copy
  with its own vite (`cacheDir` and port of its own, `node_modules` symlinked,
  run `node_modules/.bin/vite` directly) — an HMR reload from another agent
  editing `src/` mid-run resets the engine under the recording.

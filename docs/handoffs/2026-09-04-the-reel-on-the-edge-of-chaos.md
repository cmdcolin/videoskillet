# The reel on the edge of chaos

_2026-09-04._ All four carousel slides were judged weak in one note: the random
slide's nudge "is too minor of a change", the presets slide "goes over the same
settings sort of repeatedly", the signal path's "results are not that
interesting", and the build "stops too soon" on "dark and muddy colors rather
than bright vibrant crazy rainbows". This is what replaced them, what was
screened on the way, and two things the screening instrument lied about before
it was fixed.

## What ships

Every slide runs on the bundled photograph, on stock controls, and every value
on screen is put there by the hand in the frame.

- **Random** presses `random look` four times on `?src=cat&seed=26` and presses
  `reset` to come home. Seed 26 came off forty seeds: a roll lands somewhere
  dull about one press in three — a cable fault, a dissolve to the bars on B, a
  grey field — and 26 is a run of four vivid, different pictures.
- **Presets** is four blends of seven different chips with `clean` between:
  silkscreen under a howling detail enhancer, poured colour into a collapsing
  raster, block colour into meltdown, and headroom, the howling enhancer and
  poured colour three deep.
- **The signal path** scrambles the feed in the channel (sync suppression), sets
  the hue barber-poling and winds chroma gain up in the receiver's decoder, and
  shears all of it with HV sag and a ringing supply — then reset.
- **From clean** raises the ring loop's seven rows as before and goes on: chroma
  gain in the decoder colours the grey trails, and the tube's saturation and
  bloom make them electric.

## The rule that decided the rows

Colin, mid-session: "some of the settings like hv sag look a bit generic when
applied without anything else interesting going on ... so things need to combo
well", and later "we like stuff on the edge of chaos, but still discernable".
Thirty-six rows screened one at a time on the photograph mostly read as nothing
on a still (grille, convergence, purity, phosphor, colour-under, ghosting,
tracking). The three that read alone — sync suppression, subcarrier detune with
chroma gain, HV sag with supply ring — read better stacked, and every timeline
is ordered so each pull lands on what the last one did.

Three more rulings from the same note, now in code and memory: `bent scan` "just
adds a little bend to the image" and came out of the presets slide for
`full collapse`; `supply chaos` "often looks kind of boring also" and came out
of both blends it was in, for `howlround loom`; and phosphor persistence
"normally doesnt look very good", so `phosphor` joined `ROLL_NEVER_STARTS`
(`src/ui/mutate.ts`) and no roll starts it from rest.

## The instrument, and what it lied about

`scripts/reelscreen.mjs` drives the app with the timeline's own verbs (press,
drag, blend a chip, open a stage, pick from the caret menu) and grabs the canvas
at named checkpoints into one montage. It screened forty seeds, twenty-eight
chips, forty pairs, thirty-six rows and a dozen loop recipes in an afternoon;
`reelscreen.example.mjs` is the shape of a variants module.

- **A canvas grabbed after a wall-clock wait reads black.** `drawImage` off the
  WebGPU canvas is only the frame when it runs in the task that rendered it, so
  the first roll sheet showed a third of all rolls as black and the probe over
  time showed the same look black at 0.3s, 1.5s and 3s and rendered after a
  burst of engine steps. The grab now steps the engine once and screenshots the
  canvas rect in one go. A sheet with black tiles is the probe, not the look.
- **A row's readout updates on React's next render, not with the input event**,
  so bisecting a travel fraction for a value inside one `evaluate` reads stale
  numbers and lands at 0 or 1. The bisection runs across evaluates now.
- The video synth bank is only in the panel when source A is the synth, so a
  hand cannot build the colorizer looks on the photograph; the colorizer chips
  are how the presets slide gets them.

## A phone could not drag a chip

Reported during the session: "your click-and-drag arent working on the mobile
demos ... it is not sliding them". The chip's fader disarmed itself on any
pointermove with `buttons === 0`, which is the right read of a mouse whose
release was swallowed and the wrong read of a touch pointer, which WebKit
reports with no buttons while the finger is down. Reproduced in Chrome by making
touch pointer events report `buttons` 0: the drag slid nothing; with the check
gated to `pointerType === 'mouse'` it fills to 53% like a mouse drag does. Not
verified on a real device this session — worth a thumb on an iPhone.

## The portrait take dragged every chip to 1%

The same complaint, on the phone clips — "it is not sliding them" — turned out
to be the recorder. Under Chrome's phone emulation (`hasTouch`, `isMobile`)
every `page.screenshot` fires a `pointerleave` at an off-page position and a
`lostpointercapture` on the chip, so the fader let go at the first frame of the
drag: `REEL_DEBUG=1` showed every chip in the portrait take at 1%, and a minimal
replay measured 8% by mouse against 67% by `page.touchscreen` for the same drag.
The portrait take drives chips with a touch sequence now, which is the phone's
own gesture anyway; slider drags are synthetic events and were never affected. A
`pointerleave` with no buttons still disarms the fader in the app, which is
right for a mouse and is not what a real phone sends.

## A chip that lit and went dark

Colin, watching the preset slide: "the click and drag on block color did not
work, the mouse missed". The drag had registered — the look bar read 8 controls
off stock and 22 after meltdown — but the chip showed no fill from the moment
the drag ended, so on screen it was a miss. That take dragged the next pair 0.6s
after pressing `clean`, inside the one-second morph home. Three instrumented
replays (the probe at the recorder's pace, with wall-clock gaps, and the
recorder itself under `REEL_DEBUG=1`, which now prints every lit chip after
every beat) all kept the fill, including with the short dwell, so the mechanism
is not pinned. What ships waits the whole morph out after `clean`, which the
sentence of the slide wanted anyway, and the re-recorded take logs every chip
lit at the strength it was dragged to. If it recurs,
`REEL_DEBUG=1 pnpm reel presets` is the first thing to run.

## Second pass, same day

- **The build raises chroma gain first.** Screened four orders of the same ten
  rows: with the decoder rows last the loop is grey trails for eight seconds
  before any colour arrives; with chroma gain first the photograph saturates on
  the first drag, every loop row changes a coloured picture, and the finale
  (saturation and bloom on the tube) is the same.
- **Clicks ripple red.** "if you are capturing user videos and expecting them to
  see what you are clicking you might be going a bit too fast potentially. might
  want to add red 'ripple' to clicks and stuff too". A press, and the first
  moment of a drag, throw a red ring that grows and fades over 0.4s; a held drag
  keeps a steady red ring. The green three-frame ring it replaces was a click as
  the hand feels it, not as a viewer sees it.

## Left open

- The wide takes are 2 to 7 MB each at crf 34 — heavier than the last set (the
  pictures have far more colour in them). Length is the lever, per the previous
  handoff, and `build` at 18.3s is the longest.
- `Wiggity` is still flagged `showcase` in `demos.json` and nothing on the
  carousel names it now; the flag is harmless and unused.
- The previous handoff's note stands: record from a `git worktree add --detach`
  copy with its own vite (`vite.wt.config.ts` in the worktree: a `cacheDir` and
  `port` of its own over the base config), and copy any `src/` change into the
  worktree before recording it.

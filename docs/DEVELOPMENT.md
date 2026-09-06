# Development

```
pnpm install
pnpm dev        # astro on :4321 (site + guide), vite on :5199 (app)
pnpm build      # tsc -b + docgen/demogen checks + astro + vite
pnpm lint --fix # oxlint
pnpm test       # vitest
```

`pnpm test` runs the FIR design unit tests, statically validates every WGSL
shader through naga, and holds both hand-drawn views of the pass list to the
arrays in `pipeline.ts` — `docs/graphviz/pipeline.dot` for which passes exist
and which are gated, and the "Pass order" block in `ARCHITECTURE.md` for the
order and the brackets too. CI gates deploy on `pnpm lint` + `pnpm test`.

**`pnpm test` excludes `.claude/`, and the exclude is load-bearing.** Work here
happens in `git worktree` copies under `.claude/worktrees/`, which are full
checkouts with their own `src/`, and vitest's default `include` is a glob over
the whole tree — a run from the primary checkout used to collect 374 test files
against this checkout's 71. The cost that matters is not the time: a
half-finished branch somebody else is working on could fail _your_ run, in files
you have never opened, at paths that look like yours. The exclude spreads
`configDefaults.exclude` in `vite.config.ts`; replacing that array rather than
extending it silently un-excludes `node_modules`.

`pnpm run docs` regenerates every diagram in `docs/graphviz/*.dot` into light
and dark SVGs under `docs/img/` (needs Graphviz `dot` on PATH). The `.dot`
sources hold `@TOKEN@` colour placeholders rather than hex, so one definition
produces both themes — edit the palette in `scripts/diagrams.mjs`, never the
SVGs. `docs:check` compares bytes, so it is a local check rather than a CI gate:
a different Graphviz build emits different SVG.

If you are about to drive a browser at this app, read
[what every browser harness has learned the hard way](#what-every-browser-harness-here-has-learned-the-hard-way)
first. If you are about to measure a performance change, read
[Measuring performance](#measuring-performance) before believing a number.

## Verification harness

```
pnpm harnesses 5199                    # every browser check, one line each
pnpm harnesses 5199 --skip poolcheck   # …without the live one
```

Thirteen harnesses, six to nine minutes — the spread is other work on the box,
and the GPU-heavy arms are what stretch. Start here, because **none of the
harnesses below runs in CI**: the workflow does lint, format, the compiler gate,
typecheck, the unit suite and the build, and every browser check needs Firefox
Nightly with WebGPU, which the runner has not got. So a harness can stop working
and nothing says so — `poolcheck` spent an unknown number of commits failing all
twenty-six of its checks, and `composecheck` spent them reading the chain map's
zoom slider and reporting a CSS layer as broken that was fine. Both were found
by accident.

It reports three outcomes rather than two — `ok`, `FAIL`, and `STALL` for a run
whose window stopped being drawn. A stall measured nothing, so put the window in
front and run it again. It leaves out the device-torture harnesses (they break a
GPU device on purpose), the generators, the two checks that already run in CI,
and the measurements, which report numbers rather than a verdict. `poolcheck`
runs last and is marked, because it is the one entry that can fail for a reason
that is nobody's bug.

### The harnesses

```
node scripts/shot.mjs <url> out.png [waitMs]
```

Drives a headed Firefox Nightly, steps frames deterministically, probes pixels,
saves a screenshot. Headless Chrome can't present WebGPU swap chains here, which
is why it's Firefox.

```
node scripts/colourcheck.mjs [url] [outDir] [--arms=k:v,…] [--arms-file=sheet.json]
```

Does a patch make colour, how much, and in what shape — one sheet of arms
through one page load, with a screenshot each. Its default source is the point:
on the bundled 1929 film a clean arm reads sat 0.018, so any hue on screen was
manufactured by the chain. **Run a colour claim against a saturated source and
the mechanism that makes colour out of nothing reads as one that slightly
reduces it** — a mistake this repo has made once already
([`CURATION.md`](CURATION.md) carries the numbers).

Read the columns against each other. `hues` beside `sat`, because one hue
everywhere and a whole wheel score the same on saturation alone. `edge%` beside
`fringe`, because the first counts pixels on a colour boundary and the second
says how hard those boundaries are — a posterizer holding four enormous flat
fields scores like speckle on `fringe` and nothing like it on `edge%`. And
`motion`, because every other column is one frame, and one frame calls an
evolving look and a frozen one the same thing.

Keep your own sheets in a scratch directory and pass `--arms-file=`. Editing the
arm list in the script is what that option exists to avoid: this repo is worked
in by more than one agent at a time, and an uncommitted edit to a tracked file
does not reliably survive somebody else's commit.

```
node scripts/sourcecheck.mjs [url]
```

Drives the two source pickers and the teletype dialog, which is the half of the
app no other harness can reach: everything else goes in through the query
string, and a link lands in `restoreSession` rather than on the route a hand
takes. Nine load paths, no unit test that can touch them. "The canvas is not
black" would pass all of them, so each step takes a coarse tile signature and
the run fails if the picture did not move.

```
node scripts/fatfinger.mjs [url] [minPx]
```

What a fingertip gets, on every control the panel shows at 390px with the
pointer reported coarse. It walks `elementFromPoint` outward from each control's
centre, because `getBoundingClientRect` is wrong in both directions: it misses
the `::after` expanders that grow a target without moving its neighbours (an
11px ⋮ whose press gets 23), and it counts area a neighbour is painted over.
**The one harness here that drives Chrome**, and it has to — what it measures
only exists under `pointer: coarse`, and CDP's `Emulation.setEmulatedMedia` is
the only way to turn that on from a driver (Firefox's pref does not reach the
content process through puppeteer's BiDi). The floor is WCAG 2.2's 24px rather
than Apple's 44: this panel is 245 rows in a 332px column, and at 44 every one
fails. It reports rather than passes, so `pnpm harnesses` leaves it out.

```
node scripts/bandcheck.mjs [port]
```

Whether the beam profile is beating with the output raster. Colour bars are
constant down each column, so every row-to-row change is the profile and nothing
else, and the check reports the strongest ripple slower than the line pitch. It
walks seven viewports at both device pixel ratios, which is the whole point: **a
scanline fault lives in the window size, and a retina screen carries twice the
pixels per line and hides it** — 8.22% at 7px on a 740x733 canvas, 0.88% on the
same window at 2x. Grain and shading leave about 1.5% at every size, so the
threshold is 3%.

```
node scripts/midicheck.mjs [url]
```

Installs a fake Web MIDI device and drives every kind of binding from it: a knob
on the motion amount, on a preset weight, and on an ordinary control (which must
still take over softly and show its pickup mark). The fake device is installed
with `page.evaluate` after load, never `evaluateOnNewDocument`: under Firefox
BiDi a preload script runs in a sandbox realm, and the app then trips over Xray
vision reading `.length` off a message built on the other side of it.

```
node scripts/traycheck.mjs [port]      # the strip, end to end
node scripts/traylayout.mjs [port]     # does using a chip move anything
node scripts/prerollcheck.mjs [port]   # is the cut cheaper (9ms warm, 58ms cold)
node scripts/faultcheck.mjs [port]     # every transition on the shelf
```

`traycheck` captures three rows off three boards, steps a hold and an arrival
chip, plays, drags a row, and reads the stored rundown back — the wiring between
the pure walk (`ui/strip.test.ts`) and its driver (`ui/stripRun.test.ts`), which
is where it can break with every unit test passing.

`traylayout` asks the other question: not "does the chip work" but "does using
it move anything". A row card is shrink-to-fit and the tray is one horizontal
row of them, so a chip that grows as it steps slides every card to its right out
from under the hand. Two things about its fixture cost a wrong answer once: row
0 carries the _default_ drift, not none, because `cycleHold` preserves drift and
a row at drift 0 never draws the `≈` the widest label has; and the reserves are
checked against the card's ceiling in the same run, since widening a chip is
what once pushed the ✕ out past `overflow: hidden`.

`prerollcheck`'s cold arm has to be genuinely cold — a browser that has already
fetched a url serves the second load out of its HTTP cache, which would make
both arms fast and the check meaningless, so each arm uses its own cache-busting
query.

`faultcheck` asserts the four things the engine claims about a transition: it
breaks the picture, it cuts once inside its own span, it hands the resting board
back untouched, and it resolves. **A fault has exactly one observable, and it is
the picture** — the board is applied and undone inside each frame, so "did it
run" cannot be read off `getControls()`. Two traps come with sampling the canvas
instead: every reading is stated over a measured floor, not against zero (it
read 15-17 when `rest` was captured thirty frames into a signal path whose
phosphor was still filling, so every entry reported the same number whatever its
fault had done); and `getImageData` blocks on the GPU, so it samples a 64x48
downscale every third frame.

```
node scripts/reccheck.mjs [port]     # the encoder and the muxer
node scripts/clockcheck.mjs [port]   # time counted in frames
node scripts/rendercheck.mjs [port]  # a whole take, twice
node scripts/enccheck.mjs            # what the encoder costs — a measurement
node scripts/pullstep.mjs            # what a stepped <video> costs — a measurement
node scripts/codeccheck.mjs          # what the decoder path costs — a measurement
node scripts/demuxcheck.mjs [file…]  # the sample table, against ffprobe
node scripts/pullcheck.mjs           # the right frames, off the real puller
```

The export half of [`EDITOR.md`](EDITOR.md). The checks want `ffprobe` and
`ffmpeg` on the path, because a claim about a file is worth what a decoder says
about it and nothing more.

**`rendercheck.mjs` is the one to run after touching anything in the signal
path.** Two renders of one take come back with the same SHA-256, with 25ms of
real time injected at every yield of the second and the live loop running in
between to dirty the frame store, the phosphor and the PLL. One unseeded
`Math.random` in a per-frame modulator, or one buffer left out of the reset, and
it fails. It is the guard
[`adr/0006`](adr/0006-a-take-is-a-seed-and-its-picks.md) names. Its clip arm
asks the pump whether the deck actually had a decoder on it, because two renders
of a _frozen_ deck are also identical, and it runs last, so a failure in an
earlier arm is the render and a failure only in that one is the video path.
Byte-identity is within one browser build: the H.264 encoder is Firefox's.

`pullcheck` matters because the failure mode of a puller is returning _some_
frame, promptly, forever, and no timing column shows it — so each fixture frame
carries its own index as ten binary cells in the picture. It has a
two-thirds-B-frame arm as the control on presentation order, and asserts the
fixture really has them. `demuxcheck` is the outside check on `ui/mp4demux.ts`,
because hand-built fixtures can be self-consistently wrong where ffprobe cannot
be wrong in the same direction; it is what found that both clips in `public/`
carry edit lists, turning a "decline these" design into an "apply these" one.

`enccheck` is the working-out behind
[`adr/0008`](adr/0008-record-h264-high-and-mind-the-chroma.md) and prints
numbers rather than passing. It never touches the app — every frame it encodes
is synthetic planar YUV — so run it before believing that record against a new
browser. Its source is deliberately harder to compress than the app's picture,
so the Mbps figures are an upper bound and the dB a lower one: **the ordering
between arms is what transfers.**

**A backgrounded window makes a render slow rather than wrong**, and slow enough
to look broken: `renderTake` yields with `setTimeout(0)`, which a browser clamps
to about a second once the window is not in front, so a 120-frame render takes
ten seconds instead of two and puppeteer's default 30s protocol timeout fires as
a bare `ProtocolError` naming nothing. Hence the 240s `protocolTimeout` there.

```
node scripts/deviceloss.mjs <url> [restore|giveup|retry] [outDir]
```

Sleep/wake and driver resets fire `device.lost`, and the session is meant to
rebuild rather than land on `FatalScreen` (**The React layer** in
`ARCHITECTURE.md`). That path needs a real `GPUDevice` to lose, so this injects
the loss through the engine's own `onDeviceLost`. `restore` checks the controls,
the debug tap, B's enable flag and **A's texture dimensions** come back — that
last catches a still silently reverting to bars. `giveup` requires four losses
in a row to stop rebuilding. `retry` stubs `requestAdapter` to fail twice and
then work, plus the case where it never returns. The rebuild lands in about 100
ms, faster than a puppeteer round trip, so the banner check fires the loss and
watches for it inside a single `page.evaluate`.

```
npx vite build --outDir /var/tmp/soak-build
npx vite preview --outDir /var/tmp/soak-build --port 5382
node scripts/soak.mjs http://localhost:5382/ [minutes] [out.json]
```

The freeze this project chased is slow and quiet — a queue growing a few ms a
frame — so it needs a soak rather than a look, on a production build with a clip
playing. Its readings are chosen so different failures cannot look alike:
`droppedToGate` (rAF callbacks the backpressure gate declined; **0** on a device
keeping up), `videoSeconds` (accumulated _positive_ `currentTime` deltas, never
end-minus-start — a looping clip measured over one loop period reads as frozen,
and three A/B runs were once discarded believing that), `lateness`, and the
loop's own verdicts. **Read `onscreenFraction` first**: below ~0.9 the run lost
the foreground and says nothing about rAF.

```
node scripts/contact.mjs candidates.mjs [outDir] [url] [--missing|--only=a,b]
```

Renders a batch of `#set=` patches, scores each, and writes a contact sheet with
a link per tile back to the live patch. Authoring a preset is a search rather
than a derivation, and this makes a round of twenty guesses one command. Results
accumulate in `results.json`, so `--only=` re-renders one retuned candidate and
the sheet keeps everyone else. `mod` takes the same `target:source:rateHz:depth`
string `#mod=` reads — a shipped preset may name routings, and screening it
without them judges a different look.

**It cannot screen an effect that runs on the wall clock.** The harness steps
frames, and `signal/strobe.ts` and `signal/stab.ts` read `performance.now()`, so
which point of the cycle a grab lands on is down to how long the stepping took.
`strobedTube` read `flat, dark` while working perfectly; the tell that it _was_
working is `motion`, 58 against a typical 0.4. To judge one, let the rAF loop
run and sample over a few seconds of real time, taking the screenshot in the
same rAF callback that detects the lit frame — one issued after the check
resolves lands well into the decay.

Budget real time: a candidate is a thousand stepped frames of a patch built to
be expensive, so a full round is an hour or more.

### What every browser harness here has learned the hard way

Every bullet cost a real afternoon.

- **Never `page.setViewport` after load under Firefox BiDi.** It swaps the
  realm, and every later `evaluate` sees `window.vf` as undefined — which reads
  exactly like the app failing to boot. Set the viewport before `goto`, and know
  that even that is not guaranteed: `pixdiff.mjs` lost `vf` to a _pre-`goto`_
  `setViewport`, and puppeteer's `defaultViewport` is the same call under
  another name. **`waitForFunction` does not protect you** — it polls in its own
  realm, so it sees `vf`, passes, and hands you a page whose `evaluate` still
  cannot. A harness that does not need a specific size should ask for none.
- **One Firefox does not survive a long WebGPU batch.** After a dozen or so
  sessions it detaches the frame and every later page dies with "Target closed",
  so a batch recycles browsers. Note the axis: a count of _sessions_, not
  elapsed time — it was once restated as a twelve-minute limit and stood as a
  browser property until two runs held a session past twenty minutes.
- **"Target closed" is three different failures wearing one error.** The frame
  detached, the browser crashed, or something outside killed it, and from Node
  they are indistinguishable. A crash leaves `<profile>/minidumps/*.extra`
  naming the reason and a non-zero exit; an outside kill shows up as
  `signal: 'SIGKILL'`, which no process can send itself. Salvage the minidump
  _before_ `browser.close()`, which deletes the profile it lives in.
- **This box is shared, and neighbours reap browsers.** Any harness that cleans
  up with `pkill firefox` takes yours with it. Before believing a long run's
  death, check the signal and check `journalctl` for launches you did not make.
- **An occluded window throttles rAF to about 1Hz.** Frames are stepped
  (`window.vf.step()`) rather than waited for; a clip, which samples the canvas
  as it paints, has to own the only window on screen. The harnesses that cannot
  step carry `watchFrames` from `scripts/frames.mjs`, and **a visibility event
  is not the signal** — a window merely covered goes on reporting
  `visibilityState: 'visible'`, so counting rAF delivery is what catches the
  common case. `pagehide` is deliberately not listened for: it fires on a
  navigation the harness asked for. A stall exits `STALL_EXIT` (75), which
  `sweep.mjs` reports as its own outcome, because **a window that was clicked
  away measured nothing** and calling it a failure sends the next person hunting
  a bug in a feature that never ran.
- **`setTimeout` is clamped in a backgrounded tab too**, so stepping from an
  in-page loop hits the same wall by the other door — an in-page sampler returns
  three frames for two seconds of wall clock. Drive the loop from **Node**
  whenever a measurement is against the wall clock. `bringToFront()` alone is
  not enough.
- **Serve from a `git worktree add --detach` copy** (or a production build) when
  anything else might be editing the tree. An HMR reload mid-run resets the
  engine under the frame counter. Two workarounds: symlink `node_modules` in and
  run `node_modules/.bin/vite` directly, because `pnpm dev` sees the symlink as
  a modules dir to purge and aborts; and point `cacheDir` somewhere of its own,
  or the worktree and the main checkout re-optimize each other's deps out from
  under a running server.
- **A `file://` image taints the canvas it is drawn on**, so frames are passed
  into the page as `data:` URIs.
- **Puppeteer writes its throwaway Firefox profile into `$TMPDIR`**, ~85 MB a
  run, and never cleans up after a killed one. On a tmpfs that has filled, the
  launch dies in `createProfile` with `Unknown system error -122` — that is
  `EDQUOT`, it names no path, and it reads as a puppeteer bug rather than a full
  disk. Nearby writes go quiet first: redirected output lands as an empty file
  and the command still reports success. Point `TMPDIR=` somewhere on disk.
- **`#set=` silently drops any key the schema doesn't know**, so a typo costs a
  full render and comes back looking merely uninteresting rather than wrong.
- **Don't forward every page console message.** React's dev build logs a line
  per component per render, and shipping all of them back over BiDi stalls a
  harness mid-run — it hangs on an `evaluate` that never returns, which reads as
  the app deadlocking rather than the transport drowning.
- **A fixed `wait()` is right for what has already happened by the next line,
  and wrong for anything on the browser's own clock.** Clicks and React renders
  are the first kind. The second is anything waiting on a decoder, a `play()`
  promise, a live archive, or a rendered frame — and **rAF-clocked app state is
  in that set**, because an occluded window throttles frames, so a morph or a
  hold bar can simply not have moved yet. `traycheck.mjs` had one of each and
  both read as broken features.

  `scripts/until.mjs` is the answer, covered by `until.test.mjs` without a
  browser. Two properties are load-bearing: it **hands the last reading back
  rather than throwing**, so a genuine failure is one failed check with the
  value in it rather than a `TimeoutError` abandoning the twenty assertions
  after it; and **`appUp(page, ms)` polls through `page.evaluate`**, which is
  the realm the harness will actually use. The exceptions keep their sleeps —
  `deviceloss`, `devicetear`, `gpusleep`, `rafceiling` and `soak`, where the
  waiting _is_ the measurement.

- **`element.click()` reaches a button a hand cannot.** It does no hit-testing,
  so a control scrolled or clipped out of its container goes on passing every
  check that presses it. If a layout can put a control out of reach, one
  assertion has to _measure_ rather than click.
- **A click that finds nothing must fail where it happened.** These scripts find
  buttons by their text, so a chip that is missing makes the click a silent
  no-op and the _next_ few assertions fail instead, in features nothing has
  touched.
- **The panel mounts one stage at a time, and none is open on arrival.** A
  deck's picker, its ★, and every control row exist only while their stage is
  open — so a harness that goes straight to `querySelector` after boot finds
  nothing, or worse finds something else. It cost two harnesses silently:
  `poolcheck` read `null` for the picker and failed all twenty-six checks at
  once, and `composecheck` fell through to the chain map's own zoom slider and
  reported a CSS layer as having lost when it had never been consulted. Open it
  first, the way `sourcecheck.ensureDeck` does — the boxes are
  `<g role=button>`, so dispatch the click on the element rather than aiming at
  a coordinate. They **toggle**, so ask whether what you want is already there.
  And prefer opening by _what a stage contains_ over opening by name, because a
  harness that fails on a rename fails somewhere unrelated to the rename.

## Measuring performance

```
pnpm gpuprof                                   # stock: GPU time per pass, headless
pnpm gpuprof --preset=<name> --set=k=v,k=v     # a look
pnpm gpuprof --ablate=<pass>                   # the ablation upper bound
pnpm gpuprof --dump=<path> ; pnpm gpuprof:cmp <a> <b>   # is an arm pixel-exact?
node scripts/perf.mjs <url> <label> [batches] [framesPerBatch]
node scripts/pixdiff.mjs <urlA> <urlB> [frames]
node scripts/cpuprof.mjs <url> <label> [s] --scenario=idle|allrows|drag
```

[`OPTIMIZATIONS.md`](OPTIMIZATIONS.md) is what these measurements decided. This
is how to take one.

**Per-pass GPU time first, headless.** `scripts/gpuprof` stands the compute
graph up under Deno, whose WebGPU is wgpu — the implementation under Firefox
Nightly — on the same card, and times every pass with timestamp queries. No
window, nothing to steal the screen, and the number is the GPU's own counter
around each pass rather than wall time around a frame, so it resolves a tenth of
a millisecond the batch harness cannot. wgpu hands the counters back as raw
ticks (40 ns on the WX 3200), so the run calibrates the tick from the GPU
clock's own frame period and prints it; `--tick=` pins it.

**It is a model of the engine's graph rather than the engine**, so the mirror
drifts. `pipeline.ts` stays the authority and `gpuprof/graph.ts` mirrors it by
the binding names each shader declares. It had drifted five ways by the time
anyone next ran it, in three classes:

- **A binding a pass never supplied** — throws at construction, which is what
  the binding reflection is for, and costs a minute each.
- **A buffer sized short of what a shader indexes.** The timing buffer stopped
  two floats below the VIR corrector's integrators, so `vir` wrote out of bounds
  — and a storage buffer discards that silently, so the corrector did nothing
  with no error anywhere. Nothing catches this class: **when a pass grows a
  buffer, check the size against the index constants in the prelude yourself.**
- **A uniform the graph never filled in.** A missing field reads `undefined`,
  packs as NaN, and a NaN in the composite covers the whole raster within a pass
  or two. The symptom is a black frame, indistinguishable from a look that
  renders black on purpose — four presets sat in a survey at `mean 0.0, sd 0.0`.
  `packParams` now names a non-finite field on the console once, which found two
  more the same afternoon. Type checking does not help: `deno check` reports
  nothing, because the modules it imports fail to resolve first and the call
  degrades to `any`.

So run it after any pass-graph change, not only when you want a number, and read
the console. Then confirm a win in Firefox with `perf.mjs` once — and only once,
it takes the screen.

**`perf.mjs` is best-of wall clock over batched `vf.step()` runs.** Interleave
base and patched in one sitting and compare the best, not the median: contention
and thermals only ever add time, so the noise is one-sided.

**The ~0.8 ms bimodality is another GPU client.** Cost here reads as two stable
modes that land on whole batches, which looks like something in the app and is
not. The clocks are innocent — the WX 3200 pins at its top DPM level from the
first batch and holds it. What reproduces the modes is a neighbour: a second
stepped session costs **+3.6 ms**, one idle app tab left presenting costs
**+0.17 ms**. Contention flips whole batches while leaving `best` alone, which
is why the median lies and why `perf.mjs` prints every batch. Two spellings of
the same shader will "differ" by 0.8 ms all day if you let them.

**`--ablate` ranks passes. It does not size them, and its deltas read like the
most precise number on screen.** `crt_face`'s scatter gather was recorded from
one at 0.9 ms and is 0.30. A delta is a subtraction against a baseline that
drifts within the session, so `min(full) - min(ablated)` loaded all of the
baseline's noise into every row. It now subtracts per round and takes the
median, which fixes the drift term and not the rest; small passes still range
and get marked SHAKY, and a pass cheaper than the noise can come out negative.
**To size a change, A/B two builds** — one dev server per arm off its own
worktree, whole frames, best-of, interleaved. That held to 0.001 ms over three
rounds on a change the ablate delta could not resolve at all.

**Batch throughput is not live frame rate.** The batch number is the GPU
saturated; what a user sees is the rAF loop, paced by the display, carrying
costs the batch never meets — video decode and upload land there, and on the dev
box every present crosses PCIe. Two playing clips cost more live frame rate than
the heaviest preset does. Measure live rate via `vf.frameNo()` deltas over
multi-second windows with video sources attached, and note the app's own fps
readout reports loop cadence, which vsync steps down in jumps (48 → 24 on the
dev panel) rather than sliding.

**The main thread is the third measurement, and the two above cannot see it.**
`scripts/cpuprof.mjs` samples it under Chrome — deliberately not Firefox,
because the largest thing it has found was a browser difference that would have
read as zero on Firefox. Two rules: **point it at a built app**, because a
dev-build profile of this app is mostly React's development machinery (the same
drag falls to 24 fps with 43% of the thread in `jsxDEV` and friends); and **read
`TaskDuration` per frame, never fps**, because the loop is vsync-capped, so a
fifth of the budget goes before a frame is missed. `--scenario=drag` names its
control (`--control=`) so two arms drag the same one.

**`pixdiff.mjs` is what makes an approximation honest.** It reports the tail of
the error distribution as well as the peak, because a thinned kernel fails as
banding — a few units of error over a wide area, which a peak-error number waves
straight through. **Establish the floor first**: point both URLs at the same
server and confirm `max 0`. It does reach exactly 0, so a nonzero floor means
the protocol drifted. Three things drift it, and all produce a stable,
convincing, wrong number:

- **Feedback state.** Each session accumulates a different frame count before
  `loop.stop()`, and a look with memory never forgets the difference — on
  `lightThatStays` the floor is mean 0.7/255 with peaks of 212. Add
  `#set=phosphor:0,phosphorBleed:0`.
- **Field parity.** The engine is bistable on it, decided by the same coin-flip
  frame count. The tell is a floor that is either exactly 0 or exactly mean
  ~0.6/255 with `max 108` at one fixed pixel, never anything between. The script
  cancels it by grabbing two consecutive frames per arm.
- **A flipped polarity, which no protocol fixes.** `aPolarity` or `bPolarity` up
  makes the picture differ between two sessions of the **same build** on a
  seeded `startTake`: an inverted composite denies the sync separator its lock,
  and the free-running flywheel amplifies whatever the two sessions did not
  share. Pick a board without one. This is a real gap in what a take promises,
  not only a harness problem — two renders of a look with a polarity flip in it
  are not the same file.

Measure an ablation upper bound before building any optimization here: three
were built, measured dead flat and reverted
([ADR 0007](adr/0007-the-fir-passes-are-not-alu-bound.md)). The same rule caught
a startup one before it was written. The `Engine` constructor makes 22 blocking
`createComputePipeline` calls, which looks like an obvious
`createComputePipelineAsync` job. Timed in place first:

```
PLBUILD n=22 sync=9.0ms syncWarm=2.0ms asyncParallel=396.0ms
```

**9 ms is the entire upper bound**, and the refactor would have meant splitting
construction in two, because the constructor consumes the pipelines to build the
pass graph. The async arm is the more interesting half and wants its caveat: 396
ms is not 44× the _work_ — that arm ran after boot against a live render loop,
and 396/22 ≈ 18 ms a pipeline is suspiciously close to one frame, so most of it
is each promise settling a turn of the event loop later. At startup there is no
loop yet. But `syncWarm` ran under identical conditions and took 2 ms, so
whatever the async path waits for, the synchronous one does not. Worth
re-running if a future browser build changes how it schedules; the scaffold is
four lines of `performance.now()`.

### Chrome

WebGPU in Chrome on Linux needs flags:

```
google-chrome --enable-unsafe-webgpu --enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE
```

On the dev box the engine runs clean under those flags — zero validation errors,
full-speed loop — but the WebGPU canvas never composites: the page shows a black
picture while `frameNo()` advances. Validate functionally instead, by reading a
texture back over `copyTextureToBuffer` (the app's textures don't carry
`COPY_SRC`, so patch `GPUDevice.prototype.createTexture` at page init), and
treat ANGLE's texture-allocation reports as the driver artifact `CLAUDE.md`
describes. Chrome is also the only browser with `importExternalTexture`, so the
zero-copy video path only runs there — `#vidbitmap` forces the bitmap path when
the two need comparing in one browser.

## Documentation screenshots

Every figure in [`GETTING-STARTED.md`](GETTING-STARTED.md) and
[`USER-GUIDE.md`](USER-GUIDE.md), plus the two shots behind the README's
signal-path figure, is captured from the running app:

```
pnpm docshots                    # all of them, into docs/img/
pnpm docshots chain look-loop    # just these
pnpm docshots --force            # rewrite even unchanged shots
pnpm docshots:check              # which ones are behind the app
pnpm docshots --freeze look-loop # capture, then record the look it landed on
pnpm docshots --upload clip-feedback
pnpm callout                     # recompose docs/img/signal-path-callout.jpg
```

It runs against `localhost:5199/app/` and starts a dev server itself if nothing
is serving there. Needs Firefox Nightly, ImageMagick, ffmpeg (clips) and
pngquant (optional).

Shots are declared in
[`../scripts/docshot-specs.mjs`](../scripts/docshot-specs.mjs) — a URL, the
actions that put the app in the state being documented, and the red callouts
drawn over the result. Callouts and crops resolve against live elements at
capture time, so nothing is a hand-measured pixel offset. Captures run at 2x as
JPEG, or PNG when a shot is UI rather than picture. The runner refuses to save a
dead-black frame or one with the stage's error banner up. `--freeze` writes what
the address bar said into `scripts/docshot-frozen.json`, and that entry then
wins over the spec's own params.

**Staleness is stamped, not compared.** `docs:check` and `docgen:check`
regenerate and compare; a screenshot cannot, because comparing means
recapturing, which needs Firefox Nightly, a GPU and a minute — which is how
`chain.jpg` spent two releases showing a stage that had been renamed. So every
capture stamps the app version and commit into `docs/img/shots.json` and
`pnpm docshots:check` reads it back, headless and in CI. It fires **once per
release**: each shot prints the masthead with the version in it, so a release
dates them whether or not the panel moved. Only shots with the app's chrome in
them are checked, read off the spec (`crop: 'canvas'`, or a `video`), because
flagging all eleven canvas tiles every release is how a check stops being read.

`shots.json` also holds the app's own address bar at the moment of each capture,
which is what puts the "open this in the app" link under every figure on the
docs site — read back from the live session rather than rebuilt from the spec,
so it holds even for a shot whose look the app rolled itself.

**The bar for adding a figure is high, and it used to be lower.** Twelve UI
shots, each a full window with a red box round a 300px strip, stacked down a
page were 15,000 pixels of screenshot saying what the prose already said. What
remains carries something a sentence cannot: `overview` labels the four regions
at once, `chain` shows a map you would not guess the shape of, `slider-help` is
the guide's own argument for why there is no per-control reference in it, and
`strip` draws a row card. Reach for a tight crop of the region rather than
another boxed window.

The `look-*` gallery shots are one named mechanism each, pushed well past where
its preset stops. What a tile has to have is structure the chain made rather
than a subject that came through. The three failure modes are full white, full
black and undifferentiated hash, and every patch sits one control away from all
three, so a change wants looking at.

## Recording an agent driving the app

[`AI-USAGE.md`](AI-USAGE.md) claims this app is built to be played by an agent,
and prose is the one thing a reader cannot check. `pnpm agentreel` records a
real Claude Code session driving the real app in a real Chrome, with both
windows in one frame:

```
pnpm agentreel                        # the default palette task, into clips/
pnpm agentreel --upload               # and send it where the docs point
pnpm agentreel --model=opus           # a different model at the keys
pnpm agentreel --task=/tmp/ask.txt    # a different sentence to carry out
pnpm agentreel --keep                 # keep the terminal log and the raw grab
```

Needs Xvfb, xterm, xdotool, ffmpeg, Chrome, and a logged-in `claude`. It costs
real tokens — a run is a minute or two of session and a dollar or so. **Nothing
in the timeline is scripted**, which is what the recording is evidence of; the
script sets the stage, opens the shutter, and stops when the session lands. Five
things it had to get right, each of which cost a wrong answer:

- **A nested X display, not the desktop.** This box is GNOME on Wayland, where
  `x11grab` against `:0` grabs nothing — mutter composites outside X, so the
  root window a screen grab reads is empty.
- **Chrome loses WebGPU on an Xvfb unless told otherwise.** Its default path
  opens the DRM _card_ node, which a desktop session's ACLs do not grant, and
  the app's "this page keeps rebuilding its GPU engine" banner is what that
  looks like from outside. `GPU_ARGS` routes it through Vulkan on the render
  node.
- **The prompt goes before any variadic flag.** `--disallowedTools` and
  `--mcp-config` both keep eating arguments until the next flag, so a prompt
  written after one is read as a tool name — the first take is four minutes of
  Claude Code sitting at an empty prompt.
- **The end is the terminal going quiet, not the last click.** The sheet the
  task ends on opens while the model is still writing what it says, which is the
  sentence worth recording.
- **The stop condition asks by accessible name**,
  `[aria-label="board as text"]`. Asked for as a `<dialog>` it broke silently
  the week those sheets moved into the sidebar, and a broken stop condition
  looks exactly like a model that never finished.

**The rows in the default task are the ones the reel already screened.** The
first take typed `head switch 9` and `noise 12`, which are real edits and read
on camera as almost nothing. Off thirty-six rows tried one at a time on the same
photograph: most of the panel reads as nothing alone; sync suppression,
subcarrier detune and chroma gain read on their own and better stacked; HV sag
and supply ring shear the result once it is already coming apart. Write a new
task against that list rather than against the schema.

The clip lands in gitignored `clips/`, and with `--upload` at
`https://myloveydove.com/videoskillet/agent-drive.mp4`. The poster is committed,
taken three seconds before the board sheet opens — the last frame is the wrong
one, because the sheet takes the sidebar and the thumbnail a reader decides on
is half a column of text. No GIF: this recording as one is 45MB against an mp4
at five, since 1920 pixels of live analog grain is the worst case a
palette-indexed format has.

## The landing page

[`../site/pages/index.astro`](../site/pages/index.astro), built by Astro with
the guide. Nothing on it is written by hand: the hero, the carousel and the
gallery map over two lists, so adding a demo or a slide means adding it to a
list and recording it.

```
pnpm demoreel                    # the gallery's clips (the canvas alone)
pnpm reel                        # the carousel's clips (the whole window, both frames)
pnpm reel orb                    # just this slide
pnpm reel:check                  # which slides show an older app
pnpm demos                       # rewrite the README's generated demo bullets
pnpm demos:check                 # fail if the checked-in copy is stale
```

[`../demos.json`](../demos.json) is the looks — the README's bullets and the
gallery of cards, each opening the exact board its clip is a recording of.
Entries carry flags: `showcase` is the ones the carousel may play; `gallery` is
whether it gets a card; `says` is the clause under the name. The header and the
link preview are no demo's still any more:
[`../scripts/heroplate.mjs`](../scripts/heroplate.mjs) sets the headline in the
h1's own typeface, photographs it, runs the plate through the app and reads the
canvas back, so the words on the page are a picture of what the program does to
words. The link-preview card is the same render with the mark and the wordmark
drawn onto the plate beside them, which is why they carry the same fringe.
[`../scripts/reel.mjs`](../scripts/reel.mjs) is the carousel, which records the
**app's own window** instead — the panel, the map and a pointer moving over
them. That split is the point of the page: the picture is what the program
makes, and the window is what the program _is_.

**Every card says which mechanism it is** — "a composite loop 2.9µs long,
ringing at 0.8 MHz" rather than a name. Those lines are read off the look
itself, by `unpackControls` against `DEFAULT_CONTROLS`, which is the same list
the app's own "N off stock" shows.

Four things about recording them:

- **Both harnesses capture by stepping, not by streaming.** Each takes a
  screenshot per output frame after stepping the engine a fixed number of
  frames, so a clip is exactly its `FPS` whatever the box was doing. JPEG
  intermediates, at 96 ms a frame against PNG's 314 ms. `demoreel.mjs` used
  `captureStream` until the clips were measured: it samples on paint, so **42 to
  79 per cent of every shipped clip was a frozen frame**. Stepped, the same look
  runs 0 per cent frozen at ten times the mean motion. That also means **a low
  motion reading is evidence about the recorder before it is evidence about the
  look** — `Camera feedback + static` runs at 10.1 stepped against the 0.033
  that shipped.
- **Screening a canvas needs the frame grabbed in the task that rendered it.** A
  `drawImage` off the WebGPU canvas after a wall-clock wait reads black, so a
  sheet with black tiles on it is the probe rather than the look.
- **Every slide is recorded twice.** A 1112px window is what the page's wide
  measure gives a slide; that same window scaled into a phone's 356px column is
  a picture of an interface rather than an interface, with the panel's labels at
  4px. So there is a second take at 390x620, where the app lays itself out in
  portrait and Firefox is told to report a coarse primary pointer. The hand in
  those is a fingertip rather than an arrow, because an OS cursor in a phone
  screenshot is a picture of something that does not happen. The breakpoint is
  written down **once**, in `NARROW.at`: `Carousel.astro` puts it in the
  `<source media>` of the stage's first still, the browser picks the still
  through it, the stage takes its shape from that still, and the page reads the
  same string back to choose which clips to play.
- **The pointer is drawn into the page and the clicks under it are real**, since
  a screenshot never contains the OS cursor. A timeline has to **end where it
  began**, because these loop. And the sidebar scrolls as one column, so a
  control row below the fold is reached with a `scrollTo` beat rather than
  `scrollIntoView`, whose jump between two stepped frames is the one cut a
  recording cannot hide.

**What a timeline should show** is a taste question the reel was rewritten
around after every slide was judged weak. Things have to combo: each pull lands
on a picture the last one already changed, because most of the panel reads as
nothing alone. The hand moves fast — a glide onto a control is 0.2-0.35 s, a
press dwells 0.4 s, a drag takes 0.5-0.7 s. And a preset chip is a fader, so two
chips part way in are a look neither is alone, where the same pair at full
strength is an op-art spiral with no subject left in it. The screening behind
each timeline is in
[`handoffs/2026-09-04-the-reel-on-the-edge-of-chaos.md`](handoffs/2026-09-04-the-reel-on-the-edge-of-chaos.md).

Both harnesses want the dev server, ffmpeg and cwebp, and a browser — Chrome on
macOS, Firefox Nightly elsewhere. Both take `--keep` to leave the JPEG frames on
disk, which is what makes an encode knob worth trying more than once without
driving the browser again. The carousel's mp4s do not live in the repo:
`pnpm reel` uploads each to `s3://myloveydove.com/videoskillet/reel/`, and only
the stills land in `public/reel`. Staleness works the way the docshots' does —
each run stamps the version and commit into `scripts/reel-taken.json`. Element
resolution, seeding and the actions are shared with the documentation
screenshots ([`../scripts/drive.mjs`](../scripts/drive.mjs)).

### What the page costs

Above the fold a first visit fetches **8K of media**, the header's still, which
is a gallery card's own frame. It used to be 382K, because the header ran a
clip. The stage is under the fold and costs nothing until scrolled to; reaching
it fetches `roll`'s still (242K) and its clip (1.9M), and walking the other two
adds 5.6M on a desktop, 1.5M on a phone. `build` is 2.4M of that and it is not
an oversight: sixteen seconds of full-frame moving rainbow is what building a
look from a clean board looks like.

- **crf 36, not 30.** The panel half of the frame is static, so h264 codes it
  once and raising the quantizer spends its losses almost entirely on the
  picture: the 11px labels at 36 are the same pixels as at 30, and the heaviest
  slide went 645K to 268K. What 38 and 40 take is the fine dropout speckle,
  which is the thing the app is for. Per-slide crf was tried and removed —
  36/38/40/42 is 871/782/695/618K, so running to the edge buys 29%, and smooth
  gradient is precisely where a raised quantizer bands.
- **One file per slide, no `<source>` fallbacks.** Neither AV1 (crf 50: 290K)
  nor VP9 (crf 42: 1.6M) beat x264 at crf 38's 213K — a field of analog noise is
  where AV1's tools have least to work with. Dropping the frame rate saves
  nothing: CRF is normalized against time.
- **Nothing is fetched for a slide nobody is looking at**, stills included.
  `loading="lazy"` does not defer those, so they arrive on a `data-src` the page
  sets when their slide comes up — 195K that used to be spent before anybody had
  touched a tab.

**Both the stage and the gallery open the clip before it is wanted.** Opening a
clip is not the same as being able to show one, and that gap made the page feel
unresponsive twice: a gallery card opening its clip on hover took 233-488 ms to
a first frame, and a carousel tab pressed before its clip was open was 770 ms of
a still. Opened ahead, both are **1-2 ms**. Three things make it work. `preload`
has to come off the markup's `none` as well as the source being set, or the clip
sits at readyState 0. `metadata` for a card and `auto` for the next slide —
`metadata` is Chrome's cue to stop as soon as it has frames, the whole gallery
for 279K (Firefox takes the whole file on either word, which is why a screenful
of cards is 1.8M there). And one slide ahead, not all of them, since these are
2-3M each. The gallery's look-ahead waits for `load` and an idle callback, which
is not politeness: the stage sits 541px down a 950px window, so a `rootMargin`
wide enough to be a look-ahead reaches the gallery from up there and three cards
were opening alongside the picture in front of the reader.

## Docs site

`pnpm guide` (also run by `pnpm build`) renders the reader-facing markdown into
`dist/guide/`, which Pages serves at `/guide/`. Markdown stays the source of
truth and stays readable on GitHub; the site adds the nav, the live links and
the styling. It is an Astro project rooted at [`../site`](../site), with `docs/`
as a content collection. To add a page, add it to `GUIDE` or `NOTES` in
[`../site/lib/pages.mjs`](../site/lib/pages.mjs) — the decision records and the
handoffs are read off their own directories, so one of those is a page as soon
as it is a file.

Astro builds `dist/` first and vite adds the app entries to what it left, which
is why vite's `emptyOutDir` is off.

**Two dev servers, one front door.** `pnpm dev` starts both: Astro on 4321 and
vite on 5199. They are two servers because each only knows how to serve its own
half — vite cannot render an `.astro` page, and Astro's dev server injects
`/@vite/client` into every page it serves, which is a path that means something
else on vite's. Proxying the document alone hands the browser a page whose
scripts resolve against the wrong server, so
[`../vite-plugin-site.ts`](../vite-plugin-site.ts) redirects `/` and `/guide/…`
from 5199 to 4321 instead. `pnpm site:dev` starts Astro's alone. The harnesses
point at 5199 and drive `/app/`, which is unaffected.

Everything the site chrome shows is **derived from the markdown, never authored
twice**: the "on this page" nav from the h2/h3 outline
([`../site/lib/rehype-guide.mjs`](../site/lib/rehype-guide.mjs) collects it
while setting the heading ids; pages with fewer than five sections don't get
one), the previous/next pager from the order of the page's own group, the meta
description and `og:` tags from each page's first paragraph, and the "open this
in the app" link under a figure, joined to `docs/img/shots.json` on the image's
filename. The figures are copied flat into `dist/guide/img/` rather than handed
to Astro's asset pipeline, because `shots.json` joins on the bare filename.

Every address is site-absolute and ends in a slash: a page is a directory with
an index in it, and `pages.mjs` is the one place that turns a slug into that
address. The slugs stay flat — an ADR is `adr-0004-…`, not a page inside `adr/`
— so every page is one level deep and reaches the figures at `/guide/img/` from
the same distance. A relative href would have to know that depth.

The site has one theme and it is dark, so the renderer collapses each diagram's
`<picture>` down to the dark SVG; left alone, `prefers-color-scheme` would hand
a light-mode visitor pale pastel diagrams on a near-black page. Two things the
CSS can't reach are done by a small inline script — opening the section nav only
at the width where it is a sidebar, and marking the section being read — and
both are enhancements. The stylesheet and that script are inlined into every
page deliberately: it is a handful of static pages, and inlining leaves each one
renderable straight off the filesystem.

`.astro` files are formatted by prettier (wired into `pnpm format`); oxfmt has
no astro parser, so its options are repeated in `.prettierrc.mjs`. They are
**not typechecked**: that wants `astro check`, which needs a TypeScript API that
TypeScript 7 does not expose yet (withastro/roadmap#1321). The same blocker
leaves the tests under `site/` unchecked.

```
pnpm distcheck      # serve dist/ and load every page — 404s, console errors, broken images
pnpm guide:check    # build, then load every page at 1352px and at 390px
```

`distcheck` exists because everything else about a build is checked by looking
at files, which is how the fatal screen came to poster its clip with a file that
had never existed — the only evidence was a 404 in a log nobody read. It serves
the directory the deploy uploads rather than running `pnpm preview`, because a
page that works only because a dev server rewrote something for it is broken on
Pages.

`guide:check` fails on anything wider than the viewport that isn't a deliberate
scroll container, and leaves screenshots in `/tmp/guidecheck`. The phone arm is
the one that earns its keep: the desktop layout has slack in it, 390px does not,
and both faults the redesign fixed were invisible on a laptop — a nav row that
wrapped three deep and stuck there, and a two-column table crushed to two words
a line.

## Video URL source (dev server only)

The **Video URL…** source fetches `/yt?url=…`, a Vite middleware
([`vite-plugin-ytdlp.ts`](../vite-plugin-ytdlp.ts)) that shells out to `yt-dlp`.
It's `apply: 'serve'`, so it exists under `pnpm dev` only. Any site `yt-dlp` has
an extractor for works; the guard on the endpoint is the scheme, which keeps it
from being pointed at a local path or handed something that reads as a flag. The
reply is served under the type of the file `yt-dlp` actually wrote, since a
generic extractor can hand back webm as easily as mp4.

Setup is the binaries on `PATH`: `yt-dlp --version`, and `ffmpeg -version` for
sites that publish video and audio apart. Clips are capped at 480 lines, which
is what the chain downscales to anyway, and the selector asks for h264 before
av1 (the picture is decoded every frame, and h264 is hardware everywhere) and
for a single file carrying its own audio before a merge. Downloads are cached in
`$TMPDIR/videoskillet.js-yt`, keyed by URL, format selector _and_ range.

`/yt/progress?url=…` is a server-sent event stream carrying
`{loaded, total, stage}` off yt-dlp's own `--progress-template` lines, which the
app opens beside the fetch and closes when that settles, so the caption counts
bytes in the same words the archive.org download uses. A merge has no bytes to
report and says `merging…` instead.

**Ranges are slower per second and offered anyway.** A range makes yt-dlp cut
with ffmpeg over the site's streaming ladder rather than pull the format
straight: **39s for the first minute against 18.7s for the whole 38 MB file**.
So nothing asks for a range by default; it pays off on a two-hour film.

A URL that loads is added to the clip library as a third kind of entry beside
disk clips and kept rolls (`at: 'ytdlp'`). It keeps the address rather than the
bytes, so clicking the row fetches it again, which is instant while the bridge
still has the download. The range is part of the entry's identity, so the same
film trimmed and whole are two rows, exactly as they are two files in the cache.

## The public archives (the one live dependency)

**Random Commons** searches `commons.wikimedia.org/w/api.php` and **Random
archive.org** searches `archive.org/advancedsearch.php`, both anonymously — no
proxy and no dev middleware, so unlike the yt-dlp bridge these work in the
deployed build. **Browse…** is the same two APIs asked a different question:
ranked rather than random.

The layering:

- `src/sources/pool.ts` — what the two have in common. `PoolPick` is the one
  type both roll, and the two real differences ride on it as fields. It also
  holds what has been downloaded, in two tiers — 96 MB in memory,
  least-recently-played out, over 256 MB in a Cache API store,
  least-recently-downloaded out. Measured per read: memory 0ms, disk 1ms to
  match then ~2.8ms/MB to materialise, network 3-20s. Keyed by the file url
  rather than the identifier, since a roll and a shelf entry read one item under
  different byte caps. Nothing there is load-bearing: no `caches`, a private
  window, a full quota or a corrupt entry all fall through to a download. The
  disk budget is a slice rather than the lot, because the origin quota was
  measured at 1.6 GB here and is shared with the file stash, which copies the
  user's own clip into OPFS — their footage outranks a re-downloadable advert.
- `src/sources/commons.ts`, `archive.ts` — one flat list of tested query pools
  each, plus the readers that vet a response. Neither knows the other exists.
- `src/sources/pools.ts` — the front door. Everything above imports from here
  and never from the two modules under it, which keeps the engine to one roll,
  one resolve and one state slot per deck.
- `src/ui/clipLibrary.ts` — the shelf. There is no separate favourites store; a
  kept roll is the easy case of a clip, with no handle, no grant and no re-link.

```
node scripts/poolcheck.mjs http://localhost:5199/app
```

Eighteen checks over one browser session and a handful of live requests. Run it
when touching either source module, or when a pick starts coming back empty.
Four things it watches are outside this project and invisible to the test suite:
Commons changing its mind about `descriptionurl` or `gsrsort=random`, its
transcode ladder being rebuilt, archive.org's `sort[]=random` ceasing to be
stably seeded (which is what `PAGE_SPAN` exists for), and
`archive.org/services/img/` going away — that last is what lets the browser show
a clip without downloading it, and its loss would turn the grid into a page of
empty boxes with nothing else complaining.

**Why archive.org picks are downloaded whole rather than streamed.**
`/metadata/` and `advancedsearch.php` both send
`access-control-allow-origin: *`, but `/download/` and `/serve/` 302 to a
storage node that sends no `access-control-*` header at all — so with
`crossOrigin='anonymous'`, which `ui/videoSlot.ts` sets unconditionally, the
element does not merely taint, it **refuses to load**. `/cors/<id>/<file>` is
the route that works. The catch is that **`/cors/` ignores `Range`** — it
answers `bytes=0-1000` with 200 and the whole file — so `video.seekable` only
covers what has downloaded and a far seek is **silently clamped**: no error, no
`seeking` event, playback carries on. On a 628 s clip, `seekable [[0, 4.3]]` and
`currentTime = 502.4` read back as `4.3`. That breaks cue loops and scrub, not
playback, which is why it is easy to miss. Fetching to a Blob and handing over
an object URL fixes it — same-origin, so fully seekable _and_ untainted — at the
cost of the whole file up front at ~5 MB/s, which is what the size cap is for.

Two more archive.org failures that look like nothing. **Theora is gone from
browsers and is usually the smallest file in the ladder**, so any "prefer small"
rule reaches straight for it — `canPlayType('video/ogg')` is now `''` and the
element does not error, it fires `loadeddata` and reports `videoWidth` of **0**.
And **`archive.org/metadata/<id>` intermittently takes 33 s** and then returns
no `files` at all; without a per-request deadline these stack and a roll looks
like a hang.

**Picking a rendition:** `h.264 IA` (the newer `.ia.mp4`) is the derivative most
items carry and is usually the small one — 3 MB against an 89 MB master of the
same commercial. Filtering on `h.264` alone, the obvious guess, matched 1 item
in 5; adding `h.264 IA` took the same pools to 3–4 in 5. Every numeric field
arrives as a _string_ and `length` is sometimes a timestamp, so `Number()` gives
NaN.

**Pool yields, measured by rolling the live APIs.** archive.org, usable items
per random sample at a 24 MB cap: `vhsopenings` 7/11, `vhscommercials` 7/11,
`classic_tv_commercials` 9/13 — all 15–30 s idents, logos and ads. `prelinger`
needs a 64 MB cap and still lands only ~3/11. Empty or useless: `vhskids`,
`vhsmovies`, `machinima`, `computerchronicles`, `educationalfilms`. Commons,
counting pages whose derivatives hold a `transcodekey`:
`deepcat:"Time-lapse videos"`, `"Videos of fountains"`, `"Videos of clouds"`,
`"Videos of fire"` and `"Videos of trains"` all 12/12, `"Videos of animals"`
11/12, `"Underwater videos"` 9/12. **`"Videos of cities at night"`,
`"Videos of waves"` and `"Videos of aurorae"` return zero pages** — don't add
them back; their absence is why the video channels carry none of the neon the
photo channels lean on. Video pools being this much thinner than photo pools is
the whole argument for archive.org as the video source. The Commons API 429s
after roughly ten quick probes.

Two fields the browser leans on are optional, and neither failing would look
like a failure: Commons returns a clip's `duration` alongside the thumbnail,
where archive.org's search returns `runtime` on roughly one item in three. What
that search will _not_ honestly tell you is how big a pick is — `item_size`
counts every file in the item and was measured between 1.0x and 2176x the
rendition a roll would download, so the size comes from the metadata read at
pick time instead.

## URL parameters

A link specifies a look. The address bar carries the readable form —
`#set=noiseIre:9`, every control that left stock, by name — so a look on screen
can be read off it, edited in place, or handed to a harness. **share** in the
app writes the other one: `#p=`, the same controls packed into bytes
(`src/ui/packed.ts`) and four times shorter.

Both live after the `#`, and the app writes nothing to the query. The hash never
reaches the server, so a look is not in anyone's request log and each shared one
is no longer its own cache key. Every link written before this carries `?` and
still opens: `pageSearch()` reads the hash when there is one and the query
otherwise, and the first write of such a session moves it across. The catch is
that a hash change on an open page does not reload it, so `useUrlState` listens
for `hashchange` and reloads — which is what the query used to do for free.

| Param                | Meaning                                                |
| -------------------- | ------------------------------------------------------ |
| `#preset=`           | load a built-in preset by name                         |
| `#p=`                | the same controls packed into bytes — what a share has |
| `#set=key:value,…`   | the look by name — what the bar carries                |
| `#mod=t:src:hz:d,…`  | modulation routings (target, source, rate, depth)      |
| `#iurl=` / `#iurlb=` | image source A / B                                     |
| `#vurl=` / `#vurlb=` | video file address for A / B, played as-is             |
| `#src=` / `#srcb=`   | source kind for A / B (a `wiki-*` channel rolls)       |
| `#dbg=1..6`          | signal taps (composite, luma, chroma, burst, scope)    |
| `#surprise`          | roll a random preset stack on load                     |
| `#seed=n`            | put every roll this session makes on that seed         |
| `#gpu=low-power`     | run on the integrated GPU instead of the discrete one  |
| `#vidbitmap`         | force the bitmap video path where zero-copy exists     |

Example: `/app/#iurl=/sample.jpg&preset=dirty%20mix`. Either half of the bar is
read, so every one of these also works spelled `?`, which is what the harnesses
pass.

A packed look opens with two characters of seal and a `.` — twelve bits over the
bytes — so a link cut short in a chat window or pasted with a character turned
is refused with a banner rather than decoded to a prefix of itself. A link with
no seal is one from before it existed. The loader never keeps `#preset=` on the
bar once the look has been written: the look omits every control at stock, and a
preset left underneath would fill those back in.

Everything a packed link's meaning rests on outside the link — each control's
wire number, step, default and choices, and the two lists `#mod=` reads by
position — is pinned in `src/ui/packed.golden.txt`. Retuning any of them fails
the build with the control named; `npx vitest run src/ui/packed.test.ts -u`
admits the change, and the diff is the record of what existing links will do. A
packed value is a count of the control's own `step` from zero, which is what
keeps an old link honest: widening a range leaves every link that names the
control reading as it always did.

`#iurl=` is what stops a shared link handing the reader a _different_ picture.
`#src=wiki-random` names the pool, so a link carrying it alone rolls again on
the far end. A Commons file is already a public address, so the link carries
that and leaves the channel out. **An archive.org roll is the exception and
deliberately carries no address**: its bytes reach the tab as a whole-file
download behind a `blob:`, and the one path a browser can read it from ignores
`Range`, so a reader handed that url would get a clip whose scrub bar silently
clamps. That deck sends `#src=ia-random` and the reader rolls their own. A saved
look and a strip row carry the pool without the address, which is why
`writeProfileParams` blanks a pool deck's address before it writes.

`#gpu=low-power` is the exception to "a link specifies a look" — it changes only
which chip draws. The app asks for the discrete GPU because the integrated one a
hybrid laptop hands out by default measured 3x the frame time (9.34 vs 3.38 ms).
Two reasons to override: Firefox keeps a GPU awake for as long as a device is
open on it, so the discrete card never autosuspends while the app is up; and
when something looks driver-shaped, "does it still happen on the other GPU"
wants answering without a rebuild.

## Further reading

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — pass graph, buffer layouts, adding a
  control end to end
- [`OPTIMIZATIONS.md`](OPTIMIZATIONS.md) — what these measurements decided
- [`EDITOR.md`](EDITOR.md) — the strip, glitch transitions, and the export an
  editor can conform
- [`CURATION.md`](CURATION.md) — screening presets, and what the eye said that
  the numbers did not
- [`adr/`](adr/) — the decisions where the obvious thing is wrong for a
  non-obvious reason, and [`handoffs/`](handoffs/) for the evidence under them
- [`EFFECTS.md`](EFFECTS.md) — every control, **generated** by
  `scripts/docgen.mjs`. Edit `src/ui/controls.ts`, then run `pnpm docgen`;
  `pnpm build` runs `--check` and fails on a stale copy

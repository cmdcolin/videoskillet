# The editor: a rundown, and an export an NLE can conform

The ask behind this was music videos: a series of clips, set up in advance,
played back to back. It has two halves.

- **The strip** is the live half — an ordered list of cued states you can also
  fire by hand, and a shelf of transitions to get between them.
- **Fixed-framerate export** is the offline half — rendering a take where frame
  N is a pure function of N, so an editor can conform the result.

They are one project rather than two: the live walk and the offline walk are the
same walk on different clocks. Both are built. This page is what still
constrains changing them, plus the two boundaries that get proposed again every
few months.

Related material in [`IDEAS.md`](IDEAS.md): **Clip cues**, **Patching into other
apps** (live routing to Max/TouchDesigner), and **Capture / deinterlace** (a
composite grabber on the way _in_).

## Why this is not an NLE plugin

The recurring version of this is "the shaders are the value, so put them in
something that has a timeline" — After Effects, Premiere, Resolve. Each route
was investigated and declined, in order of how fast the finding kills it.

**There is no "the shaders" to port.** The WGSL is about a third of the
simulator. Against twenty-six shaders sit `src/core/signal/`'s per-frame CPU
state (`LineState`, `MixState`, `RfState`, `SynthState`, `AudioState`, and the
FIR bank, redesigned CPU-side whenever one of the filter five moves) and
`src/core/gpu/`'s pass graph, uniform packing and buffer management.
`PARAM_DEFS` is 228 fields, `DEFAULT_CONTROLS` 234 keys, and several buffers are
_state_ rather than scratch — `timingBuf[525..532]`, `persistBufs`, `storePrev`.
Lifting the shaders alone lifts nothing that runs.

- **No plugin API speaks WebGPU.** OFX 1.5's GPU rendering suite is CUDA, OpenCL
  and Metal; there is no Vulkan and no WebGPU, and Adobe's SDK is the same
  family. wgpu/naga does mean the WGSL survives a _native_ port unchanged — one
  source over Vulkan, Metal and DX12, and the one genuinely reusable asset here
  — but inside a CUDA or Metal host it makes you a wgpu island paying a
  full-frame upload and readback every frame, in both directions.
- **The host's frame model fights the feedback loops.** OFX has
  `kOfxImageEffectPropSequentialRender` for temporal dependence and hosts do
  honour it for renders, but phosphor persistence, the mixer loop's frame store,
  the PLL's lock age, the AGC and the two servos all make frame N a function of
  every frame before it. Scrubbing is then wrong, playing from the middle is
  wrong, and a viewer means nothing until it has been rendered from the top. The
  loops [`COMPARISON.md`](COMPARISON.md) names as what distinguishes this
  project are exactly the parts that cannot survive being a plugin.
- **The slot is taken, by a tool built for it.** **ntsc-rs** holds the
  editing-suite corner [`COMPARISON.md`](COMPARISON.md) maps — same premise, in
  Rust, CPU-side and SIMD, already shipping After Effects, Premiere and OpenFX
  builds, and not locked to the NTSC raster. Going there means competing on
  raster independence, resolution and host integration, which are its three
  strengths and this architecture's three weakest points, while giving up the
  live instrument that is the whole reason for building it this way. Resolve's
  free tier does not load third-party OFX either, so the "more accessible" host
  is Studio or an Adobe subscription.

So the honest version of "put it in an editor" is a **deterministic render of
frame N handed over as a file**, which is the export half below. A native
standalone on wgpu stays on the table as a _shell_ decision (see _What a desktop
shell buys_) and never as an integration strategy.

## Why the strip stays in the app

The live app is already dense, a rundown is a lot of new surface, and this repo
has a second entry point already. It stays one document, and three of the
reasons are load-bearing rather than preferences.

**The strip writes; it does not view.** Every row it fires goes through funnels
the live app owns — `writeControls` / `startGlide` for the look, `selectSource`
/ `loadClip` / `showRef` for the source, `setVideoRegion` for the cue. A second
page needs a second engine, and around it a second copy of `useEngine`'s two
thousand lines of source loading, plus the bay, the tempo and the MIDI wiring.
Two copies of one contract drift, which is the argument `slotView.ts` already
makes about a much smaller duplication.

**`/vote/` is the counter-example, and it states the test.** The second entry in
`vite.config.ts` exists on an explicit condition — nothing in it should cost the
app a byte, so a visitor to index.html never downloads it — and the vote page
meets it: it shares `Engine` and `presets`, builds its two engines on one
device, and needs no part of the panel. The strip fails that test from both
ends. It wants nearly all of the panel, and a visitor to the strip page would
download the app entire.

**The offline half is pinned here regardless.** An offline render must adopt the
live device rather than create one
([adr/0004](adr/0004-never-destroy-a-presenting-device.md)), and a second tab
cannot adopt the first tab's.

What the worry is actually about is screen space, and `usePopout` already
answers it: a same-origin window with the panel portalled into it — same React
tree, same engine store, same MIDI, no message plumbing, because the JS heap is
shared. The picture goes on the projector and the rundown on the laptop. So the
live/edit tension is a **mode rather than a page**: with the tray shut, the app
is what it is today to the byte.

## The strip

**The shape is a rundown, not an NLE timeline.** Tracks, a playhead and trim
handles are built for material that gets rendered once and never touched again;
an ordered list of cued states, each of which can also fire on its own, serves
setting a piece up _and_ playing it live, which here are the same activity at
different speeds.

**There is no playhead, and there cannot be one.** Row N depends on every row
before it and frame N on every frame before it — the phosphor, the frame store,
the PLL's lock — so a piece plays from the top or not at all. That is the same
property that rules out being a plugin, and no amount of drawing the tray
differently touches it.

What the austere drawing was over-claiming is that the tray had to _look_ like a
list to stay one. It does not: the shape is a rundown **that reads like a
filmstrip**, and the remaining distance to what an iMovie user expects is
cosmetic — cards that show their clip and are as wide as their screen time,
transitions drawn between clips rather than as a chip on one, handles to trim
with. None of those is a track, a playhead or a ripple edit.

### A row is a session plus two fields

`ui/urlParams.ts` is "the share-link contract: everything a session can be
configured with from the query string". It round-trips the look (`#preset`,
`#set`), the modulation bay (`#mod`) and the cue points (`#cuea`, `#cueb`), so a
row is that snapshot plus how long it holds and how it arrives. New row state
belongs in `urlParams` rather than beside it.

With one exception, and it is the exception the strip's main feature turned on.
**`writeProfileParams` drops every source mode a URL cannot carry** — `LINKABLE`
filters `file`, `library`, `browse` and `screen` — so for a while a row captured
over a clip recorded the look and nothing about the picture, and `derivedLabel`
called the card "look only", accurately. Rows were a sequence of _effects_ over
whatever was on the deck. `Row.clip` is the fix, narrowed to the one case that
was missing: a shelf id.

```ts
interface Row {
  id: string
  name: string
  session: string
  clip: { id: string; name: string; seconds: number } | null
  fill:
    | { kind: 'clip' }
    | { kind: 'roll'; origin: PoolOrigin }
    | { kind: 'jitter'; amount: MutateAmount }
  hold: { bars: number | 'clip' | null; drift: number }
  arrive: { seconds: MorphSeconds; transition: TransitionName | null }
}
```

- **`fill` is a tag, not a payload.** It says which card to draw, and `rowFill`
  derives it from the session, so it cannot drift.
- **`clip` sits beside `session`, not inside it.** A `lib:c7` in a shared link
  is a promise about one person's disk, and the link contract's job is to be
  true on somebody else's machine. `fileStash` already wrote `{kind: 'lib', id}`
  on every clip landing on a deck and `openClipById` already turned it back into
  a file opener or a `PoolRef`; nobody had pointed `+ row` at it.
- **`commitDeck` is where the deck's clip is cleared**, because it is the one
  place every source change passes through. A per-caller arrangement fails
  silently: one path that forgot would let `+ row` record a clip the picture had
  left ten minutes earlier.
- **`name` is a field, and a rundown is unusable without it.** Four look changes
  over one clip is four cards all reading "look only".
- **A disk grant that died with the last page load needs a user gesture**, and a
  walk is a timer with none to spend. That row parks and the caption offers the
  click, as the boot reopen does.

`session` uses `writeProfileParams` rather than `writeSessionParams`: a row is
read back weeks later, so it wants resolved controls with no `preset=`
underneath to re-supply a knob the hand had already put back. That buys three
things — a row is shareable on its own, `scripts/clips.mjs` can drive one with
no new contract, and `urlParams.test.ts` is already the row codec's test.

Twenty rows is past what an address bar carries, so **a row is a link and a
rundown is a file**: JSON in `storage.ts`, holding rows whose looks are strings.

### Three kinds of row, one shape

A strip of fixed clips at fixed bar counts is a storyboard — the same video
every time, which is the opposite of what this app is built around.

- **A clip.** This source, these in/out points; `ui/cue.ts` is that pair.
- **A roll.** A pool rather than a file, resolved _when the row fires_.
  `POOL_MODES` (`wiki-random`, `ia-random`) already means "a channel is a search
  rather than a file".
- **A shake.** Same source, jittered look, through `MUTATE_AMOUNTS` in
  `ui/mutate.ts`.

**Holds are loose by default**: "≈N bars" with a drift amount, with exact
beat-lock available per row for the cut that has to land on a hit. That is a
taste call — a strip whose rows roll and whose holds drift is a _pattern_, so
playing it twice gives two different videos, which is the right default for a
tool whose sources include two random-access archives. A hold can also be
`'clip'`, as long as the picture runs; `rowRuntime` reads the trim first and the
clip's own length second, so an in/out pair is also how long the row is up.
`ui/useTempo.ts` supplies the beat from MIDI clock or a tapped `DEFAULT_BPM`, so
bar-relative holds work with no gear attached.

### Seeding

**Every roll goes through a seeded RNG, and a take records the seed plus the
resolved picks.** Without it a take is unreproducible by construction, and the
whole point of the export is to re-render a take at quality after performing it.

Storing the resolved picks means storing **identity, not urls**, for the reason
`sources/pool.ts` gives: a url is a rendering, and the one that worked today
404s when a transcode ladder is rebuilt. `PoolRef` — origin, title and kind — is
the thing to keep. The same seed does **not** hand back the same file: Commons
rolls with `gsrsort=random` and archive.org's within-page ordering is upstream's
too, so a seed reproduces this app's _decisions_ and the recorded `PoolRef`
reproduces the file. That is why the rule is a seed **plus** the picks, and
never either alone. It is
[adr/0006](adr/0006-a-take-is-a-seed-and-its-picks.md), because it is the one a
later reader would otherwise be within their rights to simplify into
`Math.random()`.

`src/core/rng.ts` holds `Rand`, `rngFor`, `randomIndex` and `pickOne`, and both
pool rolls take a trailing `rand` through the one `rollPool` funnel. **The
signal path rolls too**, which nobody predicted: `MixState` reached for
`Math.random` from inside the frame through the `Wow` it owns, so a vhs board
re-rendered differently every time however clean frame zero was. The engine now
hands one per-take generator to all of them.

### One walk, two clocks

Playing the strip is: walk the rows, apply each through the existing
`writeControls` / `startGlide` funnel, preroll the next row's source. That walk
is the same live and offline; only what advances it differs — wall clock with
manual override live, the virtual clock offline. The offline walk is nine lines
(`offlineWalk` in `ui/stripRun.ts`), because `advance` already took a `Clock`
and never cared where the frame came from.

- **The offline walk keeps its own place, and the live one is stopped.**
  Pressing ⎙ stops the tray's walk and starts a fresh one at the top, so a take
  begun mid-set does not inherit where the set had got to.
- **`onFrame` fires before the step, not after.** A row applied after the engine
  stepped is a cut landing one frame late, every time and in the same direction,
  which is precisely the error no assertion about frame rate would catch.
- **The render does not wait for a row's load.** `applySession` fires its loads
  and returns, so a row naming a clip arrives when it arrives, exactly as it
  does live. A deck with a clip already on it is frame exact from the take's
  first frame; a row that swaps one mid-take is exact only once its element
  lands. The awaiting sink `stripRun.ts`'s header describes is the remaining
  half, and it is buildable now that the other side of it is frame exact.

### The modules

The walk is where an editor gets its bugs, and a browser is an expensive place
to find them. So the arithmetic is pure and tested under vitest, and React only
carries out what it says.

- `ui/strip.ts` — the row type, the codec, and
  `advance(strip, walk, clock) → { walk, effects } | null`. One pure function:
  given a rundown, where the walk is and what frame it is, what changes. Effects
  are a small union, never engine calls.
- `ui/stripRun.ts` — the interpreter: one effect against a `StripSink`. Plain
  functions, so a fake sink tests the whole walk end to end and the offline
  render reuses it rather than reimplementing it.
- `ui/useStrip.ts` — the driver, in two halves: `makeStripRunner()`, a plain
  object holding the rundown, the walk and the subscriptions, and the thin hook
  over it. Only the hook needs a browser.
- `ui/StripContext.ts`, `ui/transitions.ts`, `ui/StripTray.tsx`,
  `ui/StripRow.tsx`, `core/rng.ts`.

**The walk advances on the engine's frame counter, not on a wall clock.**
`advance` takes a frame and a tempo, so "≈4 bars" is arithmetic over
`frameNo()`. That makes the live driver a poll on the tick that already reads
the playheads at 10 Hz, and the offline driver a call per rendered frame with
nothing else changed. It also means the picture and the rundown freeze
_together_ when a tab stops getting frames, where a wall-clock strip would come
back having silently skipped four rows nobody saw.

### The React shape

**One context per clock.** `ControlsContext.ts` carries the measurement: a
`controls` object that changed identity on every write re-rendered every
consumer whatever the compiler had memoized — 19 ms of React per slider write
with all the rows mounted, past a frame, dropping one off the WebGPU loop per
pointer move. The fix was to split what _moves_ (a subscribe/get `ControlStore`
read through `useSyncExternalStore`) from what is _stable_ (`ControlsApi`).
`ModSlotsContext.ts` stays one plain context with no store, because a bay
changes when a hand patches it rather than at frame rate.

The strip has three clocks, so it gets three homes rather than one big
`StripContext`: **the rundown** (moves when a hand edits it — ordinary state
behind an API context of stable verbs), **which row is up** (moves at row
boundaries — ordinary state), and **how far through the hold** (moves every
frame — a subscribe/get store, the shape `morph.ts`'s `MorphStore` already has,
with `holdProgress` as the pure function behind it).

**The walk lives outside React, and the compiler decided that.** Keeping it in
state and mirroring it into a ref for the rAF closure means writing a ref during
render, which is one of two patterns that make React Compiler give up on a hook
_silently_; quieting the resulting dependency warning with `eslint-disable` is
worse, since it skips optimisation for the whole hook. Both were tried and
`pnpm compiler` caught both. So the runner is a plain object handed to
`useState` once and read through `useSyncExternalStore` — and the side benefit
is that a driver which is not a hook is a driver a test can drive.

**The driver is the only effect.** Three things will look like effects and must
not become them: the hold's progress is _derived_ from the walk and the frame, a
row card's "am I live" is a comparison during render, and persisting the strip
belongs in the verb that changed it, the way `useTempo` writes its tempo in
`write()`.

**Effects as data is what keeps additions cheap.** Preroll, the fault shelf,
takes, per-row MIDI and the offline render each landed as a variant on `Effect`
and an arm in `stripRun`'s switch, with `advance` deciding when. That is why
`advance` returns a list instead of calling the engine, and it is worth
defending when the first "it would be simpler to just call it here" arrives.

**Adding an async step to a hook is where the compiler bites.** An `await`
inside a `try`, and a variable reassigned from a callback that runs after the
render, both make it drop `useEngine` whole, and nothing else in the build says
so.

### Preroll depth 1

Steady-state playback does not care how long the strip is: `VideoPump.due()`
gates on `el.currentTime !== slot.lastTime` and yields one `createImageBitmap`
per newly decoded source frame, so one clip and forty clips cost the same per
frame. All of the cost is at the cut — `stopSlot`, a new element, the network,
the first frame. So a slot holds the live element and the next one, already
loaded and seeked to its in-point, and swaps at the boundary.
`scripts/prerollcheck.mjs` measures the cut at **9 ms warm against 58 ms cold**
on a small file over localhost, which is the least favourable case there is.

- **Depth 1 is structural, not a rule to remember.** There is one `next` field
  per slot and `prerollUrl` clears it, so a second preroll retires the first. A
  queue would have needed a policy; a field cannot hold two. The bound it
  protects is _files_ — each parked element is a live decoder, and an
  archive.org pick is a `blob:` holding an entire download.
- **The lookahead is a fact about the rundown, not about the frame.** It is
  emitted by `land` rather than `fireEffects`, so firing row 3 by hand out of a
  bank of scenes still loads what row 4 would want. It comes last in the step,
  so the deck is pointed at what is on air before anything fetches what follows.
- **A shelf clip has to be resolved by id, not by url.** `URL.createObjectURL`
  mints a fresh string every call, so one `File` opened twice is two urls and
  `playUrl`'s identity match can never fire — a shelf clip would have loaded
  from scratch beside an element already holding the picture. A `Preroll`
  records the shelf id it was parked under and `prerolledClip` answers which url
  to open it as. `prerollcheck.mjs` asserts the url instability outright,
  because the whole mechanism turns on it.
- **The row's own clip is asked before its session.** A row's session carries
  whatever was on the board when it was captured, so reading it first parks the
  wrong picture — and worse than parking nothing, parks it under the id the cut
  is about to ask for, where the promotion matches and puts up a clip nobody
  chose.
- **The cut spends the preroll before it awaits anything.** Resolved through the
  shelf instead, a row's promotion and the next row's lookahead open with the
  same IndexedDB read and whichever settles first wins — a lookahead landing
  first calls `dropPreroll` and destroys the element the cut was about to
  promote.
- **A late park is guarded by a token.** A shelf clip parks two awaits later
  than a url does, so a rundown stopped in that window ran `dropPrerollOn`,
  found nothing, and left a `<video preload="auto">` holding a whole clip for
  the life of the page. `useStrip`'s `epoch` is the token: what goes out of date
  is the _decision_.
- **Kept rolls, dead grants and stills are declined, and say so.** A kept roll
  downloads whole, so prerolling one speculatively spends a file's worth of
  network on a row that may never arrive. A still is refused for a sharper
  reason: `prerollUrl` writes its parked record _before_ awaiting the metadata
  that would fail, so a cut landing in that window would promote an element that
  can never show a picture. The refusal reads `Clip.kind` off the shelf entry,
  so it costs no file, no grant and no decoder.

`stopSlot` deliberately leaves a parked element alone, since the load paths stop
the slot and _then_ call `playUrl`.

### Transitions are faults that resolve

A look-morph is not a transition. It walks the resting board from one place to
another and the picture stays legible the whole way; nothing about it says a cut
happened. So **a transition is a fault that happens to resolve** — break
something, cut while it is broken, let it heal onto the new clip. An NLE cannot
ship that, because its transitions are composited over two finished pictures and
these are a receiver genuinely losing and regaining its grip.

`signal/fault.ts` is the envelope, `ui/transitions.ts` the shelf, and
`Engine.startFault` the one verb between them. Five entries — `track`, `roll`,
`collapse`, `shuttle`, `dub` — under the T-bar in the deck, each bindable to a
MIDI pad, and a row's `arrive.transition` picks from the same table. No new
uniforms, no new pass, no shader work at all.

**A transition is two curves and a cut point, where a morph is one walk.** The
fault ramps up on the outgoing clip and down on the incoming one, and the source
swap lands at the peak — the frame where the picture is least legible is the
frame that hides the edit.

```ts
startFault(plan: {
  peak: Partial<Controls>  // the fault at full depth
  frames: number           // its span
  cut: number              // where the source swap lands, 0..1
  onCut: () => void        // fired once, on the peak frame
}): void
```

Evaluated where the bay is evaluated: additively over the resting controls,
inside the frame, never touching what React renders from. That makes it
frame-clocked and therefore already right under the virtual clock, composable
with `startGlide` rather than fighting it (the look walks while the fault cuts),
and one object an automation recorder can stamp. The cut is a callback rather
than something the panel polls for because the swap has to land on the peak
frame and nothing in React runs that often — the same argument `setVideoRegion`
already carries.

Five things the shelf had to get right, and none was guessable from the design:

- **The domain you break decides what the transition reads as** — the same
  three-way split [`ARCHITECTURE.md`](ARCHITECTURE.md) draws. `track` sweeps a
  band down the frame in the signal domain, `roll` loses vertical hold in the
  sync domain, `collapse` folds the raster toward a line in the deflection
  domain. One per domain is a varied shelf rather than one effect at five
  intensities.
- **A recipe is more than the control it is named after.** `hHold`/`vHold` past
  the capture range rolls a picture only if there is something to roll _to_ — an
  oscillator free-running at exactly 60 sits still however completely it wins,
  so `vFreqHz` is what makes the mechanism bite. And `dubGens` ramped 1→4→1
  compounds damage rather than inventing it: four passes over a clean board is
  four times nothing. Both measured at 0.4–0.6/255 from rest by
  `scripts/faultcheck.mjs` — transitions that transitioned nothing — and both
  were fixed by naming the rest of the mechanism rather than by turning anything
  up.
- **Duration is per entry, not a rate control.** A raster takes about a second
  to collapse and reopen, three generations of dub need two and a half to read
  as wear rather than as a glitch, and a rolling picture stops being a
  transition after one. A single thumbwheel over all five is a knob whose good
  setting changes with the button next to it.
- **The chip on a row card draws a glyph.** The shelf's words are a deck
  button's width; a row card is 190px holding six controls, and "collapse"
  pushed the ✕ out past `overflow: hidden`, where it was invisible, unclickable,
  and the only way to remove a row. Each entry carries a one-character `glyph`
  for the card and keeps its `label` for the deck.
- **A transition row does at the cut exactly what a plain row does when it
  fires.** The first cut of this deferred only the session, and that was three
  bugs from one inversion: `applySession` re-rolls a `#src=…-random` itself, so
  a late session kicked off an _unseeded_ roll whose fresher `beginLoad` token
  beat the seeded one — which is precisely what
  [adr/0006](adr/0006-a-take-is-a-seed-and-its-picks.md) forbids; a shake row
  lost its shake to the session it was a departure from; and a transition row's
  lookahead retired its own parked clip a moment before the cut meant to promote
  it, so every transition cut paid the cold price. The `fault` effect holds the
  step (`atCut`), the sink's `fault` verb takes a callback rather than a
  session, and `useEngine.faultTo` is the shelf lookup and nothing else.

**A pending cut goes stale.** Half a second is long enough for the answer to
change, so the runner numbers its steps and the cut checks its number before
running — on the sink, so the offline walk inherits it. The _fault_ is not
cancelled: a fault is a picture effect and should heal rather than vanish, while
a cut is a decision, and only decisions go out of date.

One thing the design was right about without saying why: **the picture resolves
after the board does.** The fault is handed back inside the frame it ran, but
the phosphor is still holding the band and the PLL is still walking its lock
back. A transition ends as a receiver recovering rather than as an effect
switching off.

### A card must not move because its own text changed

A row card is shrink-to-fit, so **every label in it is load-bearing on layout**,
and the tray is one horizontal row of them — a card that grows slides every card
to its right. The controls that change their own text are exactly the ones a
hand clicks repeatedly, so stepping the hold chip walked the ✎, the ⧉ and the ✕
out from under the pointer resting on it. `scripts/traylayout.mjs` measured all
five before they were fixed: the hold and arrival chips at 6.6px, the transition
chip at 1.1px, the rename ✎ at 21.8px, and ▶ → ■ at 4.3px.

- **The reserve is a property of the _ring_, not of the value in it.**
  `HOLD_LABEL_CHARS` and `MORPH_LABEL_CHARS` are derived from the rings
  themselves, so a longer hold added to `HOLD_BARS` widens the chip rather than
  quietly restarting the shift on the one row that reaches it.
- **A `<button>` is `border-box` in every UA stylesheet**, so a width in `ch`
  reserves room for the text _and_ its padding, and comes up two characters
  short. `--chip-pad` exists so the two cannot drift.
- **A glyph ring gets a fixed width, not a floor.** Those glyphs come from
  whatever font has them, so they are one character at six different widths and
  no `ch` count describes them.
- **The rename field is laid over the face, not swapped for it.** Out of flow it
  contributes no width, which is what the stylesheet had claimed all along and
  could not deliver from inside the flow.

The cost is real: the feet are six controls, three now held at a fixed width,
and together they exceed the card's floor, so cards come out very nearly equal.
The variety they used to have was the hold chip being three characters wider on
some rows, and that width difference is the shift itself. Cards that say
something by their width want the _hold_ to set it.

Two harness lessons came out of the same work, and both generalise.
`element.click()` does no hit-testing, so it reaches a button a hand cannot —
the tray harness now _measures_ that every control on a card is inside the card.
Reaching a card's chips positionally meant that adding one chip silently shifted
three unrelated buttons; they carry `data-act` names now.

## Fixed-framerate export

Rendering a clip where frame N is a pure function of N, at a constant frame
rate, decoupled from whatever the GPU managed in real time.

Most of the precondition was already paid, for reasons that had nothing to do
with export. **The signal path is a fixed-timestep 60 Hz simulation:** artifacts
clock off the frame counter (`impulseStorm(this.frame / 60)`, `scPhase`,
`shuttlePhase`), the modulation bay is `const DT = 1 / 60` advanced once per
rendered frame, and `Engine.step()` already forced a full sim step past
`timeScale` and the frame lock. Four things were not pure functions of N.

### The video source

`VideoPump.due()` gated on `el.currentTime`, and a `<video>` advances at wall
rate, so an offline loop faster than real time rendered the same input frame
hundreds of times. Two routes; the measurement chose between them.

**The cheap route is dead.** `scripts/pullstep.mjs` asked the one question the
cost model did not answer: a render's seek is _forward, by one frame, from where
the decoder already is_, and if a decoder continued in place the keyframe
spacing would stop mattering. It does not. A one-frame forward seek costs what a
seek across the whole clip costs — 38 ms against a random seek's 35 ms on a 3s
GOP, 183–607 ms on a single-keyframe clip — against a 2–3 ms decode floor. One
second of 60 fps take costs 2.3 s of pull on a good clip and 6–11 s on
`public/test.mp4`'s structure. Stepping 1:1 through a sparse clip is _worse_
than seeking randomly through it, because each step is one frame further from
the single keyframe. And `seeked` is not a promise that the picture moved: on
the all-intra arm `createImageBitmap` handed back the pre-seek frame about half
the time.

**Hence the demuxer route.** `ui/mp4demux.ts` is the demuxer — not mp4box.js,
for the argument `mp4.ts` already makes in the other direction — checked against
ffprobe on real files by `scripts/demuxcheck.mjs`. `ui/framePull.ts` walks a
`VideoDecoder`: ask for a clip time, get the frame a viewer would see there, at
**0.85 ms a frame and flat in the keyframe spacing**, because nothing seeks.
`VideoPump` has a take mode that asks it instead of the element, `startTake`
switches it on, and `renderTake` awaits it before each step.

- **Edit lists had to be honoured, not declined.** Both clips in `public/` have
  one — every byte offset and sync flag agreed with ffprobe and every timestamp
  was out by a constant — so declining would have declined this repo's own
  footage. The two shapes ffmpeg writes are applied; only the ones needing a
  piecewise time map are refused.
- **`ctts` is the thing that is invisible when wrong.** Decode order is not
  presentation order on any clip with B-frames, which is most real footage and
  none of what `mp4.ts` writes, so a puller indexing by `dts` is correct on
  every fixture this repo can generate for itself and scrambles the first clip
  anybody imports. `pullcheck.mjs` carries a two-thirds-B-frame arm and asserts
  the fixture really has them.
- **A frame's identity has to be checkable.** The failure mode of a puller is
  returning _some_ frame, promptly, forever, and no timing column shows it. Each
  fixture frame carries its own index as ten binary cells in the picture. Three
  bugs came out of that which nothing else would have found: a cache evicting
  the frame being waited for, a cache emptied by handing a frame out, and a feed
  loop awaiting a microtask where a decoder's output is a task.
- **The playhead is computed from the frame, not accumulated.** A clip arriving
  mid-take starts at its own beginning — `(frame - whenThisClipArrived) / fps` —
  so asking twice gives the same answer. A looped region wraps by modulo and
  lands exactly on the in-point, where the live clamp overshoots by up to a
  frame because it can only fire once the playhead has crossed the out-point.
- **A source that cannot be pulled from stays on its element**: every webcam,
  every generated mode, a YouTube embed, and any file the demuxer declines. That
  deck is then exactly as reproducible as it was before, which is what makes the
  take mode safe to switch on unconditionally.
- **A puller holds the whole compressed file**, and for a `blob:` — which is
  what a pool pick is — that file is _already_ resident, with no way to reach
  the `Blob` behind the url. A take over two pool rows holds four copies of two
  files. Past 192 MB a clip is declined and its deck stays on the element.

### The clock, the automation, and the take's starting state

**Five wall-clock reads move pixels**: `startGlide` stamping the walk's origin,
`advanceGlide` reading it, `stabGate`, `strobeGate` and `autoLock`.
`Engine.startTake({fps, seed})` points all of them at `frame * 1000 / fps` and
`endTake()` puts them back. One private `now()` rather than an argument each,
because five unrelated places in the frame is five chances to pass the wrong
one. `scripts/clockcheck.mjs` proves the inversion: sixty frames stepped in no
real time finish a one-second morph on the virtual clock and move it 0.03 on the
wall clock, with the wall-clock arm as the control.

**Live input is recorded as automation rather than stubbed.** MIDI and mic/line
audio cannot be re-rendered, so `ui/automation.ts` is a tape of control writes
with frame stamps, `ui/useAutomation.ts` the recorder, and ● in the tray is ▶
with the tape rolling.

- **The tap is in `useMidi`, not in a `writeControl` funnel** — there isn't one.
  A MIDI knob deliberately bypasses the store path, because the physical move is
  its own soft takeover and routing it there would reset the takeover it had
  just satisfied. Tapping a funnel would have recorded the sliders and lost the
  controller, which is precisely the input this exists for.
- **Stamped in frames.** A take performed in a tab running at 40 fps renders at
  two thirds of the wall time it was performed in. The strip's holds are already
  measured in frames, and stamping this any other way would put the automation
  and the walk on two clocks.
- **The walk first, the hand second.** `onFrame` replays the rundown and then
  the tape, so a knob moved on top of a row is not overwritten by it.
- **Nothing the walk reproduces is on the tape**, structurally: a row reaches
  the engine through `useEngine.showSession` while the tap sits on the write
  path App owns, so a row's session, roll, jitter and preroll are physically out
  of its reach.
- **A morph is one event, not sixty a second**, because `startGlide` is
  frame-clocked in the engine and already right under a take's clock, so one
  stamped destination reproduces the whole travel.
- **Three engine events are not recorded**: a transition off the shelf
  (`startFault`), a bay strike (`fireMod`), and a re-patch of the bay
  (`setModSlots`). The first fails interestingly rather than silently — a
  hand-thrown transition's _cut_ replays, because the cut writes through
  `writeControls`, while the fault that hid it does not, so the picture cuts
  where it cut and does not break where it broke. `AutoEvent` is a closed union
  under a switch that will not compile without a new arm.
- **A tape lives as long as the tab.** It is not in `storage.ts` and not in the
  rundown, because what would make it worth persisting is the take _file_
  [adr/0006](adr/0006-a-take-is-a-seed-and-its-picks.md) describes — the seed,
  the resolved `PoolRef`s and the tape together. A localStorage key holding one
  of the three looks like the feature and is not it.

**Take state** is the last piece, and it turns "the same take from the same
starting state" into "the same take". Frame N was a function of N _and of where
the engine happened to be_ at frame zero — the phosphor still on the glass, the
PLL's lock age, the two servos — so two renders with the live loop running
between them came out about 5% apart. `startTake` is one switch over all three
of the things a take needs held: the clock counts frames, everything that rolls
draws from the seed, and the signal path starts where a fresh engine's does. It
leaves the board alone, since the look, the bay and the sources are what a take
_is_.

**The reset zeroes every buffer and texture, not the four that carry state.** A
WebGPU resource is zero-initialized, so zeroing one _is_ the constructed state,
with nothing to be wrong about — where a hand-kept list of which buffers survive
a frame boundary is wrong exactly once, and the symptom is a take that does not
reproduce with no way to see why. It costs one command submission and no frames.

Three things it turned up:

- **A morph in flight was a bug.** Its origin is stamped on the wall clock and a
  take counts from zero, so a render started under one saw `now() - startMs` go
  hugely negative and parked the board on the morph's _origin_ look for the
  whole take.
- **The file had the wall clock in it.** `mp4.ts` stamped `Date.now()` into six
  `creation_time` / `modification_time` fields, so two takes came back the same
  length to the byte with different digests. Nothing reads them; they are zero
  now. Worth naming because it is the shape of fault that survives every check
  short of comparing the bytes.
- **The frame counter is the app's clock too.** The strip measures its holds
  against `frameNo()`, so a take rewinding it to zero has to hand it back, the
  same "left as it was found" rule `pauseLoop` already follows.

### The encoder and the loop

`useCapture.ts` was `captureStream()` + `MediaRecorder`, which timestamps by
wall clock. It is now `VideoEncoder` with an explicit `timestamp: i * 1e6 / fps`
per frame (`ui/record.ts`) and an MP4 muxer written for the one shape this needs
(`ui/mp4.ts`) — CFR by construction, and indifferent to how long any frame took.
ffprobe reports `r_frame_rate == avg_frame_rate == 60/1`, which is what
constant-framerate _is_ to everything downstream.

`ui/render.ts` and `Engine.pauseLoop`/`resumeLoop` own the loop: `renderTake`
stops it, steps the engine, and hands each frame straight to the encoder, so a
take renders as fast as the GPU will go and a slow frame costs the render wall
time and the file nothing. `RenderLoop.stop()` drops a flag rather than
cancelling, deliberately, so two already-scheduled chains each land one more
frame after `pauseLoop()` returns — the render waits two animation frames so
those land before it.

Three things measurement corrected, and three browser faults:

- **No `copyTextureToBuffer` and no offscreen target.**
  `new VideoFrame(webgpuCanvas)` reads the canvas directly and comes back BGRA
  and full of picture, so the mirror-through-a-2D-canvas hack is gone from the
  recording path. The blank `toBlob` and the silent `captureStream()` are real
  and still true; the _still_ grab still needs the mirror.
- **This did not have to be Chrome-only.** Nightly has `VideoEncoder` and
  reports vp8, vp9, H.264 and AV1 all supported.
- **MP4 rather than WebM was forced.** Resolve does not import WebM at all and
  Premiere needs a plugin, so the container is what decides whether "an editor
  will conform it" is true.
- **H.264 needs even dimensions**, and an ordinary window gives an odd one
  (measured: 440x573). Firefox accepts the `configure` _and_ the `encode`, then
  fails the whole encoder asynchronously on its error callback with
  `NotSupportedError` and nothing naming the size. `record.ts` rounds down and
  crops.
- **Firefox's `decoderConfig.description` is a malformed avcC.** The reserved
  bits the spec fixes at 1 are left clear, and each parameter set carries a
  duplicate of its own NAL header byte. ffmpeg decoded the picture anyway but
  reported `sps_id out of range` on every frame; `normaliseAvcc` rebuilds the
  record.
- **Chrome enforces the AVC level's coded-area cap at `configure`**, so a pinned
  codec string is a bug waiting for a bigger display: level 4.2 allows 2228224
  samples and a 2560x1592 retina window codes as 4096000, so recording did not
  degrade there, it refused to start. `record.ts` computes profile and level per
  recording — see
  [`adr/0008`](adr/0008-record-h264-high-and-mind-the-chroma.md).

`scripts/rendercheck.mjs` is the guard over all of it: two renders of one take
come back with the same SHA-256, with 25 ms of real time injected at every yield
of the second and the live loop running in between. One unseeded `Math.random`
in a per-frame modulator, or one buffer left out of the reset, and it fails.
Byte-identity is within one browser build — the H.264 encoder is Firefox's, and
nothing asserts across versions of it.

### The Firefox constraint

Measured on Nightly and re-measured on Nightly 151 by `scripts/codeccheck.mjs`:
`importExternalTexture` is `undefined`
([bug 1827116](https://bugzilla.mozilla.org/show_bug.cgi?id=1827116)), and
`copyExternalImageToTexture` refuses a WebCodecs `VideoFrame` outright,
accepting only `ImageBitmap`, `HTMLImageElement`, `HTMLCanvasElement` and
`OffscreenCanvas`. So the clean decoder path — pull a `VideoFrame`, hand it to
the GPU — routes through `createImageBitmap(frame)` at **1.0 ms a frame against
a decode of 0.53 ms**. Affordable offline, and it means the WebCodecs route buys
frame-exactness rather than zero-copy. (`videopump.ts`'s `direct` mode is the
capability-gated path for browsers where this does work.)

Two lessons from writing that harness, neither about WebCodecs. **It must run
over `http://localhost`, not `about:blank`** — WebCodecs is secure-context only,
so a probe that runs somewhere the app never does answers a question nobody
asked. And **`flush()` per chunk is not "wait for this frame"**: a completed
flush sets the key-chunk requirement again, so flushing after every decode turns
one sequential decode into sixty broken ones. Wait on the `output` callback, and
on `dequeue` as well, or a decoder holding frames for reordering deadlocks a
loop that only listens for output.

### What a desktop shell buys

**Nothing for any of the four items above** — every one is browser-API work that
runs identically in the web app, so an Electron decision is not on the critical
path. Where a shell earns its keep is the boundary either side:

- **Writing the file.** A multi-minute export cannot accumulate as `Blob[]` in
  memory. The web answer is File System Access `createWritable()`, which is
  Chromium-only, and the browser this project develops against is Firefox. This
  is the strongest single argument.
- **Codecs.** A bundled ffmpeg gets ProRes / DNxHR and audio mux. The sharpest
  form of the cost is chroma: the H.264 WebCodecs offers is 4:2:0 only, which
  scores 15.54 dB against a one-pixel chroma source where AV1 4:4:4 scores 43.38
  for fewer bits, and dot crawl _is_ one-pixel chroma
  ([`adr/0008`](adr/0008-record-h264-high-and-mind-the-chroma.md)). That is
  reachable in the browser today; what is missing is `av01` sample entries in
  `ui/mp4.ts`, not an encoder.
- **A pinned Chromium.** Most of `gpu/renderloop.ts` is Firefox/Linux rAF-stall
  archaeology, and owning the runtime deletes that class of problem and restores
  `importExternalTexture`. Against it: per `CLAUDE.md`, Chrome's ANGLE/Vulkan
  backend on Linux reports spurious texture-allocation errors, so that has to be
  spiked first. Tauri is not the option — WebKitGTK has no WebGPU (tauri#6381,
  closed not-planned).

Whatever shell it runs in, an offline render must **adopt the live device, not
create or destroy one**
([adr/0004](adr/0004-never-destroy-a-presenting-device.md)).

## The offline renderer, outside the browser

[`CLI.md`](CLI.md) is the page for someone who wants to use it. This section is
how it is built and what it cost.

`scripts/render/` runs the signal path over a file with no browser in the room:

```
pnpm render in.mp4 out.mov --look='#p=mD.FbQB…'
pnpm render in.mp4 out.mov --preset=wornTape --codec=prores
pnpm render --pattern=bars out.mov --seconds=5 --set=noiseIre:9
```

**It exists because the browser's encoder is what caps picture quality**, and
that turned out to be a harder ceiling than the bitrate ADR 0008 was arguing
about. `scripts/enccheck.mjs` arm 4 measures the app's own input path — a canvas
handed to an encoder, one-pixel alternating chroma, which is what dot crawl is:

| codec through the app's path | RGB PSNR |
| ---------------------------- | -------- |
| H.264 High 4:2:0             | 9.03 dB  |
| VP9 profile 1 4:4:4          | 27.66 dB |
| AV1 4:4:4                    | 42.63 dB |

Measured on Chrome/Linux. On Firefox, which this project develops against, every
one of those arms scores ~10 dB: it declines AV1 4:4:4 and subsamples VP9
profile 1 on the way in whatever profile it was asked for. So the 4:4:4 route
does not exist in the browser this app is built in, and no amount of muxer work
creates one. Here the encoder is ffmpeg, and ProRes 4444 is the default.

Three things about how it is built.

**It runs the app's own `Engine`, not a copy of the pass graph.** A renderer
whose output disagrees with the tab is worse than no renderer, so
`vite.render.config.ts` bundles `core/gpu/pipeline.ts` itself — the one thing
between Deno and that file being that the pass graph reaches its shaders through
Vite's `?raw`, which only a Vite build resolves. `scripts/gpuprof/graph.ts` is
the second copy, and can live with mirroring because it times passes rather than
producing files anybody keeps.

**Deno's WebGPU needed two seams in core and no more.** `OffscreenCanvas` there
supports a real WebGPU context, so `RenderTarget` was already satisfied and
`initGpu` needed nothing. What was missing was a way in and a way out:
`copyExternalImageToTexture` does not exist in Deno, so every source path was
closed (`Sources.setImagePixels` is the same upload one step lower down, on the
`COPY_DST` the slot texture already carried); and a canvas texture comes back
`RENDER_ATTACHMENT` only and cannot be copied out of, so there was no way to see
what had been drawn (`Engine.readFrame`, off `faceTex`, which now carries
`COPY_SRC`). `scripts/render/runtime.ts` supplies the three browser globals the
engine expects — and a `requestAnimationFrame` that never fires is the _correct_
stub, not a placeholder, because an offline render owns the clock.

**Walking the file from the top is the shape the simulation wants.** Frame N is
a function of every frame before it, so there is no seeking, and the argument
that rules out an NLE plugin above makes a command line the natural shape.

Measured on this machine: ~49 fps at 754x480, so a render runs slightly faster
than real time and a minute of footage takes about seventy seconds.

**Audio is part of the correctness here.** `audioBendUs`, `audioLoad` and
`audioIre` drive vertical hold, HV sag and the demodulator's reference, so a
look built over a track and rendered in silence comes back with the artifacts
that should be pumping sitting still — a render of a different board. The proof
is a pair of renders of one look over one clip: with `--audio=none` twice the
files are bit-identical frame for frame, and against `--audio=auto` they differ
at 14.5 dB. The renderer is deterministic, so all of that difference is the
sound.

`--audio=auto` feeds the input's own track in and writes the intercarrier buzz
beside it when the look asks for one; `buzz`, `source` and `none` name the
halves. Two seams carry it, both in `signal/audiostate.ts`:

- **`setAnalysisSource`** supplies the three things `update` and `lowEnergy` ask
  the AnalyserNode for — a sample rate, the last window, that window's spectrum.
  Everything after them (the peak tracker, the per-line resample, `stepHit`) is
  the code the live path runs, which is what makes an offline render the same
  instrument rather than a second one. `scripts/render/audio.ts` satisfies it
  with a Blackman-windowed FFT and the analyser's own 0.8 smoothing, so the dB
  the onset detector reads are calibrated the same way.
- **`setBuzzSink`** takes the tap as numbers instead of as sound, before
  `ensureGraph` — an offline render has no AudioContext to build. The buzz comes
  out at `LINES x fps` = 31500 Hz, which is the rate `signal/buzz.ts` produces
  natively rather than a resampling.

What it cannot promise is the same _numbers_ as a live session: a browser hands
the analyser whatever arrived on its own audio clock, where this cuts the window
at the frame the render is on. The offline answer is the more defensible one —
two renders of a take agree, and two live takes never did — but it is not
bit-identical to what the speakers did.

**Every tap has to arrive, or the sound drifts against the picture.** `BuzzRead`
skips a frame when all three staging buffers are still in flight, which is right
live (the audio ring glides over a gap) and wrong in a file, where a dropped
frame shortens the track and slides everything after it earlier. Measured: a
two-second render writes 63000 samples, exactly 31500 a second, so nothing is
dropped — and the renderer says so out loud if the counts ever disagree rather
than writing a track that drifts.

**`--look` takes the link whole and reads it with the app's own parser.**
`parseSessionParams` is what the app boots from, so the CLI gets the same
layering (landing look, then preset, then `p=`, then `set=`), the same checksum
on the packed form, and the three things a regex was never going to reach: the
modulation bay, the source mode and the seed.

The bay is the one that was a bug rather than a gap. Every demo in the README
carries a `?mod=`, and a routing that never reached the engine rendered the look
at its **resting frame** — a still of a patch that was supposed to wander, which
is the same shape of failure silence was. `toEngineSlots` is the same conversion
`useModSlots` runs each render, so the master amount (`--motion`) and the tempo
lock (`--bpm`) behave as they do in the panel; a render has no tap and no MIDI
clock, so the tempo is whatever the flag says.

Source modes come across for everything that needs nothing fetched — `bars`,
`sweep`, `tv static`, `vhs static`, `synth`, and B switched off. A link naming
one of those renders with no input file at all, which is why one positional
argument is an output and two are a file and an output.

The patterns themselves now live once. `sources/pattern.ts` writes each as
pixels and wraps it in a canvas for the app, because the renderer has no canvas
and had grown its own copy of the bars — a renderer with its own idea of what
bars look like is a renderer whose output cannot be compared with the app's.
`pattern.spec.ts` pins the seven bars, the PLUGE steps and the sweep's rising
grating, since that copy is now shared by every screenshot, contact sheet and
render made against it.

Two things it does not do yet. `--look` sets one board for the whole render,
where the strip holds a sequence of them. And it fetches nothing, so a link
naming a clip, a still or a pool pick renders over whatever file was passed on
the command line.

## What is left

- **The filmstrip, and trimming.** Cards that show their clip and are as wide as
  their screen time — the width has a number to come from now, since a `'clip'`
  hold measures the picture (`clipLibrary.Clip.seconds`, probed on demand with a
  `<video>` at `preload='metadata'`, because the shelf holds whatever the
  browser plays and an exact mp4 parse would leave a fallback on every webm and
  mov). Transitions drawn between cards rather than as a chip on one; the shelf
  entry already carries the glyph. Trim handles, over the cue pair `rowRuntime`
  already reads. The open question all three share is what the tray is when a
  piece is four minutes long.
- **The three engine events automation does not record**, and the take file that
  would let a tape outlive its tab.
- **Cutting to the track's clock** rather than starting with it. One transport
  shipped — ▶ takes the picked track from the top and the walk with it, stop
  stops both — but the walk advances on the frame counter, so a tempo that is
  wrong drifts against the music over minutes. Deriving `Clock.frame` from
  `currentTime` is something `strip.ts` is already indifferent to; what it needs
  is an answer for what a rundown does when the song ends.
- **A render range over a rundown nobody performed.** Half answered by accident:
  ⎙ renders a recorded take's own length, so ● and ■ are a range chosen by hand,
  and where there is no take it renders the whole rundown (`stripSeconds` sums
  lap zero's holds with lap zero's seeds, so what the button says is what will
  play, drift included).

### Out of scope

- **Tracks and a scrubbable playhead.** A large amount of UI for a storyboard,
  and the playhead half is not taste: row N depends on every row before it, so
  there is no seeking to the middle of a piece to look at it. That holds however
  the tray is drawn.
- **ffmpeg.wasm anywhere in the live path.** It is a transcoder, not a player.
  Concatenating clips with it means re-encoding ahead of time (stream-copy needs
  every clip to match codec, resolution and timebase), losing live cut points,
  and stacking codec damage _upstream_ of the signal path — backwards for a
  project whose premise is modelling the mechanism. `scripts/clips.mjs` shells
  out to native ffmpeg offline, which is where it belongs.

Trim handles used to be on this list, ruled out as a lot of UI for a storyboard.
That reasoning was about a strip whose rows were looks; once a row can be a
clip, the in/out pair becomes the row's own length. The rest of the section
stands — this buys a trim, not a timeline.

## What the build order missed

The build order was a list of hard problems: a deterministic clock, a demuxer, a
frame-exact puller, an encoder an editor will conform. All of them shipped, and
three ordinary gaps survived the whole list. Each turned up by laying out eight
clips and pressing play.

- A row recorded the look and dropped the clip, so a rundown of footage played
  as a rundown of effects over whatever was on the deck.
- A clip added off the shelf had never been measured, so a hold set to
  `whole clip` ran for four bars.
- Preroll resolved a `#vurl` and a bundled clip id and skipped shelf clips,
  which is what an ordinary rundown is made of, so every cut in one paid the
  cold price and every transition in one had a single live picture.

Each is a missing field rather than a contradiction, which is why reading the
code found none of them: a design that specifies a type and a shipped thing that
omits it read the same from the inside. The lesson is to test the gesture the
document opens by asking for.

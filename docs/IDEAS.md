# Ideas / backlog

Things worth doing that aren't done, and things that look worth doing but aren't
— so a future pass doesn't re-litigate them. Where a shipped feature left a
lesson the next person needs, it is here under that feature's gaps; the rest of
the working-out is in the commits. Line numbers drift; grep the described
feature.

## Modulation: the remaining naked periodic wave

The premise (see `ARCHITECTURE.md`) is that a fault should be _mechanistic_, and
a single periodic wave traced down the raster reads as a filter effect rather
than a fault — the warning `signal/audiostate.ts` opens with. The shared home
for bounded-aperiodic drift is **`signal/noise.ts`** (`valueNoise`, `Lorenz`,
`Wow`); reuse it rather than rolling a new sine. Tape wow, the modulation LFOs
and intercarrier buzz are converted. One is left.

**Mains-frequency roll drift (hum), `channel.wgsl` — deferred.** The 60 Hz
fundamental is a clean sine and should stay one; it is mains, it really is that
periodic. The boring part is the fixed roll rate (the `f32(P.frame) * 0.0037`
term): real mains frequency wanders with grid load, so the beat against field
rate should breathe. Replace the constant with a slowly-drifting phase
accumulated CPU-side (the `Engine.advanceScPhase` pattern) driven by an
OU/`valueNoise` slow term, and optionally add a 120 Hz full-wave harmonic.
Deferred because it is the only one of these needing a new uniform and phase
plumbing (`PARAM_DEFS`, `DEFAULT_CONTROLS`, `uniformValues`) for the
least-visible win.

**Not worth aperiodic-ising.** These read like naked periodic waves and are
physically correct: the hum fundamental (mains is a clean sine — only its _roll
rate_ is worth drifting), the wipe ping-pong (`signal/mixstate.ts` — a switcher
sweep is deliberately periodic), source-B detune and roll (a mistuned crystal
really does sit at a fixed wrong frequency), and the decode bend ripple
(`decode.wgsl` — spatial, not animated).

## Tape mechanisms not modelled

- **Azimuth crosstalk from the adjacent track** (EP/SLP). Narrow tracks plus
  azimuth suppression that only works at high frequency, so the neighbouring
  track bleeds through as a _low-frequency-only_ ghost — a soft, colourless
  second picture that swims when tracking is off. Distinct from the multipath
  ghost, which is sharp and full-bandwidth.
- **Crease / edge damage.** A crease is a defect at a _position on the tape_, so
  it recurs every time that stretch passes the head. The main deck has no
  tape-position coordinate to hang one off, which is what has to exist first.
  (The cut delay loop had one, in its ring; see `ecec59e`.)
- **Luma FM beating the 629 kHz colour-under carrier.** The fine crawling chroma
  noise in saturated reds. Modelling the luma FM properly is expensive; the
  honest cheap version is the beat product alone.

## Noise mechanisms not modelled

Two things the last pass here established, for whoever adds the next one. A
**first** difference is triangular (power ∝ f²) and a 1-2-1 signed pair is not
(∝ f⁴), so the honest FM shape is the cheaper kernel. And when two arms share
taps, holding the floor's level constant across a tilt needs the covariance, not
just the weights — without it the knob reads as a noise-amount control with a
side effect. The algebra is in `noiseTiltWeights` (`pipeline.ts`), CPU-side.

What is left, in rough payoff order:

- **Camera sensor noise, in the feedback camera.** `compose.wgsl` models an iris
  servo, a black cut and a full-well knee, and has no noise at all. Three
  mechanisms, all cheap, and this is the one that _compounds_: shot noise (σ ∝
  √signal, so highlights are noisiest — the opposite weighting from tape grain,
  and the tell that separates a photographed screen from an electronic path);
  **fixed-pattern noise**, fixed to the _sensor_ rather than to the glass, so
  each pass zooms and rotates the previous generation's pattern and adds its
  own, breeding grain into structure with nothing drawing it; and gain noise
  coupled to the camera's own auto-gain, so noise pumps against the iris hunt at
  a third rhythm alongside the beam limiter.
- **Flicker (1/f) and popcorn noise in the video amplifier.** Everything
  aperiodic in the chain is per-sample and everything slow is periodic (hum).
  Missing: a random-walk level, so black level and brightness breathe sub-Hz,
  and **burst/RTS noise** — a defective junction switching the DC between two
  discrete states at random intervals, so the picture level _clunks_ rather than
  drifts. CPU-side out of `signal/noise.ts` (an OU term, and a two-state Markov
  chain for the popcorn) into one DC uniform; the AGC, the clamp and the killer
  then react to it for free.
- **A wandering spurious carrier (switching-supply birdie).** Every periodic
  interference here is locked to line rate (`soundIre`, `rfAdjacent`) or to
  mains (`humAmp`). A switch-mode supply or a nearby computer sits at some
  arbitrary 15–60 kHz that _drifts with load_, so it draws a herringbone that
  creeps and breathes instead of standing still — the drift is what identifies
  it — and it intermodulates with the subcarrier. Same CPU-accumulated-phase
  pattern as the hum-drift item above.
- **Noise on decisions rather than on picture.** The dropout _detector_ is the
  good one: a real DOC fires on an RF envelope dip, so a noisy floor trips it on
  lines that were fine and it patches them anyway — and the patch comes back in
  the complementary hue, by the 227.5-cycle logic `dropoutComp` already has. A
  corrective box misfiring on noise is more interesting than noise you can see.
  The sync slicer and the colour killer are the same idea, and the killer's is
  partly reachable already through `accLagLines`.
- **A fixed noise floor with a varying signal, instead of substituted snow.**
  Structural rather than a knob: `channel.wgsl` mixes snow in at a set level per
  band (tracking, head clog, shuttle, head switch). If the preamp's floor were
  fixed and the _RF level_ varied, noise would appear wherever signal is weak
  from any one mechanism, and the four blocks would collapse into it. The honest
  version, and it would delete code; also the largest of these.

## Per-input feeds — what is still on the program bus

The feeds (`feed.wgsl`, the `FEEDS` table in `feedgates.ts`) give each input its
own deck, head-end and cable. The loose connector and the ground loop shipped
per input, which is what the split is for: a fault on one feed makes the two
signals disagree, and the sync fight, the AGC and the other input are all
downstream of the disagreement.

Everything below still damages the **mixed bus**, which for several of them is
physically incoherent once two decks are patched in — the fault belongs to one
machine. Adding one is a `FEEDS` entry, a `packFeed` override, a shader block
and a `feedFaults` line; see `ARCHITECTURE.md` for the trap in the middle of
that. Rough payoff order:

- **Transport (shuttle / rewind / still), per input.** The biggest one.
  `shuttleX` sits on the summed bus (`channel.wgsl`), but shuttle bars are _one
  deck's head_ crossing tracks. Per input it gives B rewinding under a playing
  A, with B's bars sweeping B's raster and rolling with B's picture through the
  dirty sum, each strip between bars a different recorded track with its own
  timing and colour-under phase. The strips that lose sync hand the fight to A
  and the ones that don't fight back, so the picture flickers between two
  geometries at bar rate. Most of the machinery is there: `feed.wgsl`'s pause
  path computes a per-row offset and `catmull`-resamples, and shuttle is that
  path with a per-strip offset instead of a random scatter. `decode`'s
  row-uniform constraint does not bind — a feed is 1-D on the composite. It also
  makes `aPause`/`bPause` the _zero_ of a transport continuum rather than a
  separate button.
- **Head clog, per input.** Cheapest violent effect left, ~6 lines keyed on
  `P.frame`. The heads alternate sweeps, so a clogged head on one input makes
  the receiver alternate _which source it locks to_ at field rate.
- **Multipath ghost, per input.** One input off-air, one on a line. Under the
  dirty sum the ghost is a third sync edge arriving late, so the PLL has three
  candidates per line. Same shape as `terminate`'s echo tap.
- **Tracking error, per input.** A band parked on one deck that then rides that
  source's roll. Cheap; less novel than the three above.
- **Macrovision is A-only.** `mvAgcIre`/`mvStripe` live in
  `encode_composite.wgsl` and `encode_composite_b.wgsl` has no equivalent, so B
  can never carry a protected tape. Narrow, but a real asymmetry, and a
  protected B summed against a clean A makes the receiver's `agc` pump against a
  signal whose sync is fine.

## The teletype card's wire

The card can be received badly (`sources/teletype.ts` › `garbleRows`): holes
where parity caught a bit, wrong characters where it didn't, blocks for the rest
of a row whose control code took the hit, and the odd line delivered to the
wrong address. What is left is a dial, two attributes, and the other way a
character generator goes wrong.

- **A strength, not a switch.** The rate is one constant picked by eye.
  `#garble=0.8` would carry a strength without breaking the flag — `q.has` is
  true whatever the value — but the dialog would grow its first slider where
  every other thing a card carries is a checkbox. Worth doing when someone
  reaches for it.
- **The two control codes the card has no attribute for.** A hit on a colour
  code turned the rest of a row red; a hit on double height doubled a row and
  ate the line under it. Both are famous garbles and neither is reachable here:
  this card is one bit deep and white on black, and rendering them means
  carrying attributes per row through `dotGrid`. Double height is the cheaper
  and the one you saw more often.
- **Bending the card's own ROM.** Shipped for the caption generator (`ccRomAddr`
  / `ccRomData`, `romRead` in `decode.wgsl`) and not for the card, because the
  caption's font is a ROM in a buffer where the card's is a canvas raster — two
  lines there and a rebuild of `dotGrid` here. What the shipped one taught:
  holding a pin is a _range_ of effects rather than one, and the range comes out
  of the wiring. The address bus carries the character code in its high lines
  and the row inside the cell in its low ones, so one knob sweeps from every
  glyph growing a seam to the whole font substituting. And the pin is held
  _high_ rather than switched, so a glyph whose bit was already set is untouched
  and the damage is uneven the way a jumper's is.

  That is what separates a bend from `garbleRows`, which models a bad
  _transmission_ — random hits on bytes in flight. A bend is deterministic: the
  same text comes out wrong the same way every time, because the machine is
  wrong rather than the wire. Holding a line on the page-address counter is the
  third bend and is unbuilt in both places: it walks the entire page diagonally
  through itself a few cells a field.

- **A drawing that moves on its own.** `draw` paints on the card and the card
  then sits still, so `boil` is the only thing keeping it alive. Two shapes
  worth trying: interpolating between two saved drawings, which gives a hand-
  drawn tween the chain then damages; and a wigglypaint-style stroke that
  jitters along its own path, which is `boil` applied per stroke rather than per
  cell.

## Looks to leave alone

A taste note rather than a mechanism: **the plain green phosphor and the plain
chroma-key green both read badly** on their own — a flat saturated green field
is the one colour in this palette that looks like a filter rather than a fault.
Both are worth having as ingredients under something else and neither is worth
an authored preset that is about it.

## The caption channel

Line 21 carries real characters (`signal/captionstate.ts` feeds them),
`caption.wgsl` is the set's decoder, and `decode` paints the page it recovers.
Three things about it are load-bearing enough to state before anyone touches it.

**The cell grid is fitted to the active window, not to 503 kHz.** Real line 21
clocks at the true rate and spills into the blanking either side to fit its
twenty-eight cells — which here would write over the burst that this very line's
hue lock is measured from. Fitted to `ACTIVE_W` the clock is 532 kHz, six
percent fast, and nothing downstream measures it. `CC_CELLS` is what both ends
index off, and that is the only thing that has to agree.

**The run-in cannot be read at cell centres.** It is a sine at the cell rate, so
every one of its centres sits exactly on the midpoint the slicer is trying to
measure _around_ — sampled there, a perfect signal comes back flat and the
threshold never arms. It is scanned sample by sample instead. This cost a build.

**Painting goes before `crt_face` and is indexed by screen position.** Before
the face pass because a caption is light off the same glass; after it, it would
be a sticker on a photograph of a screen. By screen position because that is the
physical claim — a decoder holds bytes and repaints on the set's own timing.
(The font ROM and the page RAM share one binding, `captionrom.ts`, because
`decode` was already carrying seven storage buffers and eight is the floor
WebGPU guarantees. They are one memory on the chip being modelled anyway.)

What it does not do:

- **Roll-up is the only mode.** Pop-on and paint-on are control-code state
  machines over the same page rather than new mechanism.
- **No squelch.** A real decoder muted its display after a run of parity
  failures; this one paints every block it catches, so heavy snow fills a row
  with them. Dramatic, and not quite what the box did.
- **Attributes are ignored.** Line 21 carries colour, italics and the PAC codes
  that position a caption; this page is white, upright and where it was put.
  Same shape of gap as the teletype card's two attributes, and one fix serves
  both.
- **CC1 only.** The second caption channel lives on field 2, so it needs
  interlace before it means anything.

## The character generator as a keyer

`chyron.wgsl` stands where the box stood: after the mixer, ahead of the loop and
the deck, so what it keys in ages with the picture instead of being laid over a
finished frame. It says what the caption says, and that is not a shortcut — an
open caption and a closed one are the same sentence down two paths, and running
both is what makes the difference legible: this one is picture, so it is torn
and smeared and rainbowed and never misspelled; line 21 is data, so it is
spelled wrong and never moves.

Two things it taught. **The fill has to be video, or the timing trim does
nothing** — the first cut keyed a flat IRE level through the glyph matte, and
with a constant fill, delaying the key only translates the type. A real CG puts
out the characters _as video_ on one wire and their matte on the other, so where
the key is open and the fill has not arrived the box hands over its own black,
and where the fill is lit and the key has closed the program shows straight
through the letter. That artifact exists only because the two wires carry the
same shapes separately. And **the edge generator is OR-ed into the key, not
drawn**: widening the matte to the shadow's shape puts the fill's own black out
there for free, which is how one extra tap bought a border.

What it does not do:

- **The fill is the box's own characters and nothing else.** `keyFill`'s trick
  on the chroma keyer — program A, a matte generator, or the mixer loop bus —
  would make an inverted key a window onto the feedback bus rather than onto
  program, which is the one obviously good thing left here.
- **Monochrome.** A CG with a colour matte generator is `bKeyMatte*` pointed at
  this instead, plus the same attribute work the teletype card wants.
- **No page-address bend**, the third bend, unbuilt in both places.

The generator has its own font ROM and its own pin to hold
(`cgRomAddr`/`cgRomData`), separate from the caption decoder's in the set. They
share the baked ROM bytes and nothing else, so bending one says nothing about
the other — which is the physically honest answer and why `cgRom` is a near-copy
of `decode.wgsl`'s `romRead` rather than something shared.

## Chroma key follow-ons

The keyer slices `uvfB` — B's chroma after the encoder's bandlimit — so the
soft-across/sharp-down composite edge and the per-line breathing on the dirty
path are the filter and the detune doing it, not anything drawn. Two things it
taught.

The keyer had to read B's chroma at **B's own raster index** on the dirty path,
the same index the fill is resampled from. Keying at the output sample instead
parks the hole on the output raster and the subject rolls out from under it —
the three-domain mistake in one line.

And **spill suppression cannot be a colour operation here**: luma and chroma are
the same wire, so the only honest null is reinjecting the backing's subcarrier
antiphase, which means the suppressor has to know B's carrier phase. It does,
exactly, on the genlocked path; on the dirty path it is always late by however
far the fractional slip has rotated the carrier between samples, which leaves a
residue that breathes. That asymmetry is the mechanism, not a gap to close. The
same shape of limit governs the fill selector: a fill is only meaningful on the
genlocked path, because a fill is what sits _behind_ the foreground and only a
crossfade has a behind. The row is gated on genlock.

What is left:

- **The PiP inset keeps its luma key alone.** Wiring the chroma key into the
  inset is two lines, since `chromaKey` already takes an index and the inset
  re-encodes from `yuvB`/`uvfB`; left out to keep the first pass one box.
- **Nothing keys off A.** A self-key on the program bus (A's own backing cut so
  the loop bus shows through) is the same function pointed at the other input,
  and would need A's chroma materialized the way `uvfB` materializes B's.
- **Keyer bandwidth is the encoder's.** A real keyer has its own key-processing
  filter ahead of the slicer, usually narrower than the encoder's chroma. A
  short boxcar over `uvfB` would make edge softness a control of its own rather
  than a side effect of `encChromaMHz` — at four more storage taps per active
  sample, which is why it is not there.

## Video synth follow-ons

Phase is carried as cycles at frame start plus the walk per line and per sample
rather than as a frequency, both for f32 precision across a 477750-sample frame
and because the per-line walk **is** the lean of the pattern. Two later
findings: the FM term has to multiply the sample index, not the phase — pulling
a frequency makes the wave genuinely run faster through bright picture, where
offsetting a phase only slides the pattern about and never produces a contour.
And the synth-over-picture patch is **slot A only**, because `compose` has the
slot's picture in hand while `compose_b` writes its texture rather than reading
one. Left as an asymmetry rather than plumbed around.

**The colorizer is the only reliable way to get colour into large fields**,
because it maps _level_ to hue, and level varies over hundreds of lines where an
encoder puts colour on detail. Everything measured against it coloured detail
instead: phosphor scatter (17.5 fringe — it spreads only the light the layer
already holds and leaves the fresh edge sharp by design), a magnetised purity
patch (17.9), collapsed demod axes (20.2), colour-under smear (35.1, and worse
than doing nothing, since its per-line jitter is speckle). Note the limit of
that measurement: `colourcheck`'s `fringe` column reads edge _contrast_, not
edge count, so a posterizer holding four enormous hard-edged fields scores like
speckle. Low fringe proves flatness; high fringe does not prove fringing.

- **One waveform selector serves both oscillators.** Hardware would have one per
  VCO; a ramp beating against a pulse is a patch this cannot express.
- **No ramp reset off drive.** Real ramp generators are reset by H and V drive,
  which is why they hold still; here a "ramp" is an oscillator that happens to
  be at drive rate, so it is only ever as steady as the number typed in. Exact
  is reachable (`synthAHz` = 15734 lands within a hertz), but a genuine
  drive-locked mode would give a gradient that cannot creep at all.

## The mixer has no hardware model

`mix_b.wgsl` combines the two inputs with arithmetic —
`aGain * a + gate * (bGain * b + ...)`. Three real mechanisms are missing, all
cheap:

- **Crosspoint crosstalk.** A cheap switcher leaks the unselected input at about
  −40 dB, and the leak path is stray capacitance, so it is _high-pass_: what
  gets through is B's subcarrier and edges, never B's flat areas. With the fader
  fully closed you still get a faint moving rainbow from B's detuned carrier
  beating the burst-locked decoder, and no visible picture — "there's something
  else on this wire", which is not drawable. It interacts with the gates: a
  non-zero crosstalk floor has to appear in `bWaveOn`/`bOn` or B's chain is
  switched off underneath it.
- **Genlock that can lose lock.** `bGenlock` is an absolute TBC today. Real
  genlock has a capture range: push B's pause wander or wow past it and lock
  drops, B rips for a few lines, and it re-hunts. That makes the corrective
  box's _failure_ a function of how hard B is driven.
- **Mid-field cut.** A switcher cuts at the vertical interval; a cheap A/B box
  or a relay cuts wherever you pressed it, tearing one frame into two
  half-pictures with a broken field sequence. Cheap in `mix_b` (a cut position
  in raster time rather than a crossfade), and it is the natural performance
  gesture.

Considered and left: **a house-reference selector** (letting B be the raster
instead of A) would double the expressive range of all of the above, but B _is_
the second raster — it is a restructure, not a knob.

### The loop bus into the B input — sized, not built

The one item from the loop-hardware pass that was started and put down. B's
dirty path resamples a signal, so patching the mixer's own loop bus in there
makes the machine's past arrive **non-genlocked**: `bLineHz` becomes a shear
that compounds a lap, `bRollLps` a drift per lap, and `bDetuneHz` a continuous
hue _rate_ where `cfbDelayUs` is a fixed rotation. Every feed-B fault then lands
on the return — pause scatter, ground loop, dropouts, an SSAVI negative — and
the return's own sync tips fight A's, so the receiver locks to the machine's
past for bands of lines.

The shader half is nearly free: `mix_b` already binds `loopBus` for the keyer's
fill, so the dirty-path resample is a choice of which buffer it reads. What
stops it being cheap is everything around that:

- **It wants to be a source-B mode, not a knob.** The gates (`bOn`, `bWaveOn`,
  `bFeedOn`) all require `bEnabled`, so as a control it would need a B source
  picked in order to patch the loop in _instead of_ a source. As a mode it is
  `SOURCE_B_MODES`, `SOURCE_DESC`, `SOURCE_KIND`, the picker, and the docgen
  source list.
- **The B encoders have to stay off in that mode**, a fourth condition in gates
  whose containment (`bFeedOn ⊆ bWaveOn ⊆ bOn`) is under test.
- **The chroma keyer reads `uvfB`**, which does not exist for the loop bus.
  Either the keyer is gated off in the mode or the loop's chroma is
  materialized, and the first is the honest cheap answer.
- **`SlotSource` has to carry it** or a device loss drops the patch, per the
  three-setters rule in `ARCHITECTURE.md`.

None of that is hard; it is a different size from the rest of that pass, and it
crosses the source layer, which none of the others did.

## Capture / deinterlace

- **Motion-adaptive deinterlace.** Current `deint` is an unconditional
  even-field bob — it halves vertical resolution even on still frames. Weave
  where fields match and bob only where they differ (a per-pixel inter-field
  delta metric) keeps sharpness off motion.
- **Deint modes instead of on/off.** off / bob (current) / blend (average both
  fields — ghosts on motion, keeps res) / weave. Blend is cheaper and some
  people prefer its look.
- **Auto-detect interlacing.** Measure a comb metric on the incoming source and
  flip `deint` on only for genuinely-interlaced feeds, instead of hard-enabling
  it on every webcam/USB connect.
- **Remember the last capture device.** Persist the chosen `deviceId` so a
  reconnect re-selects the dongle rather than the OS default camera.
- **PAL capture.** Composite grabbers also deliver 720×576/50i; the pipeline is
  NTSC-shaped (525/60). At minimum square-pixel it correctly; ideally note the
  standard mismatch in the UI.

## Deflection

- **Intra-line geometry.** `hSize`, `hLin` (S-correction failure stretching one
  side), pincushion. Blocked on decode's tiling: the workgroup stages one
  contiguous span per row, so only _row-uniform_ horizontal offsets are free.
- **Vertical linearity.** `vSize` shipped and was nearly free (the raster row
  remap is a function of the screen row alone, so decode's row-uniform
  constraint never bites). `vLin` — the top-of-frame stretch of a failing
  vertical output stage — is a quadratic term in the same remap.
- **Fractional bend.** `hoff` is `round()`ed to whole samples; at large
  amplitudes adjacent rows stair-step. Resampling the tile with `catmull` would
  smooth it, at the cost of restructuring the staging.

## Screen-domain effects

- **Per-channel bloom radius.** One radius serves all three channels; the
  phosphors don't actually scatter alike. Note that `crtHaloKey` keys the halo
  radius off the _destination_ pixel's own drive, because a gather has to pick
  its radius before it samples. That widens how far a bright area reaches _in_,
  which is the visible half; genuinely widening how far a highlight throws light
  _out_ needs a second, higher-threshold ring rather than a keyed radius.

Two things the last screen pass taught, for whoever adds the next fault.
Convergence has to re-run the whole beam-spot integral per channel — blurring
one shared sample averages the landing error away instead of leaving a fringe —
so it costs 3× the spot taps whenever it is non-zero, behind a uniform branch.
And every new mechanism has to be added to the identity-copy early-out at the
top of `crt_face`'s `main`, or turning it on by itself reads as a dead control.

## Boxes in the rack

In rough payoff-per-effort order. (A preset worth authoring off the shipped
`diffPhaseDeg`: inside the mixer loop, differential phase separates a feedback
trail into colour layers by brightness, because `cfbDelay`'s rotation per
generation stops being uniform.)

- **A DVE / framestore, as the digital box in the analog last mile.** Distinct
  from the digital cable tier below, and more era-correct. An ADO / A53 /
  WJ-MX50 cannot work on composite, so it decodes to 4:2:2 601 on a 720×486,
  13.5 MHz raster — a different raster from ours — and re-encodes. The payoff is
  **cascaded encode/decode generations**: whatever the decoder got wrong becomes
  real picture, so dot crawl bakes into luma, re-encodes as chroma, crawls
  again, and `combMode` selects which fixed point the iteration falls into. That
  is why multi-generation composite editing looked the way it did, and it is the
  one mechanism here that manufactures colour from nothing. Once the framestore
  exists the consumer digital-effects buttons follow as one mechanism each —
  mosaic and multi-image are decimation with no prefilter, so the tiles alias
  and the subsample pattern beats against the mask.
- **Frame-recursive noise reducer.** A corrective box whose failure mode is the
  effect, which is why it is more interesting than the TBC declined below. Frame
  averaging gated on a motion threshold: below it, noise freezes into fixed
  plateaus and the picture goes plasticky; above it, motion drags a soft trail
  with a hard edge where the gate trips. Put the threshold in the noise floor
  and the grain drives the detector, so still areas breathe.
- **Rutt/Etra scan deflection.** The source's own luma patched into the vertical
  deflection amplifier: the raster becomes a relief map of the picture, and the
  brightness comes free from line bunching (line density _is_ luminance). Fits
  the deflection domain exactly — geometry detonates while hue stays put. The
  catch is that it is a per-pixel _vertical_ gather, so it wants `crt_face` over
  the decoded image with a bounded column search, not `decode`.
- **Setup mismatch** — a 0 IRE deck into a 7.5 IRE set and back, for crushed or
  milky blacks. The last of the smaller trims.

Considered and not worth it: **PAL / Hanover bars** (a raster change, not an
effect — `constants.ts` is 525/60 throughout) and **standards-converter
judder**, which needs 50 Hz first.

## Interlace

`ARCHITECTURE.md` calls progressive 525/60 "the largest remaining authenticity
gap". It is a raster restructure rather than a knob: fields at 262.5 lines with
the half-line offset, and everything indexed by row has to learn which field it
is in.

What it pays for. Vertical roll steps a whole frame at a time today because a
frame is the only unit there is; at field rate it would creep the way a real one
does. Head switch would land where it actually lands. The 2- and 3-line combs
would see the line relationships they were designed around instead of the
progressive stand-in. And it changes what `dropoutComp` looks like: a real
compensator's 1H delay operates _within a field_, so the line it patches from is
two raster lines up on the glass rather than one. The complementary hue is the
same either way — 227.5 cycles does not care — but the patch would visibly come
from further away, which on fine horizontal detail is a different artifact.

## Instruments and pixel checks

- **A waveform monitor, overlaid.** One line of it landed as the scope tap
  (`#dbg=6`): a single line traced against an IRE graticule inside `decode`,
  columns filled min..max so an edge connects and a modulated sample draws its
  envelope. The real instrument is every line of the field overlaid at once,
  where the density of the trace is how many lines agree — a chroma error on
  eight lines out of 480 is invisible on one line and obvious on all of them.
  That one is a pass: `decode` would scatter into a bins buffer and `present`
  draw it, with a finite spot on the way out, or a flat field lands every sample
  in one bin and draws as a speck.
- **A line selector for the scope.** It traces the middle line because that is
  where the cursor is parked; the interesting lines are the head-switch line, a
  line inside the VBI, the line a dropout is on. Wants a control and a draggable
  cursor.
- **Extend pixelcheck.** `scripts/pixelcheck.mjs` pins the six SMPTE hues and
  the fine-tuning cliff; any deterministic `#set=` look plus a probe is one more
  pinned fact. Candidates: burst-lock hue rotation, the killer threshold,
  scramble's wash-out level.
- **Read VITS back as the app's own frequency response.** Lines 17 and 18 are
  already stamped with the real instruments — multiburst stepping 0.5 to 4.2
  MHz, and the modulated staircase differential gain and phase were measured
  off. They are then eaten by the chain like everything else, so demodulating
  them at the receiver end and reading the packet levels back answers what the
  whole path is doing to frequency, and to chroma amplitude and phase against
  luma level. That is not an approximation of the broadcaster's number, it is
  the same measurement on the same signal. Two things fall out: an instrument
  worth drawing (a response curve beside the waveform monitor), and a rail — a
  `#set=` look plus a response is a pinned fact about the chain that no pixel
  probe reaches, because a filter regression moves the curve long before it
  moves a hue. `vir.wgsl` is the worked example of the gate-and-demodulate half,
  and `buzzBuf` of getting a per-frame measurement back to the CPU cheaply.
- **Count the caption channel's errors.** A wrong word is _countable_ in a way a
  wrong pixel is not — feed a known string, read the page `caption.wgsl`
  recovered, and the character error rate is one scalar per look. That makes a
  regression rail out of a thing already built, with no tolerance to tune and no
  screenshot to eyeball. It also fails in the right direction: the slicer sits
  at the far end of sync, timing and the whole channel block, so a regression
  anywhere upstream shows up as a misspelling, and the number says how bad
  rather than only that something moved.

## Digital cable tier

Macroblocking, DCT ringing, frozen last-good-blocks, motion-vector smear. Large
— it is a codec, not a knob — and it does not compose with the composite chain,
so it is only interesting under one framing: a digital head-end feeding an
analog last mile. Box → impairment → NTSC encode → the entire existing chain,
which is era-correct for the late nineties and is genuinely mechanism modelling.
Not worth starting until something needs it.

## Patching into other apps (Max/MSP, Jitter, TouchDesigner, VJ software)

Already works with no code: MIDI CC and MIDI clock in (`src/ui/midi.ts`) via a
virtual port; audio in by sharing the tab or app it plays out of
(`AudioState.enableSystem`) or via a loopback device, either of which reaches
`audioBendUs` / `audioLoad` / `audioIre`; Jitter output in as a webcam through a
Syphon→virtual-camera bridge; and output back out by pointing an OBS browser
source at the page. The gaps below are what would make it feel like a patchable
module rather than a coincidence.

- **OSC control, via a local WebSocket bridge.** Browsers can't speak UDP, so
  this needs a small node process doing OSC↔WebSocket. Worth it because
  `DEFAULT_CONTROLS` is already a flat named record and `useMidi` already
  funnels every store-origin change through one `writeControl(key, value)`: a
  bridge lets Max address `/hHold`, `/scDetuneKHz`, `/bendUs` by name, with
  float precision and no 128-control CC ceiling. The app side is a thin client
  that validates the key against `ControlKey` and calls the existing write path.
- **Bidirectional state.** The same channel in reverse, so a Max patch's UI
  tracks the app and presets can be recalled from outside. Needs a loop guard on
  the write path.
- **A saved look on a pad.** The note-binding family shipped (`ActionTarget` in
  `ui/midi.ts`), so the wire exists — what it carries is the thirteen gestures
  that need nothing but a velocity. A saved look is a different shape: its name
  comes from a list that changes under the binding, which is the problem
  `preset:` already solves for knobs by binding the name and dropping the entry
  when the name goes. `savedProfiles.ts` would need the same treatment. Program
  change is the other half — one message per look — and would want its own
  family again, since a PC carries a number rather than a velocity.
- **MIDI transport, not just clock.** `midi.ts` handles `0xF8`/`0xFC`; honouring
  `0xFA` start / `0xFB` continue would let clock-locked rates reset phase on
  downbeat instead of free-running from whenever the tick stream began.
- **Live low-latency output.** WebRTC to a local peer, or NDI via a native
  helper, for feeding the result back into Jitter without the OBS round-trip.
  Meaningfully more work than the rest of this list; only worth it for
  performance use.

Note for anyone evaluating the reverse arrangement: Max's `jweb` embeds a web
view but is unlikely to expose WebGPU, so hosting videoskillet.js inside a patch
probably isn't viable — it wants to be a separate app you route into.

## The modulation bay

What was deliberately left:

- **Performance macros — cut, not deferred by accident.** The design was three
  assignable 0..1 knobs routed through the same eight slots as the LFOs, which
  makes the good case the expensive one: a macro is only worth a knob once it
  drives several controls at once, which is exactly when it eats the most slots,
  at four clicks and one slot per control. The motion amount does the
  one-gesture-scales-the-patch job with no assignment ritual, and the MIDI
  binding key now reaches beyond `ControlKey`, so a knob can drive the motion
  amount or a preset weight. If macros come back they need their own routing
  table, not a berth in the LFO bay.
- **Modulating the five filter controls** (`encChromaMHz`, `demodMHz`,
  `chromaTail`, `lumaMHz`, `lumaPeak`) rebuilds the FIR bank every frame.
  Allowed from the UI deliberately — it is a real patch someone may want — but
  authored presets are forbidden it by `presets.test.ts`. If it ever needs to be
  cheap, the bank would have to be rebuilt only when the modulated value crosses
  a meaningful step.
- **`#surprise` on boot stays controls-only.** A rolled recipe applies its
  motion in the app, but the boot path layers controls before the bay exists.
  Accepted asymmetry.

Two things the one-shot envelope had to get right, for whoever extends the
family. Firing is an **event**, so it goes to the engine as a method rather than
a field on `ModSlot` — a flag on a slot list that presets, links and undo
rewrite wholesale would have to be cleared by whoever set it. And a press lands
_between_ two frames, so the trigger is held in a set until a frame picks it up;
sampling an edge at 60 Hz loses roughly one press in every few. The related rule
is what an _unbound_ note does (`noteAction` in `ui/midi.ts`): with nothing
bound every note fires the bay, which is the right reading of an unmapped
keyboard, and binding one pad lifts the blanket. Written the other way round a
pad would strike its slot and knock every other envelope over on the way.

### The stab gate

Two things it is still missing, both surfaced by pulling on "the stabs slider
does not work":

- **It does not travel with the look.** The gate lives in `localStorage` and
  nowhere else — not in `#mod=`, not in a preset's routings, not in a saved
  look. A link, a preset or a saved profile therefore drops the most visible
  thing the bay does, and whoever opens it sees a still picture where the board
  had been cutting four times a second. `useModSlots.ts` carries the reasoning
  for why it belongs in both; what is owed is the schema change to `#mod=` and
  to the preset routings, with readers that tolerate its absence the way
  `readStab` already tolerates a junk entry.

  The held-look pass raised the stakes and complicated the schema in the same
  stroke. A gate whose far end is a look is two numbers and a whole second
  board, so a link carrying one would roughly double the query string. The shape
  to reach for is probably the strip's: store the far board as a diff against
  stock, since a held look is usually a handful of controls off it and
  `writeProfileParams` already knows how to write that. Storing a preset _name_
  is the tempting cheap version and is wrong for the same reason `Stab.to` is a
  board rather than a name — the look you hold is usually one you dialed.

- **No knob can reach it.** The row passes `sync` but no `midi`, so the one
  lever `signal/stab.ts` describes as "the kill switch a bender keeps a thumb
  on" is mouse-only, while the motion fader an inch away is a `BindTarget` at
  the front of the auto-map spine. It wants a `'stab'` target beside `'motion'`
  in `ui/midi.ts` — its span is the row's own 0..`STAB_HZ_MAX` in tenths rather
  than the `UNIT_SPAN` the other two non-control targets share, and since the
  layering puts `midi.ts` under `modSlots.ts` that number has to be written
  twice and pinned with a test, the way `STOCK_HOLD` and `VIEW_KEYS` are — plus
  a sink in `app.tsx` beside `setMotion`. The open question is
  `AUTOMAP_TARGETS`: inserting it after `MOTION` shifts every knob for anyone
  who re-runs the auto-map.

Worth knowing for anything built near the gate: the _hard_ flip between two
looks is the affordable one and a crossfade is not, since the filter bank is
redesigned whenever a filter control moves — a cut pays that on the two edges of
a cycle, a fade would pay it every frame. That is also why this is the gate's
job and not a mod slot's: a routing drives one `ControlKey`, and two looks is
every key at once.

## Clip cues

`ui/cue.ts` marks a cue on a clip's own timeline and loops a stretch of it; the
clamp is `VideoPump.wrap`, and `armHead`/`promoteHead` in `ui/videoSlot.ts` give
the loop a second read head so the wrap does not seek. Three things around it
are deliberately not done.

- **A cue row in the Deck.** The Deck is the panel's second index for controls a
  hand moves during a take, and a cue is exactly that. It is not there because
  every row the Deck renders is backed by a control read through
  `ControlsContext`, and a cue is deliberately _not_ a control — two timestamps
  into one clip cannot be recalled by a preset or moved by mutate. So the Deck
  would need a way to take per-source state, which is a new pattern rather than
  a placement. The command palette carries the two verbs meanwhile.
- **Beat-snapped loops.** `useTempo` already has a beat, and ½/1/2/4-bar buttons
  from the cue would give exact musical loops. Left out for now: it doubles the
  row, and it is inert on a machine with no tempo set, which is most of them.
- **A de-click envelope on the wrap.** All that is left of the dropout: 11 ms is
  one frame, which is a click rather than a hole, and fading the gain across the
  join is the standard fix. It was worth almost nothing against the half-second
  hole the seek used to cost; against what is left it is the whole remainder.

Three things the read head taught, and the first two were not in its design.

**The two elements do not contend for the preroll slot, because the bound that
rule protects is _files_.** This was filed as a policy decision and dissolved on
contact: a preroll is speculative and names a different clip, so it can cost a
whole download; a loop's head is the same url as the element on air, which for a
`blob:` is the same object and otherwise a cache hit. Sharing one field would
have made a rundown's lookahead and a marked loop take turns breaking each
other, to protect a budget only one of them spends. **The expensive-looking part
of a feature is worth re-deriving before it is paid for.**

**The first cut made the sparse case worse, and only measurement said so.**
Where the outgoing head cannot re-park within one lap, both elements seek the
same expensive file at once: 1028 ms of dropout on half the laps in place of 213
ms on all of them — a better median, a worse sound. So the re-park is held
against its own lap and an overrun retires the head for the life of the cue,
with no minimum-lap constant, because whether a head can keep up is a question
about the clip and the loop together that the first lap answers. And it is **a
deadline, not a stopwatch**: checking elapsed time inside `seeked` cannot fire
until the re-park finishes, so an overrun stayed armed for the whole of its own
overrun, and a re-park that never completed never fired the check at all.

**The wrap-cost readout became the threshold two attempts could not build.** A
loop with a working head does not seek, so `wrapCostMs` reports nothing; when
the head gives up, the number comes back. It appears exactly when looping this
clip here is costing something — by mechanism rather than by a cutoff someone
had to pick. That took one line to hold: a relayed wrap has to _clear_ the
health window rather than merely not add to it, because a head is armed
unawaited and a big file wraps by seeking a lap or two before it lands.

The measurement behind all of it, from `scripts/wrapsound.mjs` — an AudioWorklet
on the app's own analyser, over a generated tone so floor means silence:

    arm            wraps   seek     silence   quiet
    intra:seek        13    7 ms      11 ms      1%
    intra:head        11     --       11 ms      0%
    dense:seek        13   14 ms      21 ms      2%
    dense:head        13     --       11 ms      0%
    sparse:seek       10  237 ms     245 ms     18%
    sparse:head       13     --       11 ms      0%

**The silence _is_ the seek**, plus about one animation frame — two independent
instruments agree to within 15 ms across three orders of magnitude, so there was
never a separate audio cost to fix. Read the relationship, not the numbers:
these are `testsrc` fixtures, about as cheap to decode as exists, and the dense
arm's 11–14 ms is 64–90 ms on `demo-v2.mp4`. Two notes for re-running it.
`public/test.mp4` has no audio track at all, which is why the fixtures are
generated. And the run steps the engine from Node rather than riding rAF,
because the region clamp lives in `VideoPump.pump()` and an occluded window
wraps once a second.

## Intercarrier buzz — taking the detector off the main thread

`signal/buzz.ts`'s `detect` runs on the main thread, inside the callback
`gpu/buzzread.ts` gets back from `mapAsync`. Measured with the slider up: 20.0
µs for the 525-line DC-block/hiss/tanh loop and 1.7 µs for the copy that gets
transferred — about 25 µs a frame once the `postMessage` is counted, or 0.13% of
a 60 fps budget. Nothing at all at `buzzLevel` 0.

**The part worth moving is the part that cannot move.** The `GPUDevice` belongs
to the main thread, `mapAsync` resolves on whichever thread owns the buffer, and
`getMappedRange` hands back an `ArrayBuffer` the browser detaches on unmap — so
nothing can forward it to a worker or a worklet. What is left on the main thread
is the callback, a memcpy and a `postMessage`: roughly 2 µs of the 25. Moving
the device itself means reopening [0003](adr/0003-delete-the-worker-engine.md).

Two routes, if anyone revisits this:

- **`detect` into the worklet.** Send the raw `(mean, dev)` pairs rather than
  finished samples — 4.2 KB instead of 2.1 KB — and do the arithmetic on the
  audio thread. Simple, and it puts a 20 µs loop on the thread with the hardest
  deadline in the app: 0.75% of a 2.67 ms quantum at 48 kHz, once every six
  quanta. Safe, and still the worse of the two.
- **`detect` onto the GPU.** `sync.wgsl` already carries the pattern for a
  serial recurrence, so a `buzz_detect` pass would sit beside it: the DC
  blocker's state in two persistent slots, `pcg`/`gauss` for the hiss, and
  `tanh` is a WGSL builtin. The readback then carries finished audio, which
  halves it. The cost is the tests — `signal/buzz.spec.ts` makes six behavioural
  assertions on `detect`, and in WGSL each becomes a shader naga typechecks and
  nothing exercises.

**What would decide this is a number nobody has.** The 25 µs above is the JS
only; `mapAsync`'s own main-thread cost inside Firefox is unmeasured, and it is
the half that stays put however the other half moves. A `performance` measure
around the flush and one `buzzsound` run would settle whether the rest is worth
chasing.

## Not worth building

- **Cochannel interference.** Already reachable: source B's dirty-sum path is a
  second non-genlocked composite beating against A, with its own line and
  subcarrier detune. That _is_ cochannel. (Adjacent-channel is not — that
  shipped as `rfAdjacent`, and is carrier beats rather than a second picture.)
- **A TBC.** A corrective box that removes `tbJitter`/`tbWow`. Inverse-effect
  controls are interesting for performance but nobody has wanted one.
- **An After Effects / Premiere / OpenFX plugin.** Declined at length in
  [`EDITOR.md`](EDITOR.md), which also says what the reusable part turned out to
  be and where the editor-facing work actually goes.
- **A camera loop aimed off-centre.** It dims away even at a round trip of 1.1
  with the zoom under 1, because the off-axis shift carries most of the picture
  out of frame each lap and the gain has nothing to compound. Two tunings tried;
  neither held a picture.

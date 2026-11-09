# Ideas / backlog

This page holds the things worth doing that are not done, and the things that
look worth doing and are not, so a future pass does not re-litigate them. Where
a shipped feature left a lesson the next person needs, it is here under that
feature's gaps. The rest of the working-out is in the commits, so an entry here
is cut once it is built or once it stops being worth the page. Grep the
described feature rather than trusting a line number.

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

- **Garble as a strength.** The rate is one constant picked by eye.
  `#garble=0.8` would carry a strength without breaking the flag — `q.has` is
  true whatever the value — but the dialog would grow its first slider where
  every other thing a card carries is a checkbox. Worth doing when someone
  reaches for it.
- **Attributes the card does not decode.** Text colour, mosaic colour, new and
  black background, double height, flash and separated blocks shipped as control
  codes in the text, written as their control pictures (U+2400 plus the code),
  and `decodePage` in `sources/teletype.ts` runs them the way the SAA5050 did. A
  garbled card gets them for free: a hit on a colour code colours or uncolours
  the rest of a row, and a hit on a double-height code lets the row below show
  through. Hold mosaic and conceal are not decoded. The caption decoder and the
  character generator stay white on black, and both share the card's gap in the
  sections below.

- **Bending the card's own ROM.** Shipped for both character generators
  (`romAddr` / `romData` / `pageAddr` / `counterSlip` in `prelude.ts`, called
  from `decode.wgsl` and `chyron.wgsl`) and not for the card, because the
  caption's font is a ROM in a buffer where the card's is a canvas raster: two
  lines there against a rebuild of `dotGrid` here. What the shipped ones taught:

  - The address bus carries the character code in its high lines and the row
    inside the cell in its low ones, so one held pin sweeps from every glyph
    growing a seam to the whole font substituting.
  - A pin is held _high_, not switched, so a glyph whose bit was already set is
    untouched and the damage is uneven the way a jumper's is.
  - A bend is deterministic, which separates it from `garbleRows`: the same text
    comes out wrong the same way every time, because the machine is wrong and
    the wire is fine.
  - The five held faults (`romStride`, `romCross`, `romAddr`, `romRot`,
    `romData`), and the page-address bend (`ccPageAddr` / `cgPageAddr`, which
    keeps every character spelled right and lands it somewhere else), are
    static, so motion needed another kind. `romSlip` and `pageSlip` are counters
    that lose or gain counts, so the address drifts further every frame. A clock
    on a held pin would have modelled a jumper that flickers, which no jumper
    does.
  - The part is a 2 KiB EPROM on eleven address lines holding a 1152-byte font,
    so 896 bytes were never programmed. `romAddr` masks to the bus and the
    callers answer anything above the font from `ROM_ERASED`, which is why a
    high line held returns solid characters instead of another glyph.

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

The fill input takes the box's own characters or the mixer loop bus
(`cgFillFrom`). The bus is a whole picture, so it is fed in unshaped: the key
does all the cutting, and the edge generator fills its border with black. The
store records every frame with the chyron in it, so letters filled from it hold
the frame before, and an inverted key holds the whole raster with the live
picture showing through the letters. That fill is always colour framed, since a
frame sync feeding a switcher input has to be. The characters themselves can be
coloured (`cgHueDeg`, `cgSat`) as luma plus chroma on the house carrier, at the
fill level, so a saturated colour at 100 IRE runs past peak white.

What it does not do:

- **Freeze as the fill.** It would fit the same input, but the store has one
  freeze button, and the keyer and this box would both be pressing it.
- **Per-character attributes.** The colour is the whole page's, which is the
  same attribute work the teletype card wants.

The generator has its own font ROM and its own set of pins to hold (`cgRomAddr`,
`cgRomData`, `cgRomCross`, `cgRomStride`, `cgRomRot`, `cgPageAddr`) and its own
two counters to slip (`cgRomSlip` and `cgRomLineSlip` on the font address,
`cgPageSlip` on the page), separate from the caption decoder's in the set. They
share the baked ROM bytes and nothing else, so bending one says nothing about
the other. The wiring itself is shared — `romAddr`, `romData`, `pageAddr` and
`counterSlip` in `prelude.ts` — because the part is the same part, and each box
calls them with its own knobs.

The one thing that is not shared is the decay pattern. `romData` takes a die
seed (`ROM_DIE_CC`, `ROM_DIE_CG`), so one `rot` setting damages a letter
differently in each box. Seeding it on the address alone had both chips decaying
in identical places, which is the invariant this whole split exists to keep.

## Chroma key follow-ons

The keyer slices `uvfB` — B's chroma after the encoder's bandlimit — turned by
the angle B's carrier stands at against the house reference (`busPhase` in
`mix_b.wgsl`). The encoder's filter makes the soft-across/sharp-down composite
edge, and the detune makes the per-line breathing on the dirty path. B's hue
trim, video gain and inversion reach the key the same way. Reading `uvfB` gives
the keyer a perfect Y/C separation, and that is deliberate: demodulating the
composite through a four-sample aperture, as the loop's keyer does, turns a
full-range luma step into about 0.7 of false chroma, more than a saturated
primary carries, and speckles every outline the key cuts. The keyer showed two
things.

The keyer had to read B's chroma at **B's own raster index** on the dirty path,
the same index the fill is resampled from. Keying at the output sample instead
parks the hole on the output raster and the subject rolls out from under it —
the three-domain mistake in one line.

And **spill suppression cannot be a colour operation here**: luma and chroma are
the same wire, so the only honest null is reinjecting the backing's subcarrier
antiphase, which means the suppressor has to know B's carrier phase. The keyer
measures it against house, so the suppressor reinjects along the key hue on the
house carrier and follows B's carrier wherever it has slipped. What it cannot
null is the part of the backing that has drifted off the key hue. On the
genlocked path nothing drifts and the null is flat; on the dirty path the detune
walks the backing round the wheel, and the part off the key hue survives as a
residue that breathes with the walk. That asymmetry is the mechanism, and the
suppressor keeps it on purpose. The same shape of limit governs the fill
selector: a fill is only meaningful on the genlocked path, because a fill is
what sits _behind_ the foreground and only a crossfade has a behind. The row is
gated on genlock.

Four things landed after that, and each turned on a choice worth recording.

**The additive keyer** (`bKeyAdditive`) is the Ultimatte's design on the bus.
The comparator cannot key a shadow: a shadowed backing falls under the clip and
stays as a green veil over the fill, and raising the clip turns the veil opaque.
The additive box measures how much backing a sample holds against the backing's
lit level (`bKeyLevel`, `bKeyBackY`), subtracts that share of the backing and
adds the same share of the fill, so a shadow becomes a shadow on the fill and a
strand finer than the chroma band keys part way. The share is the chroma along
the key hue less the chroma across it, weighted so the two balance at the
acceptance edge. That keeps the wedge meaning what it means for the comparator
and leaves colours off the key hue untouched, which spill kill does not: at 0.8
it turned a teal near the key hue blue. The calibration wants to sit a little
under the lit backing, because a backing is never lit evenly; the camera tap
stores the sampled backing and sets 0.8 of it.

**The keyer slices B's feed damage**, so the key chatters on a noisy source.
Demodulating B's whole composite would bring back the luma-edge speckle above.
What it demodulates is B's waveform less B as the encoder wrote it, so B's own
luma cancels and only the damage is left. It runs only while `bFeedOn`, passed
as the per-frame `bKeyFeed`, so an undamaged B keys exactly as before.

**The key edge generator** (`bKeyEdge`: border, drop shadow, extrude) runs the
key through sample and line delays and fills where the copies reach past the
subject. It slices the key with a comparator of its own. Without that, the
comparator's part-kept shadow grew a speckled border, and under the additive
keyer every shadow did. Its taps read the clean key. With B damaged, the four
damage taps multiplied across nine key evaluations took `mix_b` from 0.62 to
1.56 ms on extrude on a WX 3200, and the edge comparator hides the chatter
anyway. Extrude shades each copy's matte down with its delay, so the slab is lit
where it meets the subject.

**Freeze flashes by design.** With colour framing off, a frozen frame or a
loop-bus copy read out on the other subcarrier phase decodes in complementary
colours, so the held picture alternates every frame. The user likes the
flashing, and colour framing is the switch for anyone who does not.

A field freeze, the store read line-doubled, was tried and is barely visible on
real pictures. It is not worth a control.

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
- **The key edge row is gated on genlock alone.** With the key at 0 it reads as
  live and does nothing, the same as the fill row. A gate cannot name two
  conditions yet.
- **The 0.8 calibration has only met synthetic backings.** A real room on
  `/cam/` is the test it still needs.

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
- **Drive-locked ramps reach the combiner only through the shape generator.**
  `synthBSrc` puts a diamond, circle or rectangle built from H- and V-drive
  ramps on the combiner's second input. Oscillator A is still free-running, so a
  plain gradient on A is only as steady as the number typed in.
- **No wavefolder after the shape generator.** Concentric rings come from the
  comparator colorizer's three thresholds, so there are at most four. A folder
  on the shape's level would give as many as its gain allows.

## The mixer's hardware, and what is left of it

The Crosspoint group models three switcher mechanisms in `mix_b.wgsl`: the bus
cut (`busCut`), crosspoint leak (`bLeak`) and the genlock capture range
(`bWanderUs`, `bCaptureUs`). What none of them do:

- **The cut is a position and not an event.** A real relay fires at a press and
  leaves the bus on B afterwards, so one frame carries the seam. A slider holds
  the seam where it is put. An envelope or a trigger that fires a cut at a
  random raster position would model the press.
- **The leak is one-way.** A leaks into B's path while B is selected, through
  the same capacitance, and nothing models that.
- **Lock has no hysteresis.** A real genlock re-acquires at a tighter error than
  it loses lock at, so a line near the window flickers between held and not.
  Here the edge of a band is clean.

Considered and left: **a house-reference selector** (letting B be the raster
instead of A) would double the expressive range of all of the above, but B _is_
the second raster — it is a restructure, not a knob.

### The loop bus into the B input, sized but not built

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

## S-video

A true C signal exists only where a source's encoder builds it, because every
pass after the encoder reads one composite buffer and the mixer sums sources
into it. `aChromaPin` and `bChromaPin` take the luma pin out at each encoder
(`chromaPin` in the prelude), so what reaches the mixer is the encoder's own
chroma and burst. The program bus's `chromaPinOnly` is the deck's S-video out,
and its C is the deck's bandpass of the composite or its colour-under playback.
That matches what a deck's own separator outputs, including the luma detail near
the subcarrier that it lets through.

A two-wire Y/C input into the set was sketched and set aside. It would remove
dot crawl and cross-colour, give luma its full bandwidth and keep FM noise grey
on Y, and its faults come out small or already covered:

- **Y/C short.** On an S-video input this is composite with no separation, which
  `combMode` 0 with `svideoBleed` near 0.5 already gives.
- **A passive S-video to composite adapter.** A capacitor into 75 Ω has its
  corner between 2 and 4.5 MHz. The burst takes the same phase lead, so hue
  holds and the ACC restores the level.
- **C pin open.** The set trips its colour killer and shows black and white. The
  encoder-side pin with Y and C swapped would give this, if it is wanted.

The build would double `compA` to hold C, run `timebase` over both halves, route
every last-generation fault to a wire (FM luma noise to Y, `chromaNoise` to C),
and change `osd`, `lineAnalyze`, `vir`, `storePrev` and decode's staging.
`decode` already binds eight storage buffers, the default
`maxStorageBuffersPerShaderStage`, so C would have to share `compA`.

Five smaller items sit next to this:

- **The source pins run at the encoder, ahead of the feed.** `feed.wgsl` only
  sees the summed composite, so it cannot separate C. A feed's mistrack snow,
  tape dropouts, scrambler and the synth's summed sync are added after the pin,
  and they put luma and sync-like content back on a pinned source, though the
  panel draws the pin at the plug in the mixer's jack. The route that models it
  is the program bus's own: a tape recorded from composite carries the recording
  deck's bandpass as its C track, so `chroma_extract.wgsl`'s bandpass of the
  feed's damaged output is the C a deck's S-video lead sends. That splits
  `feed.wgsl` into the deck's stages and the cable's stages, with a gated
  extract between them that runs only while the pin is in, and the pin moves to
  the start of the cable half. A pinned source then carries the bandpass's luma
  near the subcarrier, as the program bus's pin already does.

- **The program bus's pin runs ahead of that generation's tape damage.** The
  last generation's FM luma noise and head-switch noise land on the pinned
  signal, though on a real deck they ride the Y wire alone. The scrambler runs
  ahead of the tape damage too. Hum, ingress and `rfSnow` are right where they
  are: a ground loop rides the shield whichever pin touches, and RF damage
  reaches the deck before its separator, so its chroma-band part is on C. Moving
  the pin after the tape damage means deciding what each fault does to C.
- **The program bus's cable runs ahead of the OSD and the enhancer.** The plug,
  the swapped pair and the termination act in the timebase pass, but the deck's
  OSD and the outboard enhancer both sit between the deck and the set's
  terminator and run in later passes. A double-terminated line into an enhancer
  with sync regeneration therefore arrives with full-depth sync, where the
  halved cable would halve the regenerated sync too.
- **A fractional Y/C delay.** `ycDelayNs` rounds to whole samples, about 70 ns,
  so the LFO on `the colour keeps walking` moves the colour a pixel at a time.
  Rotating the carrier by the fraction does not help: the burst rotates with it
  and the set cancels the rotation, and the envelope, which moves in
  whole-sample steps, stays where it was. The fix that works demodulates against
  `carrier(n)`, interpolates the baseband by the fraction and remodulates.
  Catmull-Rom on the modulated carrier loses about 12% of its amplitude at a
  half-sample, which would pump saturation with the LFO.
- **The RF faults on dubs.** The cable faults act once, on the generation the
  set plays back (`lastGen`). The tuner, ghost and ingress still run once per
  generation. They should act once as well, but the shader runs them ahead of
  the tape damage, which reads as recording off air on the first generation,
  while the connector, the swapped pair and the termination run after it, on the
  last. Choosing which generation the RF link belongs to changes the look of
  `wornTape`, which has two dubs and a ghost.

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

## Scrambler follow-ons

The eight systems in `scrambleMode` follow the sources: the GI timing at
https://www.philpem.me.uk/hacktv/analogcable/gi_scrambling, the Oak sine look
from the rec.video.cable-tv FAQ, and tri-mode's frame holds from
Radio-Electronics (February 1987) and Grossblatt's _Unscrambling Descrambling_
(the worldradiohistory Gernsback bookshelf). Not built:

- VideoCrypt's cut-and-rotate.
- A misaligned decoder box.
- Scrambling inside a feedback loop.
- Oak Sigma's inversion at scene cuts.
- Pixel checks for the scrambler.
- For the AC-coupled separator (ADR 0015): a per-line charging slice, sawtooth
  harmonics in the phase comparator, and a fast loop on lost lock.

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

Hosting the app inside a patch (Max's `jweb`) waits on that web view exposing
WebGPU. Until then it is a separate app you route into.

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

For whoever extends the envelope family: firing is an event, so it goes to the
engine as a method rather than a flag on `ModSlot`, and a press is held in a set
until a frame picks it up, because sampling an edge at 60 Hz drops presses. An
unbound note fires the whole bay (`noteAction` in `ui/midi.ts`) and binding one
pad lifts the blanket.

### The stab gate

Surfaced by pulling on "the stabs slider does not work":

- **It does not travel with the look.** The gate lives in `localStorage` and
  nowhere else: not in `#mod=`, not in a preset's routings, not in a saved look.
  A link or a preset therefore drops the most visible thing the bay does. What
  is owed is the schema change to `#mod=` and the preset routings, with readers
  that tolerate its absence the way `readStab` already does. A held look is a
  whole second board, so store it as a diff against stock the way the strip
  does, rather than as a preset name, since the look you hold is usually one you
  dialed.
- **The auto-map leaves it out.** The rate row is a `'stab'` bind target, but
  inserting it into `AUTOMAP_TARGETS` shifts every knob for anyone who re-runs
  the auto-map, so it is bound by hand.

A hard flip between two looks is the affordable gesture and a crossfade is not,
since the filter bank is redesigned whenever a filter control moves. That is
also why this is the gate's job and not a mod slot's: a routing drives one
`ControlKey`, and two looks is every key at once.

## Clip cues

`ui/cue.ts` marks a cue on a clip's own timeline and loops a stretch of it, with
a second read head (`armHead`/`promoteHead` in `ui/videoSlot.ts`) so the wrap
does not seek. Three things around it are deliberately not done.

- **A cue row in the Deck.** Every row the Deck renders is backed by a control
  read through `ControlsContext`, and a cue is deliberately not a control: two
  timestamps into one clip cannot be recalled by a preset or moved by mutate.
  The Deck would need a way to take per-source state, which is a new pattern.
  The command palette carries the two verbs meanwhile.
- **Beat-snapped loops.** `useTempo` already has a beat, and ½/1/2/4-bar buttons
  off the cue would give exact musical loops. It doubles the row and is inert on
  a machine with no tempo set, which is most of them.
- **A de-click envelope on the wrap.** What is left of the dropout is one frame,
  a click rather than a hole, and fading the gain across the join is the
  standard fix.

The measurement behind the head is `scripts/wrapsound.mjs`: the silence on a
wrap is the seek plus about one frame, and a working head removes it entirely.
The commit that added the head carries the numbers and what they taught.

## Intercarrier buzz off the main thread

`signal/buzz.ts`'s `detect` runs on the main thread inside the `mapAsync`
callback, at about 25 µs a frame with the slider up and nothing at all at zero.
The device and the mapped buffer cannot leave the main thread, so what could
move is the arithmetic, either into the audio worklet or into a `buzz_detect`
pass beside `sync.wgsl`. Neither is worth doing until someone measures
`mapAsync`'s own main-thread cost, which is the half that stays put either way.

## Camera page: preview thumbnails on the look chips

The camera page labels each look chip with its name alone, and a reader learns
little from a name such as "hue rides the light". A photo app shows each filter
as a small picture of itself. The cheap version is one still per look, rendered
by a harness in the way `scripts/camshots.mjs` renders the tour's stills, and
shown on the chip. A live preview of each look on the camera would need a render
per chip per frame.

## Retire "look" as a noun

The app and the docs call three different things a "look", and the word reads
badly in a sentence ("this look skips 5"). A rough grep finds about 560 lines in
`site/`, `src/ui/` and `docs/` that use it as a noun. Give each meaning its own
word:

- [ ] **The live state of every control** becomes **the board**, which
      `LookBar.tsx` already uses ("put the whole board back to stock", "a link
      to the board on screen"). Rewrite "the look on screen" and "every control
      this look moves off stock" in `LookBar.tsx` and `LookPopover.tsx`.
- [ ] **A stored set of settings**, built in or saved by the user, becomes a
      **preset**. `presets.ts` already names the built-in ones that way. Covers
      "saved looks", "bank the look" and "a rolled look".
- [ ] **A shared URL** becomes a **link**: "open this link", "a link to the
      board".
- [ ] **Running prose** names the control and its value ("with strobe hold at
      5"), or says "these settings".
- [ ] Sweep the help text, the user guide, `docs/` and `site/posts/`.
- [ ] Rename identifiers separately, after the strings: `LookBar`, `LookPopover`
      and the `look:` frontmatter field in posts, which the site build reads.

Words considered and set aside: **patch** already means signal routing here;
**snapshot** fits a stored state and not the live one; **scene** suggests the
picture's content; **E-MEM**, the vision-mixer term, is too obscure.

## Agent interface: `window.vf` first, an eval before anything more

`AgentDialog` and [`AI-USAGE.md`](AI-USAGE.md) send a coding agent to
`window.vf.applyControls`, whose writes are checked and reported as
`AI-USAGE.md` describes. The sibling repo `~/src/jbrowse-components` gives
agents a separate facade, `window.jb` (`packages/app-core/src/JbApi/`), with
evals in `scripts/agent-evals/`. A second global here, `window.vs`, was set
aside for two reasons:

- **`window.vf` is replaced on every device-loss rebuild and hot update**
  (`useEngine.ts`, `cam/useCamEngine.ts`), which matters only to code that holds
  a reference across a rebuild. A browsing agent evaluates `window.vf.…` afresh
  on each call and always reaches the live engine.
- **It is the concrete `Engine`**, typed as unstable. That is a documentation
  problem, and a second global does not change it.

What `window.vf` still lacks, all of which needs the app layer:

- **Undo.** The ctrl+z walk banks the app's own gestures (`beginHand`,
  `landCard` in `ControlsContext.ts`), so an engine write is probably not one
  step on it. Unverified.
- **Discovery.** There is no `find` or `describe`; an agent reads
  `llms-full.txt`. `find` would reuse `score()` from `paletteQuery.ts`.
- **Health.** There is no single call that says the picture is advancing. It
  would watch `frameNo()` advance and report the freeze, device-loss, hang and
  GPU-error callbacks, and never call `step()`, which draws past the frame lock
  and reports a healthy picture over a frozen tab. `timingBuf` holds the PLL,
  AGC and sync-separator lock.

**The eval comes first**, built on `scripts/agentreel.mjs`, which already runs a
real `claude` against a Chrome it launched and has a stop condition. It lacks a
grader.

- Tasks are graded on control values and receiver state after the session, and
  never on the transcript.
- Each task carries a `solution` that `selfCheck` runs, and the grader must fail
  the untouched board and pass the solution, as in jbrowse's
  `scripts/agent-evals/selfCheck.ts`.
- A held-out set is phrased apart from the docs and is never tuned against.
  `--runs N` reports passes per task.
- Negative tasks pass by declining. "Set the flux capacitor control" passes when
  the agent reports an unknown control.
- Pixel grading re-renders the agent's end link deterministically on lavapipe
  (`scripts/render/take.ts`, `openStage`) and checks only that the frame is not
  black and not frozen.

Undo, discovery and health get built when the eval shows agents failing for want
of them, as methods on `window.vf` or as a facade if they cannot live on the
engine. Also left out until then:

- A pixel `capture()` with statistics. Claude in Chrome has a screenshot tool,
  its JS tool returns text so a PNG arrives as base64, and counting dropouts
  from pixels detects the artifact where the repo models the mechanism.
- A `load(link)`. The reload in `useUrlState.ts` was chosen to avoid a second
  copy of the mount path, and ADR 0004 makes a reload cheap.
- CLI `--frame=N out.png` and `controls --json`. `llms-full.txt` lists every
  key, and `videoskillet in out -` already writes raw frames to a pipe.

## Signal diagrams

- **Fold away a plot that is flat at stock.** Several plots, such as Sync's line
  and frame shifts, are probably flat lines at stock and take about 45 units of
  height each. Folding one away until a knob moves saves that height, but the
  flat line also shows what the plot measures, and folding conflicts with
  drawing plots side by side. Ask before building it.
- **One list of group names.** The names repeat in `schematicKeys.ts`,
  `SCHEMATIC_FRAMES` and `HEADING`. The `Record<SchematicGroup, ...>` type
  already catches a missing entry, so this is low value.
- A shared `box()` factory for the diagrams was tried and dropped: the 22
  closures take five different signatures, so a helper needs as many options as
  it saves lines.

## Not worth building

- **WebMCP tools for the app.** An agent with a page-reading browser or a shell
  already evaluates JavaScript on the page. jbrowse-components uses MCP only on
  Desktop, where no page exists, and there it is four tools around
  `run_javascript`. A WebMCP layer would add a surface to keep in step with
  `controls.ts` and cover only agents that cannot run JavaScript, which the
  palette, `board as text` and `#set=` links already serve. If it is ever
  wanted, it is a shim over `window.vf`.
- **Cochannel interference.** Already reachable: source B's dirty-sum path is a
  second non-genlocked composite beating against A, with its own line and
  subcarrier detune. That _is_ cochannel. (Adjacent-channel is not — that
  shipped as `rfAdjacent`, and is carrier beats rather than a second picture.)
- **A TBC.** A corrective box that removes `tbJitter`/`tbWow`. Inverse-effect
  controls are interesting for performance but nobody has wanted one.
- **An After Effects / Premiere / OpenFX plugin, as a port of the shaders.** The
  shaders are a third of the simulator and the feedback loops need sequential
  render. A sequential-render OFX effect on a native wgpu build is the shape
  that could work; [`EDITOR.md`](EDITOR.md) has the working notes and the
  fixed-framerate export is what serves an edit today.
- **A camera loop aimed off-centre.** It dims away even at a round trip of 1.1
  with the zoom under 1, because the off-axis shift carries most of the picture
  out of frame each lap and the gain has nothing to compound. Two tunings tried;
  neither held a picture.
- **A Rutt/Etra scan processor.** A spike patched the picture's level into the
  vertical deflection and drew every Nth line as a beam trace. On still
  portraits, alone and layered with the subcarrier comb, ghosts, hum and the
  scrambler, it looked too digital.
  [ADR 0016](adr/0016-no-rutt-etra-scan-processor.md) has the renders and where
  the spike is parked.

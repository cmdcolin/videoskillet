# 0009 — The receiver finds its own black

## Status

Accepted.

## Context

`polarityFlip`, and the same swap on either feed, negated the composite line
faithfully and rendered a frame that was almost black. Two rounds of preset
screening recorded it (`reversePolarity` in CURATION.md, then
`signal and ground swapped` in round 3) and both moved on. A negated line on a
real set is a picture: a ghostly negative, torn wherever the content is bright,
rolling because nothing in the vertical interval looks like a broad pulse any
more. That look is worth having, and it was not reachable, because the receiver
was doing two things no set does.

Its sync separator sliced at a fixed -20 IRE, midway between nominal blanking
and a nominal tip. A negated line has its old tips at +40 and its picture below
blanking, so nothing ever crossed the slice where a tip should be and the
flywheel coasted. And `decode` referenced black to the constant `IRE_BLACK`, a
perfectly DC-coupled receiver, so every negated picture sample sat under black
and clipped.

## Decision

Model the two circuits a set has here.

**The separator is peak-referenced.** A capacitor-coupled separator slices
halfway down to the most negative excursion it has been charging to. `sync`
carries that reference (`timing[TIP_LEVEL]`): the frame mean of each line's
deepest excursion inside active video, with nominal sync as the floor, slewed
over a few frames. `sync_measure` slices at `min(tip / 2, -20)`. On any line
whose picture stays above blanking the reference is the nominal tip and the
slice is the -20 IRE it always was, so every such look is unchanged, noise
included — the peak is read inside active video precisely so that noise on the
tips cannot drag it. A waveform whose picture reaches below blanking — a negated
line, where the old peak whites are now the bottom of everything — pulls the
slice down into the picture.

A first cut read the peak off the tips the slicer had gated. On the negated line
that found the picture's left edge, measured a shallow "tip" just inside it, and
never descended to the whites; the frame stayed dark. The detector has to charge
to the deepest thing on the line whether or not the slicer fired there.

**The gate opens when lock is lost.** The separator hunts the narrow window
round the expected line start while it is locked, and the whole line once the
pulses have gone: `timing[GATE_WIDE]` counts frames on which fewer than a
seventh of the picture lines produced an edge, the gate opens after twelve of
them, and it closes again only when more than half the lines have an edge back
near nominal. The count is what keeps a hum trough or an AGC dip from opening it
— on the split-phase look the fraction found swings between 0.15 and 1.0 with
the bar, and a gate that opened on any one bad frame flapped and dragged the
restorer with it. On a negated line the gate is what lets the separator find its
"sync" in the picture, so the flywheel follows the bright content and the raster
tears around it rather than walking randomly.

**Black is where the restorer puts it.** `decode` subtracts
`timing[BLACK_SHIFT]` from `IRE_BLACK`. While the gate is closed black is
nominal: the model's blanking is the level a keyed clamp would find, and every
look tuned against a fixed black stays exactly as it was. With the gate open the
coupling floats — slewed over about eight frames — until the picture's mean
level sits at mid-grey, which is what an AC-coupled stage does with no clamp.
The negated line lands in that second state, and comes out as a negative around
a black level taken from its own average.

## The trap this was steered round

A back-porch clamp done properly, per line, cancels every additive hum bar in
the library at line rate: `humAmp`, both feed ground loops, the split-phase
look. And a clamp keyed to the measured porch, even averaged over a frame, moves
black on every dirty sum, because B's picture lands on A's porch — the first cut
darkened the split-phase look by a third and would have shifted the landing look
itself. Real sets showed hum bars because their clamps were slow and imperfect;
this one holds nominal black outright while it is keyed, which is the limit of
slow, and floats only when there is nothing to key it. Measured on
`deadChannel`, `dimmerHash`, a bare 60 IRE hum and the split-phase preset before
and after.

The other things that could have moved were checked the same way. Suppressed
sync (`scrambledChannel`, `pirateFeed`) lifts tips toward blanking and leaves
the picture above it, so nothing moves. SSAVI inverts the active video with the
tips intact: the peak detector does follow the inverted whites down, but the
real tips are still the first thing the slicer meets at the line start, so it
locks where it did. Termination and hot signals change amplitude, not which side
of blanking the picture sits on, so the slice stays at -20.

## Consequences

- `syncMeasureBuf` is two `vec4f` per line, interleaved. `timingBuf` grew by
  three floats. The gpuprof mirror and `looplock.ts` follow.
- Anything that leaves the receiver with no pulses at all now decodes around the
  floating reference rather than nominal black, and its open gate catches
  whatever falling edges the line does have. Three shipped looks moved with
  that, each by the mechanism rather than by accident: `ssavi` (tips suppressed,
  video inverted) now tears round the inverted whites and floats brighter;
  `meltdown`, whose loop carries the tip round mid-line, has the separator
  catching those displaced pulses and comes back greyer; `pirateFeed` settles
  rather than writhing. Static, the dead channel, the dimmer hash, the hum bars,
  the scrambled channel, both terminations and the enhancer looks rendered the
  same frames before and after.
- The pull-in behaviour of a detuned line oscillator is untouched: the gate
  widens only when no edges are found, and a detuned but locked oscillator still
  loses its edge out of the narrow window exactly as before.

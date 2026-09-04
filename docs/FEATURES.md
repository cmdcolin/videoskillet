# Features

Every control breaks a piece of hardware rather than drawing an artifact. Dot
crawl, rainbows, tearing and hue drift are what falls out — which is why two
controls compound instead of just stacking.

This page is the tour: what each stage is, and the one thing about it worth
knowing before you turn anything. [Effects](EFFECTS.md) is the full list of
controls, generated from the app's own control table.

The five blocks below are the five boxes on the app's own chain map, in the same
order and under the same names, so the picture here is the thing you click.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/pipeline-simple-dark.svg">
  <img alt="Signal path — overview: Source A → Mix → Channel → Receiver → Screen, with a mixer feedback loop from Receiver back to Mix and a camera feedback loop from Screen back to Source A" src="img/pipeline-simple-light.svg">
</picture>

## Sources and wiring

Two decks, and they offer the same list: a still, a video file, a webcam, a
shared screen, colour bars, TV or VHS static, a video synth, or a teletype card
you type on — plus your own clip shelf and a roll out of Wikimedia Commons and
archive.org. The webcam is how an RCA capture dongle gets real gear in, and both
decks take one, so two grabbers can be mixed against each other. Only B can be
switched off, which is the one thing the two lists still differ by.

Then the faults, starting at the connector: snow, a loose plug, a ground loop, a
termination fault, polarity flips, S-video miswired into composite. Cable
scrambling, Macrovision AGC pulses and colorstripe are the interesting corner —
they work by playing the receiver's own AGC and burst circuits against it.

Source A can also arrive as a file that was already a tape: a capture group
models the deck it was digitised off — luma and chroma bands, Y/C delay, grain
and the colour-under carrier's blotchy noise — before the chain encodes it, so
the tape damage downstream lands on a picture that was a tape to begin with. Off
by default, and free while it is.

Each input also has its own deck and cable ahead of the mixer, so a fault can
hit one source alone. Knock out one input's sync and the receiver locks to the
other, and the geometry snaps between two pictures.

## Feedback loops

Two, and they differ in what goes round — each in the app's own words, since the
chain map opens both of them with the same description:

<!-- generated:loops — from LOOP_STAGES in src/ui/controls.ts, via scripts/docgen.mjs -->

**Camera feedback**: light rather than wire — a camera on the tube’s face, its
picture mixed back into the input ahead of the encoder. It carries an image that
has already been decoded and lit, so it can only do what a lens can: zoom,
shift, defocus, cut a black level. Past unity gain it breeds structure on its
own.

**Mixer feedback**: the composite itself, patched off the bus into an input and
crossfaded against the live signal. The subcarrier rides round with it, so each
sample of cable delay spins fed-back hue 90° a generation and colour does things
optics cannot.

<!-- /generated:loops -->

## A/B mix

B genlocked onto A's raster for a clean dissolve, or summed dirty and
free-running against it, which is the two-deck rig.

The keyer cuts the chroma the encoder made, and that filter has no vertical term
— so mattes come out soft across and razor sharp down, the way every composite
key was.

A **character generator** stands here too, keying the caption text into the
picture the way every lower third and station ident was made. What makes it a CG
rather than an overlay is that it puts out two wires — a fill, which is the
characters as video, and a key, which is their matte — so trimming the timing
between them puts program through one side of every stem and the box's own black
down the other. It is the open caption to line 21's closed one: the same
sentence, one keyed into the picture and aged by everything downstream, one sent
as data and misspelled instead.

## Channel

Everything between the recorder and the set: bandwidth, nonlinearity, noise, the
tuner, colour-under, and the tape and heads themselves. The whole stage runs up
to four times, one per dub generation.

The one worth knowing: noise out of an FM discriminator rises toward the top of
the band, which lands it in the chroma passband, so tape noise arrives as
crawling coloured speckle rather than grey grain.

The tracking band is a servo, not a position. With **servo hunt** up the deck
searches for the track the way an auto-tracking machine does — a second-order
loop with a dead band, and less damping the higher the control — so it sweeps,
overshoots and rings, settles for a breath, and drifts back off as the tape
stretches. A scene change, coming out of shuttle, the loop's splice, a
transition cut or a thump from the music all knock it off the peak, and the top
of the frame flags on the tape tension each time (`signal/servo.ts`).

## Enhancer

A consumer enhancer between the deck and the set, with its jumpers moved. The
clamp gate slides off the back porch so black level bounces line to line; the
peaking coil gets feedback wrapped round it and rings; the sync regenerator
restamps pulses wherever its slicer crosses — bend that up into picture and dark
content starts minting sync of its own.

## Receiver

A television, and the ways one can be misadjusted. Sync faults move the picture;
decoding faults move its colour.

Deflection bend happens after decoding, so it warps geometry but must not touch
hue. That distinction — whether a wobble takes the colour with it — is the one
worth having in front of the app.

The set also has a **caption decoder**, and it is the one thing here that reads
the signal as _data_. Line 21 carries whatever you type, so noise, a narrow
channel and generation loss arrive as misspellings — dropped characters, wrong
ones, and the solid block a real decoder drew wherever parity caught an error
and it refused to guess. The page is repainted on the set's own timing, which is
where a real one painted it, so the picture can roll and tear underneath a
caption sitting perfectly still.

## Screen

The beam, and the phosphor it lands on.

Persistence decays second-order rather than exponentially, so a trail is a
bright front over a long faint tail — and it goes green, because red and blue
die first.

## Audio-reactive

Audio patched into the electronics at one sample per scan line, driving the
faults above rather than adding new ones: bass into vertical hold and HV sag,
level into horizontal hold, the waveform into deflection or into the
demodulator's reference.

That last one turns the tint 15,734 times a second. The reference lives in the
receiver, so the colour bands stay on the glass while a rolling picture slides
through them.

The sound can be the mic, a file, the clip's own track, or whatever the machine
itself is playing, that last through a share of the tab or app it comes out of.
It is worth knowing which you are on: the mic route puts the room, the speakers
and the microphone's own colouring between the track and the envelope detector,
and a share hands over the track itself.

## Intercarrier buzz — the traffic the other way

**Sound buzz** is the only effect here you listen to. The sound detector
recovers the 4.5 MHz beat between the picture and sound carriers, and a limiter
that cannot keep video crosstalk off it hands you the picture as audio: the
vertical interval as a 60 Hz buzz, line structure as a whine, snow as hiss.

It is a tap on the real composite rather than a synthesised noise, so the faults
above arrive already in the right relationship to what you can see. Bright
scenes buzz louder because peak white overmodulates. Hum bars beat against the
field rate. A head switch clicks on the line it damages. Fine tuning frees the
carrier and makes the weave and the buzz worse together, because they are one
leak seen from two ends.

The tap sits ahead of the receiver, which is where a real set's sound detector
sits too, so it hears the signal domain and nothing the receiver does after it.
A rolling picture over a steady buzz is the audible form of that: the roll is
the receiver's vertical oscillator, downstream of anything the sound can reach.

## The rig

- **Modulation** — any control can run on an LFO, random walk, noise,
  sample-and-hold, a Lorenz attractor, audio, or a one-shot envelope. Depth is a
  fraction of that control's range, so the slider stays the centre and a preset
  still holds the look. Rates lock to a tapped BPM or MIDI clock.
- **MIDI** — any controller sending CC, with learn, auto-map and soft takeover.
  See [Using a MIDI controller](MIDI.md).
- **Presets** — also faders you can drag partway in. Morph, random nudge, full
  undo, and saved profiles behind a sign-in.
- **Drift** — one switch and the look wanders on its own, unattended: a gentle
  nudge every fifteen seconds, travelling most of the way there so nothing cuts,
  and staying around the look you set drifting rather than running off. Every
  stage has the same switch for its own controls, so one circuit can breathe
  while you work on another.
- **Rundown** — the strip tray is a list of looks that plays itself. A row holds
  for a count of bars, arrives as a cut, a morph or a fault off the transition
  shelf, and can roll a source out of a pool or shake the look rather than
  naming either. Play it from the top, or fire rows by hand.
- **Sharing** — the whole board mirrors to the URL, so a link is a patch.
- **Capture** — stills, and a constant-framerate H.264 MP4 of the picture as it
  plays. The strip's ⎙ render is the other way out: it steps the engine on a
  clock the render owns, so a take comes back at 60 however fast the tab ran,
  and comes back the same twice. Or pop the controls into a second window and
  point OBS at the picture.
- **Interface** — the chain map, a command palette, signal taps and an IRE
  scope, a magnifier that magnifies the tube face along with the picture.

---

[Effects](EFFECTS.md) — every control · [User guide](USER-GUIDE.md) — how to
drive it · [How it works](FAQ.md#how-does-it-actually-work) — the code

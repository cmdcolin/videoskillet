# Features

Each control misadjusts or breaks one part of the signal path. Dot crawl,
rainbows, tearing and hue drift come out of that model, so two controls
interact.

This page covers each stage and what to know before adjusting it.
[Effects](EFFECTS.md) lists every control and is generated from the app's own
control table. The headings below are the boxes on the app's chain map, in the
same order and under the same names.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/pipeline-simple-dark.svg">
  <img alt="Signal path — overview: Source A → Mix → Channel → Receiver → Screen, with a mixer feedback loop from Receiver back to Mix and a camera feedback loop from Screen back to Source A" src="img/pipeline-simple-light.svg">
</picture>

## Sources and wiring

- **Two decks, same source list**: a still image, a video file, a webcam, a
  shared screen, colour bars, TV or VHS static, a video synth, a teletype card
  you type on, your own clip shelf, or a random pick from Wikimedia Commons or
  archive.org. Deck B can be switched off.
- **Capture hardware appears as a webcam.** An RCA capture dongle works on
  either deck, so you can mix two grabbers against each other.
- **Connector faults**: snow, a loose plug, a ground loop, bad termination,
  polarity flips, S-video miswired into composite.
- **Scrambling, Macrovision AGC pulses and colorstripe** drive the receiver's
  own AGC and burst circuits out of range.
- **Source A can be modelled as a tape capture.** A capture group applies deck
  losses ahead of the rest of the chain, so downstream stages act on an already
  soft picture. Off by default.
- **Each input has its own deck and cable** ahead of the mixer. Remove sync from
  one input and the receiver locks to the other, and the geometry changes
  between the two pictures.

## Feedback loops

Two, and they differ in what goes round. Each is described in the app's own
words, so the chain map and this page cannot disagree:

<!-- generated:loops — from LOOP_STAGES in src/ui/controls.ts, via scripts/docgen.mjs -->

**Camera feedback**: light rather than wire: a camera pointed at the tube, its
picture mixed back into the input ahead of the encoder. It carries an image that
has already been decoded and lit, so it can only do what a lens can: zoom,
shift, defocus, cut a black level. Past unity gain it builds structure on its
own.

**Mixer feedback**: the composite itself, patched off the bus into an input and
crossfaded against the live signal. The subcarrier goes round with it, so each
sample of cable delay rotates fed-back hue 90° per generation and colour does
things optics cannot.

<!-- /generated:loops -->

## A/B mix

- **Genlocked or free-running**: B locks to A's raster for a clean dissolve, or
  sums against it free-running.
- **The keyer keys on chroma from the encoder.** That filter has no vertical
  term, so mattes come out soft horizontally and sharp vertically.
- **A character generator** keys caption text into the picture on separate fill
  and key wires. Trimming the timing between them puts program on one side of
  each stroke and black on the other.

## Channel

- **Everything between the recorder and the set**: bandwidth, nonlinearity,
  noise, the tuner, colour-under, the tape and heads. The stage can run up to
  four times, once per dub generation.
- **Tape noise is coloured.** FM discriminator noise rises toward the top of the
  band, which is the chroma passband, so it appears as crawling coloured
  speckle.
- **Tracking is a second-order servo with a dead band.** With servo hunt raised,
  it sweeps, overshoots, rings, settles, then drifts as the tape stretches. A
  scene change, exiting shuttle, or an audio transient moves it off the peak and
  flags the top of the frame.

## Enhancer

- **A consumer picture enhancer with its jumpers moved**, between deck and set.
- **The clamp gate can slide off the back porch**, which makes black level vary
  line to line.
- **The peaking coil has feedback around it and rings.**
- **The sync regenerator restamps pulses wherever its slicer crosses.** Raise
  the slice level into picture content and dark content generates sync.

## Receiver

- **A television and its misadjustments.** Sync faults move the picture and
  decoding faults change its colour.
- **Deflection bend applies after decoding**, so it distorts geometry without
  changing hue. Whether a wobble carries colour with it identifies the stage it
  comes from.
- **A caption decoder reads line 21 as data.** Noise, limited bandwidth and
  generation loss produce dropped characters, wrong characters, and the solid
  block a decoder draws on a parity error. Captions repaint on the set's own
  timing, so they stay still while the picture rolls or tears.

## Screen

- **The beam and the phosphor it lands on**: spot size, focus, the shadow mask
  and convergence.
- **Persistence decays second-order**, so a trail has a bright leading edge and
  a long faint tail, and it turns green because red and blue decay first.

## Audio-reactive

- **Audio modulates the faults above** at one sample per scan line: bass to
  vertical hold and HV sag, level to horizontal hold, the waveform to deflection
  or the demodulator's reference.
- **The demodulator route shifts tint at 15,734 Hz.** The reference is in the
  receiver, so the colour bands stay fixed on the screen while a rolling picture
  moves through them.
- **Audio sources**: a microphone, a file, the clip's own track, or a tab or
  application share. A microphone adds the room and the speakers to the path; a
  share provides the track directly.

## Intercarrier buzz

- **Sound buzz is an audio output.** The sound detector recovers the 4.5 MHz
  beat between the picture and sound carriers, and a limiter that does not
  reject video crosstalk passes picture content through as audio: the vertical
  interval buzzes at 60 Hz, line structure whines, snow hisses.
- **The tap reads the actual composite signal**, so bright scenes buzz louder,
  hum bars beat against the field rate, and a head switch clicks on the line it
  damages. Fine tuning frees the carrier and increases both the weave and the
  buzz, which come from the same leak.
- **The tap sits ahead of the receiver** and hears only the signal domain. A
  rolling picture with a steady buzz shows this: the roll is the receiver's
  vertical oscillator, downstream of the tap.
- **Audio output is off until you enable it.** Level is two controls, and a
  preset, a shared link or a random roll can raise either, so the Sound stage
  has a switch of its own, set to _silent_ until you throw it and remembered
  after that. When it is off, the tap pass, the readback and the audio context
  are all skipped.

## The rig

- **Modulation**: any control can be driven by an LFO, random walk, noise,
  sample-and-hold, a Lorenz attractor, audio, or a one-shot envelope. Depth is a
  fraction of the control's range, so the slider value stays the centre and
  presets still apply. Rates lock to a tapped BPM or MIDI clock.
- **MIDI**: any controller sending CC, with learn, auto-map and soft takeover.
  See [Using a MIDI controller](MIDI.md).
- **Presets** also work as faders you can drag partway. Morph, random nudge,
  full undo, and saved profiles behind a sign-in.
- **Drift**: one switch makes the look wander on its own, with a small change
  every fifteen seconds around the current setting. Each stage has the same
  switch for its own controls.
- **Rundown**: the strip tray is a list of looks that plays in sequence. A row
  holds for a number of bars, arrives as a cut, a morph or a fault, and can pick
  a source from a pool. Play from the top, or fire rows by hand.
- **Sharing**: the full control state mirrors to the URL, so a link carries a
  patch.
- **Capture**: stills, and a constant-framerate H.264 MP4 of the picture as it
  plays. The strip's ⎙ render steps the engine on its own clock, so a take comes
  back at 60 fps whatever rate the tab ran at, and it is reproducible. You can
  also move the controls to a second window and capture the picture with OBS.
- **Interface**: the chain map, a command palette, signal taps, an IRE scope,
  and a magnifier that magnifies the tube face along with the picture.

---

[Effects](EFFECTS.md): every control · [User guide](USER-GUIDE.md): how to drive
it · [How it works](FAQ.md#how-does-it-actually-work): the code

# Features

Every control breaks a piece of hardware. Dot crawl, rainbows, tearing and hue
drift follow from the break, which is why two controls compound instead of
stacking.

This is a tour of each stage and the one thing worth knowing before you turn
anything. [Effects](EFFECTS.md) lists every control, generated from the app's
own table. The headings here are the boxes on the app's chain map, in the same
order and under the same names.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/pipeline-simple-dark.svg">
  <img alt="Signal path — overview: Source A → Mix → Channel → Receiver → Screen, with a mixer feedback loop from Receiver back to Mix and a camera feedback loop from Screen back to Source A" src="img/pipeline-simple-light.svg">
</picture>

## Sources and wiring

- **Two decks, same list**: a still, a video file, a webcam, a shared screen,
  colour bars, TV or VHS static, a video synth, a teletype card you type on,
  your clip shelf, or a random pick from Wikimedia Commons or archive.org. Deck
  B can also switch off.
- **Real gear arrives as a webcam**: an RCA dongle on either deck, so two
  grabbers can be mixed against each other.
- **Connector faults**: snow, a loose plug, a ground loop, bad termination,
  polarity flips, S-video miswired into composite.
- **Scrambling, Macrovision AGC pulses and colorstripe** turn the receiver's own
  AGC and burst circuits against it.
- **A file that was already a tape**: a capture group models the deck Source A
  came off, so everything downstream lands on a picture that was already soft.
  Off by default.
- **Each input has its own deck and cable**. Knock out one input's sync and the
  receiver locks to the other, and the geometry snaps between two pictures.

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

- **Genlocked or dirty**: B locked onto A's raster for a clean dissolve, or
  summed free-running against it, which is the two-deck rig.
- **The keyer cuts chroma the encoder made**, and that filter has no vertical
  term, so mattes come out soft across and sharp down.
- **A character generator** keys caption text in on separate fill and key wires,
  so trimming the timing between them puts program through one side of every
  stem and black down the other.

## Channel

- **Everything between the recorder and the set**: bandwidth, nonlinearity,
  noise, the tuner, colour-under, the tape and heads. It runs up to four times
  over, once per dub generation.
- **Tape noise is coloured**: an FM discriminator's noise rises toward the top
  of the band, which is the chroma passband, so it crawls as coloured speckle
  rather than grey grain.
- **Tracking is a servo** with a dead band: it sweeps, overshoots, rings,
  settles and drifts off again as the tape stretches. A scene change or a thump
  from the music knocks it off the peak, and the top of the frame flags.

## Enhancer

- **A consumer enhancer with its jumpers moved**, between deck and set.
- **The clamp gate slides off the back porch**, so black level bounces line to
  line.
- **The peaking coil gets feedback** wrapped round it and rings.
- **The sync regenerator restamps pulses** wherever its slicer crosses. Raise it
  into picture and dark content starts making sync of its own.

## Receiver

- **A television, and the ways one can be misadjusted.** Sync faults move the
  picture, decoding faults move its colour.
- **Deflection bend happens after decoding**, so it warps geometry and never
  touches hue. Whether a wobble takes the colour with it tells you which stage
  it is in.
- **A caption decoder** reads line 21 as data, so noise and generation loss
  arrive as dropped characters, wrong ones, and the solid block a real decoder
  drew on a parity error. Captions repaint on the set's own timing, so the
  picture can roll under a caption sitting perfectly still.

## Screen

- **The beam and the phosphor it lands on**: spot size, focus, the shadow mask
  and convergence.
- **Persistence decays second-order**, so a trail is a bright front over a long
  faint tail, and it goes green because red and blue die first.

## Audio-reactive

- **Audio drives the faults above** at one sample per scan line: bass into
  vertical hold and HV sag, level into horizontal hold, the waveform into
  deflection or the demodulator's reference.
- **The demodulator route turns the tint 15,734 times a second.** The reference
  lives in the receiver, so the colour bands stay on the glass while a rolling
  picture slides through them.
- **Sound can be the mic, a file, the clip's own track, or a share.** The mic
  puts the room and the speakers between the track and the envelope detector; a
  share delivers the track itself.

## Intercarrier buzz

- **Sound buzz is the only effect you listen to.** The sound detector recovers
  the 4.5 MHz beat between picture and sound carriers, and a limiter that leaks
  video crosstalk passes the picture through as audio: the vertical interval
  buzzes at 60 Hz, line structure whines, snow hisses.
- **It taps the real composite**, so bright scenes buzz louder, hum bars beat
  against the field rate, and a head switch clicks on the line it damages. Fine
  tuning makes the weave and the buzz worse together — one leak seen from two
  ends.
- **The tap sits ahead of the receiver**, so it hears the signal domain only. A
  rolling picture over a steady buzz is that in audible form.
- **Nothing reaches the speakers until you ask.** The buzz waits behind a switch
  of its own in the Sound stage, _silent_ until it is thrown and remembered from
  then on. Switched off it costs nothing: no tap pass, no readback, no audio
  context.

## The rig

- **Modulation**: any control can run on an LFO, random walk, noise,
  sample-and-hold, a Lorenz attractor, audio, or a one-shot envelope. Depth is a
  fraction of the control's range, so the slider stays the centre. Rates lock to
  a tapped BPM or MIDI clock.
- **MIDI**: any controller sending CC, with learn, auto-map and soft takeover.
  See [Using a MIDI controller](MIDI.md).
- **Presets** double as faders you can drag partway in. Morph, random nudge,
  full undo, and saved profiles behind a sign-in.
- **Drift**: one switch and the look wanders on its own, a gentle nudge every
  fifteen seconds, staying near where you left it. Every stage has the same
  switch for its own controls.
- **Rundown**: the strip tray is a list of looks that plays itself. A row holds
  for a count of bars, arrives as a cut, a morph or a fault, and can roll a
  source out of a pool.
- **Sharing**: the whole board mirrors to the URL, so a link is a patch.
- **Capture**: stills, and a constant-framerate H.264 MP4. The strip's ⎙ render
  steps the engine on its own clock, so a take comes back at 60 fps however fast
  the tab ran, and comes back the same twice. Or pop the controls into a second
  window and point OBS at the picture.
- **Interface**: the chain map, a command palette, signal taps and an IRE scope,
  a magnifier that takes the tube face with the picture.

---

[Effects](EFFECTS.md): every control · [User guide](USER-GUIDE.md): how to drive
it · [How it works](FAQ.md#how-does-it-actually-work): the code

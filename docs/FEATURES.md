# Features

Every control breaks a piece of hardware rather than drawing an artifact. Dot
crawl, rainbows, tearing and hue drift follow from that, which is why two
controls compound instead of stacking.

This is a tour of each stage and the one thing worth knowing before you turn
anything. [Effects](EFFECTS.md) is the full list of controls, generated from the
app's own table. The headings are the boxes on the app's chain map, in the same
order and under the same names.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/pipeline-simple-dark.svg">
  <img alt="Signal path — overview: Source A → Mix → Channel → Receiver → Screen, with a mixer feedback loop from Receiver back to Mix and a camera feedback loop from Screen back to Source A" src="img/pipeline-simple-light.svg">
</picture>

## Sources and wiring

- **Two decks, same list**: a still, a video file, a webcam, a shared screen,
  colour bars, TV or VHS static, a video synth, a teletype card you type on,
  your own clip list, or a random pick from Wikimedia Commons or archive.org.
  Only B can be switched off.
- **Real gear comes in as a webcam**: an RCA capture dongle on either deck, so
  two grabbers can be mixed against each other.
- **Connector faults**: snow, a loose plug, a ground loop, a termination fault,
  polarity flips, S-video miswired into composite.
- **Scrambling, Macrovision AGC pulses and colorstripe** are the interesting
  ones. They turn the receiver's own AGC and burst circuits against it.
- **A file that was already a tape**: a capture group models the deck Source A
  was digitised from, so damage downstream lands on a picture that was already a
  tape. Off by default, and free while it is.
- **Each input has its own deck and cable** ahead of the mixer. Knock out one
  input's sync and the receiver locks to the other, and the geometry snaps
  between two pictures.

## Feedback loops

Two, and they differ in what goes round. Each is in the app's own words, so the
chain map and this page cannot disagree:

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
  term, so mattes come out soft across and sharp down, the way every composite
  key was.
- **A character generator** keys caption text into the picture. It puts out a
  fill and a key on two wires, so trimming the timing between them puts program
  through one side of every stem and black down the other. It is the open
  caption to line 21's closed one: the same sentence, aged by everything
  downstream rather than sent as data and misspelled.

## Channel

- **Everything between the recorder and the set**: bandwidth, nonlinearity,
  noise, the tuner, colour-under, the tape and heads. The stage runs up to four
  times, one per dub generation.
- **Tape noise is coloured**: an FM discriminator's noise rises toward the top
  of the band, which is the chroma passband, so it arrives as crawling coloured
  speckle rather than grey grain.
- **Tracking is a servo**, a second-order loop with a dead band. With servo hunt
  up the deck sweeps, overshoots, rings, settles and drifts off again as the
  tape stretches. A scene change, coming out of shuttle or a thump from the
  music knocks it off the peak, and the top of the frame flags each time.

## Enhancer

- **A consumer enhancer with its jumpers moved**, sitting between deck and set.
- **The clamp gate slides off the back porch**, so black level bounces line to
  line.
- **The peaking coil gets feedback** wrapped round it and rings.
- **The sync regenerator restamps pulses** wherever its slicer crosses. Raise
  that into picture and dark content starts producing sync of its own.

## Receiver

- **A television and the ways one can be misadjusted.** Sync faults move the
  picture. Decoding faults move its colour.
- **Deflection bend happens after decoding**, so it warps geometry and never
  touches hue. Whether a wobble takes the colour with it is the distinction most
  worth keeping in mind.
- **A caption decoder** reads line 21 as data, so noise, a narrow channel and
  generation loss arrive as dropped characters, wrong ones, and the solid block
  a real decoder drew where parity caught an error. Captions repaint on the
  set's own timing, so the picture can roll and tear under a caption sitting
  perfectly still.

## Screen

- **The beam and the phosphor it lands on.**
- **Persistence decays second-order**, so a trail is a bright front over a long
  faint tail, and it goes green because red and blue die first.

## Audio-reactive

- **Audio drives the faults above** at one sample per scan line: bass into
  vertical hold and HV sag, level into horizontal hold, the waveform into
  deflection or the demodulator's reference.
- **The demodulator route turns the tint 15,734 times a second.** The reference
  lives in the receiver, so the colour bands stay on the glass while a rolling
  picture slides through them.
- **Sound can be the mic, a file, the clip's own track, or a share** of the tab
  or app it comes out of. The mic puts the room and the speakers between the
  track and the envelope detector; a share delivers the track itself.

## Intercarrier buzz

- **Sound buzz is the only effect you listen to.** The sound detector recovers
  the 4.5 MHz beat between picture and sound carriers, and a limiter that cannot
  keep video crosstalk off it passes the picture through as audio: the vertical
  interval buzzes at 60 Hz, line structure whines, snow hisses.
- **It taps the real composite**, so bright scenes buzz louder, hum bars beat
  against the field rate, and a head switch clicks on the line it damages. Fine
  tuning frees the carrier and makes the weave and the buzz worse together,
  because they are one leak seen from two ends.
- **The tap sits ahead of the receiver**, so it hears the signal domain only. A
  rolling picture over a steady buzz is that in audible form: the roll is the
  receiver's vertical oscillator, downstream of anything the sound can reach.

## The rig

- **Modulation**: any control can run on an LFO, random walk, noise,
  sample-and-hold, a Lorenz attractor, audio, or a one-shot envelope. Depth is a
  fraction of the control's range, so the slider stays the centre and a preset
  still holds. Rates lock to a tapped BPM or MIDI clock.
- **MIDI**: any controller sending CC, with learn, auto-map and soft takeover.
  See [Using a MIDI controller](MIDI.md).
- **Presets**: also faders you can drag partway in. Morph, random nudge, full
  undo, and saved profiles behind a sign-in.
- **Drift**: one switch and the look wanders on its own, a gentle nudge every
  fifteen seconds, staying near where you set it going. Every stage has the same
  switch for its own controls.
- **Rundown**: the strip tray is a list of looks that plays itself. A row holds
  for a count of bars, arrives as a cut, a morph or a fault, and can roll a
  source out of a pool or shake the look. Play it from the top, or fire rows by
  hand.
- **Sharing**: the whole board mirrors to the URL, so a link is a patch.
- **Capture**: stills, and a constant-framerate H.264 MP4 of the picture as it
  plays. The strip's ⎙ render steps the engine on its own clock, so a take comes
  back at 60 however fast the tab ran, and comes back the same twice. Or pop the
  controls into a second window and point OBS at the picture.
- **Interface**: the chain map, a command palette, signal taps and an IRE scope,
  a magnifier that magnifies the tube face along with the picture.

---

[Effects](EFFECTS.md): every control · [User guide](USER-GUIDE.md): how to drive
it · [How it works](FAQ.md#how-does-it-actually-work): the code

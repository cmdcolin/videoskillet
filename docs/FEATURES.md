# Features

Each control misadjusts or breaks one part of the signal path. Dot crawl,
rainbows, tearing and hue drift come out of that model, so any two controls
interact.

[Effects](EFFECTS.md) lists every control, generated from the app's own control
table. The headings below are the boxes on the app's chain map.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="img/pipeline-simple-dark.svg">
  <img alt="Signal path — overview: Source A → Mix → Channel → Receiver → Screen, with a mixer feedback loop from Receiver back to Mix and a camera feedback loop from Screen back to Source A" src="img/pipeline-simple-light.svg">
</picture>

## Sources and wiring

Two decks take the same list: a still image, a video file, a webcam, a shared
screen, colour bars, TV or VHS static, a video synth, a teletype card you type
on, your own clip shelf, or a random pick from Wikimedia Commons or archive.org.
A capture dongle appears as a webcam on either deck.

Each input has its own deck and cable ahead of the mixer. Remove sync from one
and the receiver locks to the other, and the geometry changes between the two
pictures.

## Feedback loops

The camera loop carries light. The mixer loop carries the composite signal,
subcarrier included.

<!-- generated:loops — from LOOP_STAGES in src/ui/controls.ts, via scripts/docgen.mjs -->

**Camera feedback**: an optical loop. A camera points at the tube and the mixer
feeds its picture back into the input ahead of the encoder. The camera itself
can only do what a lens does — zoom, shift, defocus, black level — but the
return re-enters ahead of the encoder, so a lap is a whole encode/decode
generation and every fault between there and the glass is inside it, applied
once per generation. Above unity gain it builds structure on its own.

**Mixer feedback**: an electrical loop. The mixer takes the composite signal off
the bus into an input and crossfades it against the live signal. The subcarrier
travels round with it, so each sample of cable delay rotates fed-back hue by 90°
per generation.

<!-- /generated:loops -->

## A/B mix

B locks to A's raster for a clean dissolve, or sums against it free-running. The
keyer keys on chroma from the encoder, and that filter has no vertical term, so
mattes come out soft horizontally and sharp vertically. A character generator
keys caption text in on separate fill and key wires, so trimming the timing
between them puts program on one side of each stroke and black on the other.

## Channel

Everything between the recorder and the set: bandwidth, nonlinearity, noise, the
tuner, colour-under, the tape and heads. The stage can run up to four times,
once per dub generation.

Tracking is a second-order servo with a dead band, so with servo hunt raised it
sweeps, overshoots, rings and settles, and a scene change or an audio transient
moves it off the peak.

## Enhancer

A consumer picture enhancer with its jumpers moved, between deck and set. Its
sync regenerator restamps pulses wherever its slicer crosses, so a slice level
raised into picture content lets dark content generate sync.

## Receiver

Sync faults move the picture and decoding faults change its colour. Deflection
bend applies after decoding, so it distorts geometry without changing hue —
whether a wobble carries colour with it identifies the stage it comes from.

A caption decoder reads line 21 as data, so noise, limited bandwidth and
generation loss produce dropped characters and the solid block a decoder draws
on a parity error.

## Screen

The beam and the phosphor it lands on. Persistence decays second-order, so a
trail has a bright leading edge and a long faint tail, and it turns green
because red and blue decay first.

## Audio-reactive

Audio modulates the faults above at one sample per scan line: bass to vertical
hold and HV sag, level to horizontal hold, the waveform to deflection or the
demodulator's reference. The reference is in the receiver, so that last route
leaves its colour bands fixed on the screen while a rolling picture moves
through them.

## Intercarrier buzz

Sound buzz is an audio output. The sound detector recovers the 4.5 MHz beat
between the picture and sound carriers, and a limiter that does not reject video
crosstalk passes picture content through as audio: the vertical interval buzzes
at 60 Hz, line structure whines, snow hisses.

The tap sits ahead of the receiver, so a rolling picture keeps a steady buzz —
the roll happens in the receiver's vertical oscillator, downstream of the tap.
Audio output stays _silent_ until you throw the Sound stage's switch, because a
preset or a shared link can raise either level control.

## The rig

- **Modulation**: any control can be driven by an LFO, random walk, noise,
  sample-and-hold, a Lorenz attractor, audio, or a one-shot envelope. Depth is a
  fraction of the control's range, so the slider value stays the centre and
  presets still apply. Rates lock to a tapped BPM or MIDI clock.
- **MIDI**: any controller sending CC, with learn, auto-map and soft takeover.
  See [Using a MIDI controller](MIDI.md).
- **Presets** also work as faders you can drag partway, with morph, random
  nudge, full undo and saved profiles behind a sign-in. **Drift** runs the nudge
  unattended, and each stage has the same switch for its own controls.
- **Rundown**: the strip tray plays a list of looks in sequence. A row holds for
  a number of bars, arrives as a cut, a morph or a fault, and can pick a source
  from a pool.
- **Sharing and capture**: the control state mirrors to the URL, so a link
  carries a patch. The strip's ⎙ render steps the engine on its own clock, so a
  take comes back at 60 fps whatever rate the tab ran at.
- **Rendering offline**: `pnpm render` takes a link and a file and writes ProRes
  4444 with no browser open, which keeps the colour artifacts a browser's 4:2:0
  encode loses. See [CLI](CLI.md).

---

[Effects](EFFECTS.md): every control · [User guide](USER-GUIDE.md): how to drive
it · [How it works](FAQ.md#how-does-it-actually-work): the code

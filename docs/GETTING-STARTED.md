# Getting started

videoskillet.js simulates the analog video signal in WebGPU shaders. Every
effect is a consequence of a real signal-level fault rather than something drawn
on top of the picture.

It needs WebGPU, so it needs a fairly recent browser — try Firefox Nightly or
Chrome Canary if your default one has trouble.

Visit https://videoskillet.com/app/

## What's on screen

![The videoskillet.js window with four labels: the picture on the left, and down the right-hand panel the menu, the presets and the signal path map](img/overview.jpg)

**The picture** takes the left of the window: drag a box across it to magnify a
region, double-click to pull back. **The ☰ menu**, top right, holds stills,
recording, fullscreen and settings. **Presets**, below it, is a shortlist of
whole looks — click one and every control it names moves at once.

**Signal path** is the map at the top of the sidebar, and it is the main thing
to click. Every box is a stage of the chain, and clicking one opens that stage's
controls underneath it. Every control lives there, sources included, each at the
point on the path where it acts.

## Three looks to try

|                                                                                          |                                                                                           |                                                                            |
| :--------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------: | :------------------------------------------------------------------------: |
| ![Reversed polarity: every hue complementary, the raster sheared](img/look-negative.jpg) | ![The video synth keyed against itself: hard bands of saturated colour](img/look-key.jpg) | ![A mixer loop past unity, building coloured structure](img/look-loop.jpg) |

- **negative** reverses polarity on the composite line, and sync goes with it.
- **key sweep** runs the video synth through the chroma keyer, with no camera
  anywhere in it.
- **mixer loop** patches the composite into itself past unity, where it stops
  returning your picture and starts generating its own.

## Where next

- [User guide](USER-GUIDE.md): sources, feedback, modulation, saving, scopes
- [Features](FEATURES.md): a tour of everything it can break
- [Effects](EFFECTS.md): every control, generated from the app's own table
- [MIDI](MIDI.md): setting up a controller
- [FAQ](FAQ.md): how it works, what runs it, how a take gets into an edit

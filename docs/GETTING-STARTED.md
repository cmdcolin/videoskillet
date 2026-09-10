# Getting started

videoskillet.js simulates the analog video signal in WebGPU shaders. The effects
are real signal faults, not filters drawn on the picture.

It needs WebGPU, so it needs a recent browser. Firefox Nightly and Chrome Canary
both work.

Visit https://videoskillet.com/app/

## What's on screen

![The videoskillet.js window with four labels: the picture on the left, and down the right-hand panel the menu, the presets and the signal path map](img/overview.jpg)

**The picture** is on the left. Drag a box across it to zoom in, double-click to
pull back. **The ☰ menu**, top right, holds stills, recording, fullscreen and
settings. **Presets**, below it, is a shortlist of whole looks: click one and
every control it names moves at once.

**Signal path** is the map at the top of the sidebar, and it is the main thing
to click. Each box is a stage of the chain. Click one and its controls open
underneath. Every control lives there, sources included.

## Three looks to try

|                                                                                          |                                                                                           |                                                                            |
| :--------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------: | :------------------------------------------------------------------------: |
| ![Reversed polarity: every hue complementary, the raster sheared](img/look-negative.jpg) | ![The video synth keyed against itself: hard bands of saturated colour](img/look-key.jpg) | ![A mixer loop past unity, building coloured structure](img/look-loop.jpg) |

- **negative** flips polarity on the composite line, and sync goes with it.
- **key sweep** runs the video synth through the chroma keyer.
- **mixer loop** patches the composite into itself past unity, so it breeds its
  own picture.

## Where next

- [User guide](USER-GUIDE.md): sources, feedback, modulation, saving, scopes
- [Features](FEATURES.md): a tour of everything it can break
- [Effects](EFFECTS.md): every control, generated from the app's own table
- [MIDI](MIDI.md): setting up a controller
- [Rendering](RENDERING.md): getting a look onto a file, running locally
- [FAQ](FAQ.md): how it works, what runs it, how a take gets into an edit

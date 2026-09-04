# Getting started

videoskillet.js simulates composite video signal using WebGPU shaders. All the
video effects are natural consequences of real signal-level glitches, rather
than effects drawn on top of the image.

It needs WebGPU, which needs a fairly recent browser — try Firefox Nightly or
Chrome Canary if you have trouble with your default browser.

Visit https://videoskillet.com/app/

## What's on screen

![The videoskillet.js window with four labels: the picture on the left, and down the right-hand panel the menu, the presets and the signal path map](img/overview.jpg)

**The picture** takes the left of the window: drag a box across it to magnify
that region, and double-click to pull back. **The ☰ menu**, top right, holds
stills, recording, fullscreen and settings. **Presets**, below it, is a
shortlist of whole looks — click one and every control it names moves at once.

**Signal path** is the map at the head of the sidebar, and it is the thing to
click: every box on it is a stage of the chain, and clicking one opens that
stage's controls underneath it. That is where all of them live, sources
included, each sitting at the point on the path where it acts.

## Three looks to try

|                                                                                          |                                                                                           |                                                                            |
| :--------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------: | :------------------------------------------------------------------------: |
| ![Reversed polarity: every hue complementary, the raster sheared](img/look-negative.jpg) | ![The video synth keyed against itself: hard bands of saturated colour](img/look-key.jpg) | ![A mixer loop past unity, breeding coloured structure](img/look-loop.jpg) |

- **negative** reverses polarity on the composite line, and sync goes with it.
- **key sweep** runs the video synth through the chroma keyer, with no camera
  anywhere in it.
- **mixer loop** patches the composite into itself past unity, where it stops
  returning your picture and starts breeding its own.

## Where next

- [User guide](USER-GUIDE.md) — sources, feedback, modulation, saving, scopes
- [Features](FEATURES.md) — the tour of everything it can break
- [Effects](EFFECTS.md) — every control, generated from the app's own table
- [MIDI](MIDI.md) — setting up a controller
- [FAQ](FAQ.md) — how it works, what runs it, how a take gets into an edit

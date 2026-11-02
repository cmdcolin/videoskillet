# Getting started

videoskillet simulates the analog video signal in WebGPU shaders, so it needs a
browser with WebGPU. [The FAQ](FAQ.md#what-does-it-need-to-run) lists which
ones, phones and tablets included.

Visit https://videoskillet.com/app/

## The window

![The videoskillet window with four labels: the picture on the left, and down the right-hand panel the menu, the presets and the signal path map](img/overview.jpg)

**The picture** is on the left. Shift-drag a box across it to zoom in,
double-click to pull back. **The ☰ menu**, top right, holds stills, recording,
fullscreen and settings. **Presets**, below it, is a shortlist of whole looks:
click one and every control it names moves at once.

**Signal path** is the map at the top of the sidebar, and the main thing to
click. Each box is a stage of the chain. Click one and its controls open
underneath. Every control is in there, sources included.

## Three looks to try

|                                                                                          |                                                                                           |                                                                            |
| :--------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------: | :------------------------------------------------------------------------: |
| ![Reversed polarity: every hue complementary, the raster sheared](img/look-negative.jpg) | ![The video synth keyed against itself: hard bands of saturated colour](img/look-key.jpg) | ![A mixer loop past unity, building coloured structure](img/look-loop.jpg) |

- **negative** flips polarity on the composite line, and sync goes with it.
- **key sweep** runs the video synth through the chroma keyer.
- **mixer loop** patches the composite into itself past unity, so the loop's
  output builds on itself.

## Sharing a look

The address bar holds every control, so the page's URL is always a link to the
look on screen, and whoever opens it gets the same board. `ctrl+k` → "share this
look" gives a shorter link to send. A clip opened from your own disk is not in
the link.

## Where next

- [Features](FEATURES.md): a tour of everything it can break
- [Effects](EFFECTS.md): every control
- [MIDI](MIDI.md): setting up a controller
- [CLI](CLI.md): getting a look onto a file, running locally
- [Agentic AI usage](AI-USAGE.md): letting Claude Code drive the app
- [FAQ](FAQ.md): how it works, what runs it, how to bring a recording into a
  video editor

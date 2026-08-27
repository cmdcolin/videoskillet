# Getting started

ntsc.js is a TV you can break on purpose. It encodes the picture into a real
NTSC waveform, damages it the way tape, cable and a tired receiver do, then
decodes it with the mistakes still in. You don't draw artifacts here. You break
something upstream and watch what falls out.

It runs in a browser with WebGPU (Chrome, Edge, Safari 26+, or Firefox Nightly
on Linux). There's nothing to install.

<video
  controls muted loop playsinline
  poster="img/clip-hero-poster.jpg"
  src="https://cmdcolinphotos.s3.amazonaws.com/phosphene/clip-hero.mp4"></video>

<sub>[Open this patch ↗](https://cmdcolin.github.io/ntsc.js/?p=E-QFAewDAKABAcAHB8ACAqABAKAlAOADAPAGAAgC4AMAwAIBYBOgAQYcAJgCAAwDmAIMyAEWyAEAmCAAoAYCgB4BWACgAQAQAPABEIwBAMACAOgHAAwAmAIBUCuMAQGcAgCwzgIARCfQjAE&src=cat&srcb=cat&mod=)</sub>

## Four steps

1. **[Open the app ↗](https://cmdcolin.github.io/ntsc.js/)**. It starts on a
   bundled photo.
2. **Click a preset.** The board jumps to that look. Drag one sideways instead
   and it only goes in part of the way.
3. **Give it your own footage.** Open Source A at the head of the signal path
   and pick a file, a webcam, a screen share, or a random clip out of Wikimedia
   Commons or archive.org.
4. **Hit random nudge** a few times. It keeps the look you have and jogs it —
   everything already doing something, plus a few controls that weren't — which
   is where most of the good accidents come from. `ctrl+z` takes any of it back,
   and **more…** beside it holds three other shapes of roll.

When you find something worth keeping, hit **⧉ copy link**. The whole board
lives in the URL, so a link is a patch.

## What's on screen

![The ntsc.js window: the picture on the left, the control panel on the right](img/overview.jpg)

**1** the picture, where a drag boxes a region to magnify and a double-click
pulls back · **2** the ☰ menu, for stills, recording, fullscreen and settings ·
**3** presets · **4** the way into every control, sources included.

Controls sit where they belong on the signal path. The chain map at the top of
the sidebar is that path, and every box on it is a button.

## Three looks to try

|                                                                                          |                                                                                           |                                                                            |
| :--------------------------------------------------------------------------------------: | :---------------------------------------------------------------------------------------: | :------------------------------------------------------------------------: |
| ![Reversed polarity: every hue complementary, the raster sheared](img/look-negative.jpg) | ![The video synth keyed against itself: hard bands of saturated colour](img/look-key.jpg) | ![A mixer loop past unity, breeding coloured structure](img/look-loop.jpg) |

**negative** reverses polarity on the composite line, and sync goes with it ·
**key sweep** runs the video synth through the chroma keyer, with no camera
anywhere in it · **mixer loop** patches the composite into itself past unity,
where it stops returning your picture and starts breeding its own.

## Where next

- [User guide](USER-GUIDE.md) — sources, feedback, modulation, saving, scopes
- [Features](FEATURES.md) — the tour of everything it can break
- [Effects](EFFECTS.md) — every control, generated from the app's own table
- [How it works](HOW-IT-WORKS.md) — the code: one array and a chain of GPU
  shaders
- [MIDI](MIDI.md) — setting up a controller

# videoskillet.js

Real-time analog video — composite, VHS and CRT — simulated down to the signal
and rendered entirely in WebGPU compute shaders.

### Live app!

https://cmdcolin.github.io/videoskillet.js/

## Screenshot

[![A photo dubbed to VHS: rainbow chroma noise banding across the frame, torn lines, and the picture bending through a tracking band](img/screenshot.jpg)](https://cmdcolinphotos.s3.amazonaws.com/phosphene/demo-v2.mp4)

## The signal path

**This is the thing to click.** The map sits at the top of the sidebar, and
nearly every control in the app is behind one of its boxes — click a stage and
that stage's controls open underneath it.

![The app window with the signal path map boxed in red at the head of the sidebar and enlarged over the picture: SOURCE A and SOURCE B into MIX, then CHANNEL, RECEIVER and SCREEN, with camera and mixer returns arching back over the trunk, SOUND and VIEW hanging below, and MODULATION and DECK on a row of their own with no wire reaching them](docs/img/signal-path-callout.jpg)

So all the rainbows, video tearing and chaos are a result of the video signal
mechanism rather than being painted on. The dashed returns are the two feedback
loops: **camera** is a lens pointed at the tube, and **mixer** patches the
composite waveform back in electrically.

Details in [How it works](docs/HOW-IT-WORKS.md), fault by fault in
[Features](docs/FEATURES.md).

## Features

- True composite signal emulation in WebGPU compute shaders. This is the
  headline feature!
- Dirty video mix or genlocked (clean) video mixing of two sources
- Video feedback effects including hardware mixer, camera-pointed-at-tv style
  feedback
- Lots of 'faults' like loose cable, bad receiver, inverted polarity, bad
  ground, etc.
- Audio-reactive: feed it music and bass shakes vertical hold of the image, etc.
- All settings can be modulated (e.g. with LFO, random walk, sample and hold,
  etc)
- Allows using MIDI controller via WebMIDI, map different knobs to settings of
  interest
- Easy-to-use "randomize" buttons that morph between settings over multiple
  seconds
- Bleeds video into the audio channel, so you can hear that static-y hum
- ...[much more](docs/FEATURES.md)

## Video sources

There are two 'sources' A and B and you can mix them together like a video
mixer, and you get to choose what to load into each

- NTSC color bars/Video sweep test signals
- VHS static or TV static
- MP4 videos or still-frame picture from your computer/phone
- Webcam/screenshare
- Teletype style text overlay (includes 'mspaint style' feature to draw blocky
  text)
- Load random video from archive.org or wiki
- Basic video synth

## Other random features

- Pops controls into a second window for a second screen or projector
- Records the video live, or render it offline
- The whole board mirrors to the URL, so a link is a patch

and it works on mobile! tested on Google Pixel with Chrome

## Run

```
pnpm install
pnpm dev
```

Fun bonus: If you are running this locally, it adds a **Video URL…** source that
works with yt-dlp and lets you video mix with YouTube — or anything else yt-dlp
can fetch — on the fly.

## FAQ

Short versions; the arguments behind them are in [the full FAQ](docs/FAQ.md).

### Why isn't this an After Effects / Premiere / Resolve plugin?

No plugin API speaks WebGPU — OFX and Adobe's SDK are CUDA, OpenCL and Metal —
and the feedback loops make frame N a function of every frame before it, so
scrubbing a timeline is wrong by construction. For this look on a clip in an
edit, [ntsc-rs](https://github.com/ntsc-rs/ntsc-rs) shares the premise and
already ships those plugins.

### How do I get a result into an edit then?

Open the **strip** tray along the bottom and press **⎙ render**. It writes a
constant-framerate H.264 MP4 that Resolve and Premiere conform straight off the
header. **●** records a live performance first, and ⎙ replays it into the
render.

### Can I patch it into Max/MSP, Jitter or TouchDesigner?

Most of it works now with no code: MIDI CC and clock over a virtual port, audio
in through a loopback device picked as the microphone, a Jitter render in as a
webcam through Syphon, and the picture back out through an OBS browser source.
OSC is the piece that is missing.

## Docs

- [Main docs website](https://cmdcolin.github.io/videoskillet.js/guide/)
- [Getting started](docs/GETTING-STARTED.md)
- [User guide](docs/USER-GUIDE.md)
- [Features](docs/FEATURES.md)
- [Effects](docs/EFFECTS.md) — every control, generated
- [How it works](docs/HOW-IT-WORKS.md)
- [MIDI](docs/MIDI.md)
- [Comparison with other tools](docs/COMPARISON.md)
- [FAQ](docs/FAQ.md)

---

Note: this project is extensively vibecoded. The initial signal-path design was
one-shotted by [Fable](https://claude.com/), which nailed the "signal level"
idea behind the glitches.

This app is inspired by my old 2010s era experiments alligator clipping yellow
composite video cables together in my basement and posting tumblr gifs.

## Cool demos

- Camera feedback + static
  https://cmdcolin.github.io/videoskillet.js/?p=GIgEEVQA9AEAYA6AAhHAAQBkDEgEkAMLoAIAtAEE6AIEjCEBAACkAgAAAKgBBVxwub4DAKHEAQ&mod=vFreqHz:smooth:0.08:0.0049,fbGain:smooth:0.24:0.06&src=vhs+static

- Chaos black and white feedback
  https://cmdcolin.github.io/videoskillet.js/?p=FJADAMACAuQDNVAImAIAUALIARaQAwoUAIABANQDApQBAHgARAniAQECCVQk5gMAqAEAqAYAgJ9JA8gB&mod=tapeLoopMm:smooth:0.05:0.0151&srcb=tv+static

- Dull color feedback
  https://cmdcolin.github.io/videoskillet.js/?p=CqCsBQEEAcwDAHABXAC8aQGQAwDoAgLMBQCsAgOceQR0GPwBCzgAGADYAQAIAlAAuAIImAIAUALIAQCAAQAkArACAXgAFAJ4ADAGXABcApADCjwA5AEA0AQCkAIA6AEAiAEI0AEA4gEA-AMABAlUJOYDAKgBBcgB&mod=tapeLoopMm:smooth:0.05:0.0151&srcb=tv+static

- Dark camera feedback
  https://cmdcolin.github.io/videoskillet.js/?p=CqCsBQEEAcwDAHABXAC8aQLoAgLMBQCsAgOceQR0GPwBCzgAGADYAQAIAjgAuAIImAIAUALIAQCAAQAkArACAXgAFAJ4ADAGXABcApADAKAhAIgBCKwCAOQBAJgRApACAAAAAADwCAdIALAJAAAABAlUJOYDAKgBBcgBAQQ&mod=tapeLoopMm:smooth:0.05:0.0151&srcb=tv+static&src=tv+static

- Fuzzy color bars feedback
  https://cmdcolin.github.io/videoskillet.js/?p=cqQCAKAfAHoAOgAoAKggACwAYABEABAAmAEQ0AIA1AIwsAEIBA&mod=&srcb=vhs+static

- Fuzzy color bars feedback+dissolver
  https://cmdcolin.github.io/videoskillet.js/?p=BrAEAMgCAKAGPahOAdACAJADAZwCAHolpAIAoB8AegA6ACgAqCAALABgAEQAEACYARDQAgDUAhsEA0oQsAEIBA&mod=&srcb=vhs+static

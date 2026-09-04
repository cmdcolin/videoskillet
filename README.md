# videoskillet.js <img src="public/favicon.svg" alt="videoskillet logo" height="48" />

Tasty WebGPU signal-level composite video emulation. The video effects are a
consequence of NTSC signal, not an effect drawn on the picture.

### Live app!

https://videoskillet.com/app/ — and https://videoskillet.com/ is the landing
page it is reached from.

## Screenshot

[![A photo dubbed to VHS: rainbow chroma noise banding across the frame, torn lines, and the picture bending through a tracking band](img/screenshot.jpg)](https://cmdcolinphotos.s3.amazonaws.com/phosphene/demo-v2.mp4)

## The signal path

**This is the thing to click.** The map sits at the top of the sidebar, and
nearly every control in the app is behind one of its boxes — click a stage and
that stage's controls open underneath it.

![The app window with the signal path map boxed in red at the head of the sidebar and enlarged over the picture: SOURCE A and SOURCE B into MIX, then CHANNEL, RECEIVER and SCREEN, with camera and mixer returns arching back over the trunk, SOUND and VIEW hanging below, and MODULATION and DECK on a row of their own with no wire reaching them](docs/img/signal-path-callout.jpg)

Details in [How it works](docs/FAQ.md#how-does-it-actually-work), fault by
fault in [Features](docs/FEATURES.md).

## Features

- True composite signal emulation in WebGPU compute shaders. This is the
  headline feature!
- Dirty video mix or genlocked (clean) video mixing of two sources
- Video feedback effects including hardware mixer, camera-pointed-at-tv style
  feedback
- Lots of 'faults' like loose cable, bad receiver, inverted polarity, bad
  ground, etc.
- Audio-reactive: feed it music and bass shakes vertical hold of the image, etc.
  Music can come from the mic, a file you pick, the clip on screen, or straight
  off whatever this machine is playing — no loopback device to install
- All settings can be modulated (e.g. with LFO, random walk, sample and hold,
  etc)
- Allows using MIDI controller via WebMIDI, map different knobs to settings of
  interest
- Easy-to-use "randomize" buttons that morph between settings over multiple
  seconds
- Bleeds video into the audio channel, so you can hear that static-y hum
- A rundown down in the **strip** tray: a list of looks that plays itself, each
  row holding for a count of bars and arriving as a cut, a morph or a fault, and
  a **⎙ render** that writes the whole thing to a constant-framerate MP4
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

Most of it works now with no code: MIDI CC and clock over a virtual port, a
patch's audio in by sharing the tab or app it is playing out of (a loopback
device still works, and is the way in on browsers that cannot share audio), a
Jitter render in as a webcam through Syphon, and the picture back out through an
OBS browser source. OSC is the piece that is missing.

## Docs

- [Main docs website](https://videoskillet.com/guide/)
- [Getting started](docs/GETTING-STARTED.md)
- [User guide](docs/USER-GUIDE.md)
- [Features](docs/FEATURES.md)
- [Effects](docs/EFFECTS.md) — every control, generated
- [Drive it by URL](public/llms.txt) — the query string is a complete remote
  control, and [every control's key](public/llms-full.txt) is the half the rest
  of the docs leave out. Published at
  [videoskillet.com/llms.txt](https://videoskillet.com/llms.txt) for anything
  scripting the app.
- [MIDI](docs/MIDI.md)
- [Comparison with other tools](docs/COMPARISON.md)
- [FAQ](docs/FAQ.md) — how it works, what runs it, installing it

---

Note: this project is extensively vibecoded. The initial signal-path design was
one-shotted by [Fable](https://claude.com/), which nailed the "signal level"
idea behind the glitches.

I also had a hard time coming up with a name for this project. I hope you enjoy.
This app is inspired by my old 2010s-era experiments alligator clipping
composite video cables together and posting tumblr gifs.

## Cool demos

<!-- generated:demos -->

- Wiggity
  https://videoskillet.com/app/?p=je.CoDoBwEEAbAEAKwCAfABAKCZAgXgAw2IIwSIAyFYBrAKEjwGmAEEuB4ZVADsBgr4OiSMCQDEAQDgAgAkAUQEBAAQA9wCAMXBAgCJngIAlf4DAI3tAw&mod=bendUs:lorenz:0.390279:0.27759,hvRing:sine:0.037599:0.090209&srcb=synth&src=sweep

- Ridiculous rainbow
  https://videoskillet.com/app/?p=T2.GKAEE4QCRYQDAMQfAJ8FAowfFYwDAfAMAWAA8AIARAZgJEAIBCKcvgErYA&mod=&srcb=none

- Rainborb
  https://videoskillet.com/app/?p=zD.GNADE4QCRYQDAJgfANYEAvAlAOQBFNwBAdAFL0AIBCKcvgE&mod=&srcb=none

- Wonkitize me
  https://videoskillet.com/app/?p=A7.BGgTjAk1NCPEAQCQIACkBgBMAZwhAVwAkAEAHADMARCQAwDQAwDAWwAMAJADANgDAIABAkAA0AEAiAEAwIkBAJADJEAIBCKgnAEfBACgAwCcAQmQAw&mod=&src=ia-random&srcb=tv+static&speeda=0.39

- Chaos black and white feedback
  https://videoskillet.com/app/?p=Nj.FJADAMACAuQDNVAImAIAUALIARaQAwoUAIABANQDApQBAHgARAniAQECCVQk5gMAqAEAqAYAgJ9JA8gB&mod=tapeLoopMm:smooth:0.05:0.0151&srcb=tv+static

- Fuzzy color bars feedback+dissolver
  https://videoskillet.com/app/?p=qQ.BrAEAMgCAKAGPahOAdACAJADAZwCAHolpAIAoB8AegA6ACgAqCAALABgAEQAEACYARDQAgDUAhsEA0oQsAEIBA&mod=&srcb=vhs+static

- Fuzzy color bars feedback
  https://videoskillet.com/app/?p=1w.cqQCAKAfAHoAOgAoAKggACwAYABEABAAmAEQ0AIA1AIwsAEIBA&mod=&srcb=vhs+static

- Camera feedback + static
  https://videoskillet.com/app/?p=IK.GIgEEVQA9AEAYA6AAhHAAQBkDEgEkAMLoAIAtAEE6AICnAEB-CEBKACMAQAgAJADBVxwub4DAKHEAQ&mod=vFreqHz:smooth:0.08:0.0049,fbGain:smooth:0.24:0.06&src=vhs+static

- Dark camera feedback
  https://videoskillet.com/app/?p=CU.CqCsBQEEAcwDAHABXAC8aQLoAgLMBQCsAgOceQR0GPwBCzgAGADYAQAIAjgAuAIImAIAUALIAQCAAQAkArACAXgAFAJ4ADAGXABcApADAKAhAIgBCKwCAOQBAJgRApACAAAAAADwCAdIALAJAAAABAlUJOYDAKgBBcgBAQQ&mod=tapeLoopMm:smooth:0.05:0.0151&srcb=tv+static&src=tv+static

- Ponderorb
  https://videoskillet.com/app/?p=8A.GIgECaABABwAtCUpNCOQAwCsHACACgKUJQK0ARLEAQGcBwAEAIQCAJQDAEwCbACkAgCkAVKA2QE&mod=

- Collecting dust
  https://videoskillet.com/app/?p=R2.cqQCAKAfAHoAOgAoAKggACwAYABEABAAmAEQ0AIAoAMw-AIArAICjBAEBEjgLgCoAQ&mod=&srcb=vhs+static

- Laser duck
  https://videoskillet.com/app/?p=pa.KsgBFDQOGAGgAQDgAwJ4BvABIaQBBdAMOngsgJMC&mod=&srcb=ia-random&iurl=https:%2F%2Fthumb.wikimedia.org%2Fwikipedia%2Fcommons%2Fthumb%2Fb%2Fb4%2F20250724_mallard_duckling_wethersfield_cove_PD201227.jpg%2F1280px-20250724_mallard_duckling_wethersfield_cove_PD201227.jpg%3Futm_source%3Dcommons.wikimedia.org%26utm_campaign%3Dimageinfo%26utm_content%3Dthumbnail

- I can't believe it's not analog butter
  https://videoskillet.com/app/?p=3t.GKwxE4gDRYQDAMQfANADAqwiFZADALgDAJg1AAwAkAMAtAQAfAXQbwC0AiRACAQirGwroAE&mod=&srcb=none

<!-- /generated:demos -->

Send me more stuff you come up with

# videoskillet <img src="public/favicon.svg" alt="videoskillet logo" height="48" />

Tasty WebGPU signal-level analog video emulation. It literally emulates and
glitches NTSC signal data, so the results are quite realistic.

### Live app!

TLDR go here! https://videoskillet.com/

and it works on mobile! tested on Google Pixel with Chrome

## The signal path

**This is the thing to click.** The map sits at the top of the sidebar, and
nearly every control in the app is behind one of its boxes — click a stage and
that stage's controls open underneath it.

![The app window with the signal path map boxed in red at the head of the sidebar and enlarged over the picture: SOURCE A and SOURCE B into MIX, then CHANNEL, RECEIVER and SCREEN, with camera and mixer returns arching back over the trunk, and SOUND and VIEW hanging below](docs/img/signal-path-callout.jpg)

## Features

- True composite signal emulation in WebGPU compute shaders. This is the
  headline feature!
- Dirty video mix or genlocked (clean) video mixing of two sources
- Video feedback effects including hardware mixer, camera-pointed-at-tv style
  feedback
- Lots of 'faults' like loose cable, bad receiver, inverted polarity, bad ground
- Audio-reactive: from the 'mic'/system/loopback, or a file
- All settings can be modulated (e.g. with LFO)
- MIDI controller support via WebMIDI — map different knobs to settings
- Easy-to-use "randomize" buttons, and settings 'morph' over N seconds for
  smooth transitions
- Has the spirit of [video toaster](https://en.wikipedia.org/wiki/Video_Toaster)
  inside of it, being related to kitchen appliances
- Mix your own videos, webcam, static, NTSC color bars, or random
  archive.org/wiki commons videos
- Supports live youtube mixing, but you have to download our
  [command line](docs/CLI.md) tool with yt-dlp
- Also renders videos entirely offline via [command line](docs/CLI.md)
- ...[much more](docs/FEATURES.md)

## Automate it with an AI agent

Claude Code can drive the app running in your browser: open
https://videoskillet.com/app/, run `claude --chrome`, and just say what you want
the app to do, plain english.

See https://videoskillet.com/blog/agent-drives-the-app/

## Docs

Using videoskillet:

- [Getting started](docs/GETTING-STARTED.md)
- [Main docs website](https://videoskillet.com/guide/)
- [Features](docs/FEATURES.md)
- [Effects](docs/EFFECTS.md)
- [MIDI](docs/MIDI.md)
- [FAQ](docs/FAQ.md)
- [Comparison with other tools](docs/COMPARISON.md)
- [URL params](public/llms.txt)

Offline rendering/CLI:

- [CLI](docs/CLI.md) — takes a link and a file and writes ProRes 4444. Also has
  `videoskillet serve`, which hosts the app on your own machine instead of from
  website, and has yt-dlp integration to let you paste youtube on the fly (live
  webapp doesn't have yt-dlp concept...running pnpm dev server also has yt-dlp
  integration)

## About

Note: this project is extensively vibecoded. The initial signal-path design was
one-shotted by [Fable](https://claude.com/), which nailed the "signal level"
idea behind the glitches. If you use this in your own project(s), I'd appreciate
credit

## License

MIT

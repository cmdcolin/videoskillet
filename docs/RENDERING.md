# Rendering to a file

`pnpm render` runs the signal path over a file with no browser in the room. A
look goes in as a link off the app, a clip or a still goes in as a file, and
what comes out is ProRes 4444 that an editor opens.

```
pnpm render in.mp4 out.mov --look='<paste a link off the app>'
pnpm render photo.jpg out.mov --preset=wornTape --seconds=8
pnpm render out.mov --look='<a link that names its own source>'
```

It runs the app's own engine. The pass graph, the control table and the link
parser are the same code the tab runs, bundled so a JavaScript runtime with no
bundler in it can load them, so a look renders here as it renders on screen.

The app's own **⎙ render** in the strip tray is the other way to a file, and the
one to reach for while you are performing. This page is about the other case: a
look you already have, a clip you want it over, and a file you want to cut with.

## Why it exists

The browser's encoder caps what a recording can carry, and it caps it below what
this app makes. `scripts/enccheck.mjs` measures the app's own input path against
one-pixel alternating chroma, which is what dot crawl is:

| codec               | chroma detail retained |
| ------------------- | ---------------------- |
| H.264 High 4:2:0    | 9.03 dB                |
| VP9 profile 1 4:4:4 | 27.66 dB               |
| AV1 4:4:4           | 42.63 dB               |

Measured on Chrome. Firefox scores about 10 dB on every one of those arms: it
declines AV1 4:4:4 and subsamples VP9 profile 1 on the way in whatever profile
it is asked for. So the colour artifacts this whole app exists to produce are
thrown away on the way out, and no muxer work fixes it in the browser this
project develops against.

Here the encoder is ffmpeg. ProRes 4444 keeps every chroma sample, and the codec
roster stops being a negotiation.

Walking the file from the top is not a compromise either. Frame N is a function
of every frame before it, because the feedback loops make it one, so there is no
seeking — which is the same argument that rules out an NLE plugin, arriving at a
command line instead.

## Three renders

Every figure below is one frame of an actual render, made by the command printed
under it. `pnpm render:docs` regenerates them.

Half of what these looks do only reads in motion, and a still cannot show a
Lorenz attractor wandering. `pnpm render:docs --keep` writes watchable copies to
`renders/` alongside the stills.

### A link, whole

![A curved band of raster sweeping across the frame, filled with fine horizontal red and cyan stripes over white, the geometry bending through a lens-shaped arc](img/render-link.webp)

```
pnpm render out.mov --look='https://videoskillet.com/app/?p=je.CoDoBwEEAbAEAKwCAfABAKCZAgXgAw2IIwSIAyFYBrAKEjwGmAEEuB4ZVADsBgr4OiSMCQDEAQDgAgAkAUQEBAAQA9wCAMXBAgCJngIAlf4DAI3tAw&mod=bendUs:lorenz:0.390279:0.27759,hvRing:sine:0.037599:0.090209&srcb=synth&src=sweep'
```

This is the README's **Wiggity** demo, rendered from the link exactly as it is
published. Nothing was passed in: the link names its own sources, so the video
synth and the sweep pattern come up on the two decks by themselves.

The bend across the frame is the part a link carries that is easy to lose. That
look's motion lives in the modulation bay — a Lorenz attractor on `bendUs` and a
sine on `hvRing` — and the renderer reads `?mod=` with the app's own parser. A
renderer that dropped it would produce this look's **resting frame**: a still of
a patch that was supposed to wander, which looks like a picture rather than like
a bug.

### A photograph down a tape path

![A cat photographed and dubbed to tape: heavy coloured speckle over the whole frame, colour smearing sideways off every edge, and short bright dropout dashes across the picture](img/render-still.webp)

```
pnpm render public/sample.jpg out.mov --preset=wornTape --seconds=8
```

A still is a source like any other. ffmpeg holds the picture open for as long as
the render keeps reading, so the frame stays put while everything the chain does
to it moves: the chroma noise crawls, the dropouts land on different lines, and
the tracking servo hunts.

Nothing here is drawn onto the photograph. The colour smearing sideways off
every edge is the colour-under system's bandwidth, and the coloured speckle is
FM discriminator noise landing in the chroma passband.

### The instrument, doing its job

![A multiburst test pattern through a VHS deck: the low-frequency gratings survive at full contrast, the middle ones fade, and the highest two bands are washed to flat grey](img/render-sweep.webp)

```
pnpm render out.mov --pattern=sweep --preset=vhs --seconds=2
```

The sweep pattern stacks gratings at 0.5, 1, 2, 3, 4.2 and 5 MHz. Sent through a
VHS deck, the bottom two survive at full contrast, the middle two fade, and the
top two are washed to flat grey — which is the deck's luma bandwidth, read
straight off the picture.

That makes the renderer an instrument as well as an export: a pattern, a look
and a file is a measurement you can keep and compare against the next one.

## Options

| Flag               | Does                                                  |
| ------------------ | ----------------------------------------------------- |
| `--look=<url>`     | a whole address bar off the app                       |
| `--preset=<name>`  | a built-in preset by name                             |
| `--set=<k:v,…>`    | controls by name, over the above                      |
| `--seconds=<n>`    | how much to render; default is the input's own length |
| `--fps=<n>`        | output rate, default 60 — the simulation's own        |
| `--seed=<n>`       | the dice; the same seed gives the same file           |
| `--motion=<0..1>`  | the modulation bay's master amount                    |
| `--bpm=<n>`        | tempo, for routings locked to a clock                 |
| `--pattern=<name>` | `bars`, `sweep` or `none`, over what the link says    |
| `--codec=<name>`   | `prores`, `dnxhr`, `ffv1`, `h264` or `preview`        |
| `--audio=<mode>`   | `auto`, `buzz`, `source` or `none`                    |

`--look` takes the link whole and reads it with the app's own parser, so the
board, the modulation bay, the source mode, the caption and the seed all arrive
together. Every control name is in [Effects](EFFECTS.md).

Two of the codecs are for leaving the edit suite. `h264` writes High 4:4:4
Predictive, which x264 encodes and no browser will, so a file small enough to
send someone still keeps its chroma — at the cost of players that decline it.
`preview` writes ordinary 4:2:0 High with the index at the front, which opens
anywhere and is what to use for something whose job is to play.

## Audio is part of the picture

Feed a clip's own sound in and the artifacts move with it. Bass drives vertical
hold and HV sag, level drives horizontal hold, and the waveform drives
deflection — so a look built over a track renders **differently in silence**. A
render with no audio is a render of a different board, not a quiet one.

`--audio=auto` is the default: the input's own track goes in, and the
intercarrier buzz comes back out beside it when the look asks for one. The buzz
is the picture arriving on the audio line — a bright scene buzzes louder, hum
bars beat against the field rate, and a head switch clicks on the line it
damages.

Two renders of one take are the same file, sound included. The dice come from
`--seed`, the clock is the render's own, and the audio window is cut at the
frame being rendered rather than whenever the browser's audio clock delivered
it.

## What it needs

Deno for the runtime, ffmpeg for both ends, and a checkout — this is a local
tool rather than something the hosted app can do. `pnpm render` builds the
engine bundle first, so there is no separate step.

## What it does not do

- **No rundown.** `--look` is one board for the whole render, where the strip
  tray is a sequence of them. Perform it in the app and use ⎙ for that.
- **Nothing it has to fetch.** A link naming a clip, a still or a random pick
  from an archive renders over whatever file was passed instead, because the
  reader of a link has neither.

---

[Editor](EDITOR.md): how the export half is built · [User guide](USER-GUIDE.md):
driving the app · [Effects](EFFECTS.md): every control

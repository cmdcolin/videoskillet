# Rendering to a file

`pnpm render` runs the signal path over a file without a browser. A look goes in
as a link copied from the app, a clip or a still goes in as a file, and the
command writes ProRes 4444 that an editor can open.

```
pnpm render in.mp4 out.mov --look='<paste a link off the app>'
pnpm render photo.jpg out.mov --preset=wornTape --seconds=8
pnpm render out.mov --look='<a link that names its own source>'
```

The renderer runs the app's own engine. The pass graph, the control table and
the link parser are the same code the tab runs, bundled so a JavaScript runtime
with no bundler in it can load them, so a look renders here as it renders on
screen. The command runs from a checkout of the repository;
[Installing](#installing) has the four-line version.

The app's own **⎙ render** in the strip tray is the other route to a file, and
the one to use while you are performing. This page covers the offline case: a
look you already have, a clip to put it over, and a file to cut with.

## Why rendering happens outside the browser

The browser's encoder limits what a recording can carry, and the limit sits
below what this app produces. `scripts/enccheck.mjs` measures the app's own
input path against one-pixel alternating chroma, which is what dot crawl is:

| codec               | chroma detail retained |
| ------------------- | ---------------------- |
| H.264 High 4:2:0    | 9.03 dB                |
| VP9 profile 1 4:4:4 | 27.66 dB               |
| AV1 4:4:4           | 42.63 dB               |

Those numbers are Chrome's. Firefox scores about 10 dB on all three: it declines
AV1 4:4:4, and it subsamples VP9 profile 1 on the way in whatever profile it is
asked for. A browser recording therefore discards the colour artifacts this app
exists to produce, and the browser this project develops against has no path
that keeps them.

`pnpm render` hands the frames to ffmpeg, which encodes ProRes 4444 and keeps
every chroma sample.

A command line also suits the simulation. The feedback loops make frame N a
function of every frame before it, so a render walks the file from the top and
never seeks. The same property is what rules out an NLE plugin, and a command
that always starts at the beginning satisfies it without extra machinery.

## Example renders

Every figure below is one frame of an actual render, made by the command printed
under it. `pnpm render:docs` regenerates them.

Much of what these looks do is visible only in motion, and a still cannot show a
Lorenz attractor wandering. `pnpm render:docs:keep` writes watchable copies
beside the stills; see [Where the file goes](#where-the-file-goes).

### A published link

![A curved band of raster sweeping across the frame, filled with fine horizontal red and cyan stripes over white, the geometry bending through a lens-shaped arc](img/render-link.webp)

```
pnpm render out.mov --look='https://videoskillet.com/app/?p=je.CoDoBwEEAbAEAKwCAfABAKCZAgXgAw2IIwSIAyFYBrAKEjwGmAEEuB4ZVADsBgr4OiSMCQDEAQDgAgAkAUQEBAAQA9wCAMXBAgCJngIAlf4DAI3tAw&mod=bendUs:lorenz:0.390279:0.27759,hvRing:sine:0.037599:0.090209&srcb=synth&src=sweep'
```

This is the README's **Wiggity** demo, rendered from the link exactly as it is
published. The command passes no input: the link names its own sources, so the
video synth and the sweep pattern load on the two decks by themselves.

The bend across the frame is the part of a link that is easiest to lose. The
look's motion lives in the modulation bay, a Lorenz attractor on `bendUs` and a
sine on `hvRing`, and the renderer reads `?mod=` with the app's own parser. A
renderer that ignored it would write the look's resting frame: a still of a
patch that was supposed to wander, a failure that looks deliberate.

### A photograph down a tape path

![A cat photographed and dubbed to tape: heavy coloured speckle over the whole frame, colour smearing sideways off every edge, and short bright dropout dashes across the picture](img/render-still.webp)

```
pnpm render public/sample.jpg out.mov --preset=wornTape --seconds=8
```

A still is a source like any other. ffmpeg holds the picture open for as long as
the render keeps reading, so the frame stays put while the chain's own motion
continues: the chroma noise crawls, the dropouts land on different lines, and
the tracking servo hunts.

Nothing here is drawn onto the photograph. The colour smearing sideways off
every edge is the colour-under system's bandwidth, and the coloured speckle is
FM discriminator noise landing in the chroma passband.

### A test pattern through a VHS deck

![A multiburst test pattern through a VHS deck: the low-frequency gratings survive at full contrast, the middle ones fade, and the highest two bands are washed to flat grey](img/render-sweep.webp)

```
pnpm render out.mov --pattern=sweep --preset=vhs --seconds=2
```

The sweep pattern stacks gratings at 0.5, 1, 2, 3, 4.2 and 5 MHz. Sent through a
VHS deck, the bottom two survive at full contrast, the middle two fade, and the
top two wash out to flat grey. That is the deck's luma bandwidth, read straight
off the picture.

A pattern, a look and a file together make a measurement, so the renderer serves
as an instrument as well as an export. Keeping the file makes the next render
comparable.

## Options

| Flag               | Meaning                                            |
| ------------------ | -------------------------------------------------- |
| `--look=<url>`     | a whole address bar off the app                    |
| `--preset=<name>`  | a built-in preset by name                          |
| `--set=<k:v,…>`    | individual controls, applied over the above        |
| `--seconds=<n>`    | how much to render; default is the input's length  |
| `--fps=<n>`        | output rate; default 60, the simulation's own rate |
| `--seed=<n>`       | random seed; the same seed gives the same file     |
| `--motion=<0..1>`  | the modulation bay's master amount                 |
| `--bpm=<n>`        | tempo, for routings locked to a clock              |
| `--pattern=<name>` | `bars`, `sweep` or `none`, over what the link says |
| `--codec=<name>`   | `prores`, `dnxhr`, `ffv1`, `h264` or `preview`     |
| `--audio=<mode>`   | `auto`, `buzz`, `source` or `none`                 |

`--look` takes the link whole and reads it with the app's own parser, so the
board, the modulation bay, the source mode, the caption and the seed all arrive
together. Every control name is in [Effects](EFFECTS.md).

`prores` is the default and the codec to cut with. Two of the others suit a file
that has to travel. `h264` writes High 4:4:4 Predictive, which x264 encodes and
no browser does, so the file stays small and keeps its chroma, though some
players decline the profile. `preview` writes ordinary 4:2:0 High with the index
at the front, which opens anywhere, and is the choice when the file's job is to
play.

## Audio

The artifacts move with the input's sound. Bass drives vertical hold and HV sag,
level drives horizontal hold, and the waveform drives deflection, so a look
built over a track renders differently in silence. The same look with no audio
produces a different picture.

`--audio=auto` is the default: the input's own track goes in, and the
intercarrier buzz comes back out beside it when the look asks for one. The buzz
is the picture arriving on the audio line, so a bright scene buzzes louder, hum
bars beat against the field rate, and a head switch clicks on the line it
damages.

Two renders of one take produce the same file, sound included. `--seed` fixes
the random sequence, the render supplies its own clock, and each audio window is
cut at the frame being rendered.

## Where the file goes

The last argument is the output path, and its extension picks the container:
`.mov` for ProRes, `.mp4` for the H.264 codecs. The command writes only that
file and leaves everything already on disk in place.

Length comes from the input. A clip renders for as long as it runs, `--seconds`
overrides that, and a source with no length of its own — a still, a pattern, a
link naming the synth — renders ten seconds unless told otherwise.

The figures on this page work differently. `pnpm render:docs` renders each one,
keeps the still and discards the clip: the repo's clips rule exists to keep
megabyte-scale binaries, re-rendered whenever a look changes, out of the
history. `pnpm render:docs:keep` also writes watchable copies to `renders/`,
which is gitignored.

## Installing

`pnpm render` runs from a checkout of the repository. The renderer is a local
tool, and the hosted app has no equivalent.

```
git clone https://github.com/cmdcolin/videoskillet
cd videoskillet
pnpm install
pnpm render in.mp4 out.mov --preset=vhs
```

Four programs have to be on PATH. Node and pnpm build the engine bundle.
[Deno](https://deno.com/) runs it: the renderer drives Deno's own WebGPU, so the
shaders execute on the same hardware the tab would use, and a machine with no
working GPU driver has nothing to render on. ffmpeg works both ends of the pipe,
decoding the input and encoding the output.

`pnpm render` builds the bundle before every run, so there is no separate step.
The first run takes a few seconds longer than the ones after it.

## Limitations

- **One board per render.** `--look` sets a single board for the whole render,
  where the strip tray holds a sequence of them. Perform a sequence in the app
  and export it with ⎙.
- **Local sources only.** A link that names a clip, a still or a random pick
  from an archive renders over whatever file was passed on the command line. The
  renderer reads its source from disk and fetches nothing.

---

[Editor](EDITOR.md): how the export half is built · [User guide](USER-GUIDE.md):
driving the app · [Effects](EFFECTS.md): every control

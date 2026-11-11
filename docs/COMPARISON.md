# Where videoskillet sits

Several projects make video look like it went through composite, tape and a CRT,
and they differ in what they operate on. videoskillet simulates one signal,
live, so every fault lands on the same waveform.

## The neighbours

### ntsc-rs

[ntsc-rs](https://github.com/ntsc-rs/ntsc-rs) shares the premise of simulating
the path rather than drawing the look. It ships standalone, in a browser, and as
AE / Premiere / OpenFX plugins, and its multithreaded SIMD Rust runs in real
time well above NTSC resolution.

ntsc-rs is licensed under MIT, Apache-2.0 or ISC, at the user's choice, except
for the standalone GUI, which is GPL-3.0.

### Yurenaki

[Yurenaki](https://oopsyte.com/) shares the most of videoskillet's model. It is
a paid OpenFX plugin for DaVinci Resolve on Windows that encodes footage to a
composite signal and passes it through four stages: an enhancer with feedback, a
sync mixer that takes the picture from locked through rolling, white, snow and
black, a television that tries to lock to the result, and a camera filming the
screen and feeding it back in. Each frame depends on the frames before it, so
its stripes and tears keep moving on a still picture. It runs on the CPU at a
768×480 raster, renders the same range to the same file every time, and every
control except camera position takes Resolve keyframes.

videoskillet has each of those four stages, together with tape, the tuner, a
second source and a signal-level mixer loop, and runs them live in a browser.
Yurenaki has the timeline and the editor integration that videoskillet lacks.

Yurenaki is proprietary and paid, and its source is not public.

### BENDR

[BENDR](https://github.com/clickysteve/bendr) is the closest browser neighbour:
a live browser tool with four channels, a reorderable chain on each, three mix
buses, keys and wipes, all in one HTML file a phone will run. Each fault —
chroma bleed, rainbow fringing, dot crawl, ringing, line-by-line sync tears — is
a slider drawn onto the picture, independent of the others, so the stages
reorder freely.

BENDR is licensed under MIT.

videoskillet builds the signal: a picture becomes a composite waveform, the
model damages that waveform, and a model of a TV decodes it back. Dot crawl and
rainbow fringing are then leftovers of a decoder that could not separate colour
from brightness cleanly, so every fault on the signal interacts with every other
one.

### vhs-phys

[vhs-phys](https://github.com/allthemalware/vhs-phys) models a VHS deck at the
RF level. It records luma as an FM signal onto a simulated tape with helical
track geometry, reads it back through a head whose spacing and azimuth set the
loss, and decodes it through deck electronics whose parts age with years, heat
and humidity. Head clogs, mistracking and capacitor hum all come from those
parameters. It also models PAL, the linear audio track, a camera pickup tube and
outside interference, and its tests check each part against the physical law
behind it. It is a Rust command-line tool with a desktop front end and renders
offline at about 12 frames per second.

videoskillet's tape stage works on the composite signal at 4 × F_SC, a whole
frame at a time, with no field or track geometry, so vhs-phys models tape in
much more depth. videoskillet runs live, and it has a receiver that can lose
lock, the mixer and the feedback loops, none of which vhs-phys models.

vhs-phys is licensed under PolyForm Noncommercial 1.0.0. Its source is public,
and commercial use needs a separate licence from its author.

### vhs-decode / ld-decode

[vhs-decode](https://github.com/oyvindln/vhs-decode) runs the other way: RF
tapped off a working deck's head amp, captured with a CX card or a Domesday
Duplicator and decoded in software — VHS, SVHS, U-Matic, Betamax, Video8 — out
to timebase-corrected luma and chroma. It supplies real signals, so a claim made
here can be checked against one.

vhs-decode and ld-decode are licensed under GPL-3.0.

### Blargg's filters and the RetroArch CRT shaders

Blargg's filters and the RetroArch shaders solve the console-on-a-period-TV
problem. `nes_ntsc` and `snes_ntsc` model composite artifacts for one console's
output, fast and accurate for that case; the RetroArch shaders (`crt-royale`,
`crt-guest-advanced`) model the display — mask, scanlines, phosphor, geometry,
glow.

Blargg's filters are licensed under LGPL-2.1 or later, and both shaders under
GPL-2.0 or later.

## What videoskillet does

videoskillet runs live. Every stage of the path has controls, any of them can be
driven by an LFO, live audio or a MIDI knob, and two feedback loops run inside
the model: a camera aimed at the monitor it feeds, and a mixer patched into
itself at signal level. The app records a take to an MP4, and `pnpm render`
writes ProRes 4444. [The features](FEATURES.md) list the rest.

videoskillet is licensed under MIT.

### Limitations

- **No plugin, and no timeline.**
  [The FAQ](FAQ.md#will-there-be-a-plugin-for-after-effects-premiere-or-resolve)
  says why. Clips line up in a rundown ([the editor](EDITOR.md)).
- **The raster is fixed** at 910×525 samples, 754×480 active, so a 4K source is
  sampled down to NTSC resolution.
- **A take is only reproducible from clips.** Offline renders of one take come
  out identical; a camera, a screen share or the mic is live capture.
- **It needs a WebGPU browser.** [The FAQ](FAQ.md#what-does-it-need-to-run)
  lists them.
- **The model is progressive** 525/60 rather than interlaced at field rate, the
  largest remaining authenticity gap ([the architecture](ARCHITECTURE.md)).

<sub>Written from the other projects' own documentation, source and product
pages, not from benchmarks run here. If something is out of date or unfair,
please open an issue.</sub>

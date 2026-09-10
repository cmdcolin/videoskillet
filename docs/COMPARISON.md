# Where videoskillet.js sits

Several projects make video look like it went through composite, tape and a CRT.
They differ in what they operate on and what they are for. This project
simulates one signal, bent live, with every fault landing on it.

## The neighbours

### ntsc-rs

[ntsc-rs](https://github.com/ntsc-rs/ntsc-rs) shares the premise of simulating
the path rather than drawing the look, and it lives in the editing suite. It
ships standalone, in a browser, and as AE / Premiere / OpenFX plugins, and its
multithreaded SIMD Rust runs in real time well above NTSC resolution.
videoskillet.js is fixed to the NTSC raster and has no plugin yet
([the FAQ](FAQ.md)).

### BENDR

[BENDR](https://github.com/clickysteve/bendr) is the closest neighbour: another
live browser tool, and a much broader one — four channels, a reorderable chain
on each, three mix buses, keys and wipes, all in one HTML file that a phone will
run. It works on the picture. Chroma bleed, rainbow fringing, dot crawl and
ringing each get a slider, and the sync faults are drawn on line by line, which
is what lets the stages reorder freely.

videoskillet.js builds the signal instead. A picture becomes a composite
waveform — sync pulses, colour burst, colour on the subcarrier — the model
damages that waveform, and a model of a TV locks to it and decodes it back. Dot
crawl and rainbow fringing are then leftovers of a decoder that could not
separate colour from brightness cleanly, so they change whenever anything
upstream does. The trade is a far narrower tool where every fault lands on the
same signal, so the faults interact without being wired together.

### vhs-decode / ld-decode

[vhs-decode](https://github.com/oyvindln/vhs-decode) runs the other way: RF
tapped off a working deck's head amp, captured with a CX card or a Domesday
Duplicator and decoded in software — VHS, SVHS, U-Matic, Betamax, Video8 — out
to timebase-corrected luma and chroma. It synthesises nothing, so it supplies
real signals, and a claim made here can be checked against one.

### Blargg's filters and the RetroArch CRT shaders

These solve the console-on-a-period-TV problem. `nes_ntsc` and `snes_ntsc` model
composite artifacts for one console's output, fast and accurate for that case;
the RetroArch shaders (`crt-royale`, `crt-guest-advanced`) model the display —
mask, scanlines, phosphor, geometry, glow.

## What videoskillet.js does

videoskillet.js is a **live instrument**. The signal path stays resident on the
GPU as compute shaders, so a control change is a uniform-buffer write rather
than a re-render. Every stage of the path gets a control, any of them can be
driven by an LFO, live audio or a MIDI knob, and two feedback loops run inside
the model — a camera at its own monitor, and a mixer patched into itself at
signal level. A take renders offline to constant-framerate H.264, and a link
carries the look. [The features](FEATURES.md) list the rest.

### Limitations

- **No plugin, and no timeline.** Clips line up in a rundown, and a rendered
  take carries no audio track ([the editor](EDITOR.md)).
- **The raster is fixed** at 910×525 samples, 754×480 active, so a 4K source is
  sampled down to NTSC resolution.
- **A take is only reproducible from clips.** Offline renders of one take come
  out identical; a camera, a screen share or the mic is live capture.
- **It needs a WebGPU browser**. On Linux, Firefox Nightly or Chrome.
- **The model is progressive** 525/60 rather than interlaced at field rate, the
  largest remaining authenticity gap ([the architecture](ARCHITECTURE.md)).

<sub>All free and open source. Written from the other projects' own
documentation and source, not from benchmarks run here. If something is out of
date or unfair, please open an issue.</sub>

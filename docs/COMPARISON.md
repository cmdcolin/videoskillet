# Where videoskillet sits

Several projects make video look like it went through composite, tape and a CRT.
They differ in what they operate on. videoskillet simulates one signal, live, so
every fault acts on the same waveform.

## The neighbours

### ntsc-rs

[ntsc-rs](https://github.com/ntsc-rs/ntsc-rs)

- Simulates the signal path.
- Ships standalone, in a browser, and as AE / Premiere / OpenFX plugins.
- Multithreaded SIMD Rust, real time well above NTSC resolution.
- License: MIT, Apache-2.0 or ISC at the user's choice; the standalone GUI is GPL-3.0.

### Yurenaki

[Yurenaki](https://oopsyte.com/)

- Paid OpenFX plugin for DaVinci Resolve on Windows.
- Encodes footage to a composite signal, then passes it through four stages: an enhancer with feedback, a sync mixer (locked through snow and black), a television that tries to lock, and a camera filming the screen. As a result, its model is similar to videoskillet's.
- Each frame depends on earlier ones, so stripes and tears keep moving on a still.
- CPU at 768×480, same output every render; all controls except camera position take Resolve keyframes.
- videoskillet has those four stages plus tape, tuner, second source and a signal-level mixer loop, and runs live in a browser.
- Yurenaki has the timeline and editor integration that videoskillet lacks.
- License: Proprietary.

### Raster Weaver

[Raster Weaver](https://meltedelectronics.com/raster-weaver/manual/)

- Desktop video synth for Windows and macOS, with 38 modules and user modules in GLSL.
- Each cable carries a full 16-bit float RGBA frame, so any image can modulate any knob per pixel.
- Analog mode changes every module: bandwidth, ringing, saturation, drift, noise, jitter and hum.
- Feedback delays up to 16 frames, and cables can loop back into earlier modules.
- The spec lists no sync separator, PLL or burst gate. The Composite module encodes NTSC or PAL.
- videoskillet runs the whole path on one waveform, so a receiver locks to the damage, and tearing, rolling and hue throw follow.
- Raster Weaver has Spout, Syphon, OSC, multiple output windows and offline rendering up to 8K. videoskillet has no built-in Spout, Syphon or OSC, and its raster is fixed.
- License: Proprietary.

### BENDR

[BENDR](https://github.com/clickysteve/bendr)

- Four channels, each with a reorderable chain; three mix buses, keys and wipes; one HTML file.
- Each fault (chroma bleed, rainbow fringing, dot crawl, ringing, sync tears) is a slider on the picture.
- videoskillet builds the signal: the model damages a composite waveform, and a modelled TV decodes it.
- In videoskillet, dot crawl and rainbow fringing come from a decoder that cannot separate colour from brightness, so every fault interacts with every other.
- License: MIT.

### vhs-phys

[vhs-phys](https://github.com/allthemalware/vhs-phys)

- Models a VHS deck at the RF level: FM luma on helical-track tape, head spacing and azimuth, and deck electronics that age with heat and humidity.
- Also models PAL, linear audio, a camera pickup tube and outside interference.
- Rust CLI with a desktop front end; renders offline at about 12 fps.
- videoskillet's tape works on composite at 4 × F_SC, a frame at a time, with no track geometry, so vhs-phys models tape in more depth.
- videoskillet runs live, with a receiver that can lose lock, the mixer and the feedback loops. vhs-phys models none of these.
- License: PolyForm Noncommercial 1.0.0; commercial use needs a licence from its author.

### vhs-decode / ld-decode

[vhs-decode](https://github.com/oyvindln/vhs-decode)

- Decodes RF captured from real decks (CX card, Domesday Duplicator): VHS, SVHS, U-Matic, Betamax, Video8.
- Outputs timebase-corrected luma and chroma, so claims here can be checked against real signals.
- License: GPL-3.0.

### Blargg's filters and the RetroArch CRT shaders

- `nes_ntsc` and `snes_ntsc`: composite artifacts for one console's output, fast and accurate.
- `crt-royale` and `crt-guest-advanced`: the display (mask, scanlines, phosphor, geometry, glow).
- License: LGPL-2.1 or later for the Blargg filters; GPL-2.0 or later for the RetroArch shaders.

## What videoskillet does

- Runs live; an LFO, live audio or a MIDI knob can drive any stage control.
- Two feedback loops: a camera aimed at its monitor, and a mixer patched into itself at signal level.
- Records a take to MP4; `pnpm render` writes ProRes 4444. [The features](FEATURES.md) list the rest.
- License: MIT.

### Limitations

- **No plugin, and no timeline.** [The FAQ](FAQ.md#will-there-be-a-plugin-for-after-effects-premiere-or-resolve) says why. Clips line up in a rundown ([the editor](EDITOR.md)).
- **The raster is fixed** at 910×525 samples, 754×480 active; a 4K source is sampled down to NTSC resolution.
- **Offline renders of a clip-based take are identical.** A camera, screen share or mic is live capture, so a take that uses one does not repeat.
- **It needs a WebGPU browser.** [The FAQ](FAQ.md#what-does-it-need-to-run) lists them.
- **The model is progressive.** It runs 525/60 frames; real NTSC sends 60 fields a second. This is the largest remaining authenticity gap ([the architecture](ARCHITECTURE.md)).

<sub>Written from each project's public documentation and product pages, and the videoskillet side from this repo's docs. No benchmarks were run here. Yurenaki and Raster Weaver are closed source, so statements about how they work inside are inferred from their public manuals and specs, not confirmed. If something is out of date or unfair, please open an issue.</sub>

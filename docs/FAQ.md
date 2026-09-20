# FAQ

[Where it sits](COMPARISON.md) has the longer comparison with other tools; this
page is the short version.

## How does it actually work?

The whole program is one array of numbers and a chain of small GPU programs that
rewrite it.

### The array

A frame of NTSC is 525 lines of 910 samples: 477,750 floats, one voltage each.
It is allocated once in GPU memory and never comes back to the CPU. Sample `s`
of line `row` is at index `row * 910 + s`.

### A compute shader is the body of a for loop

Shifting every line sideways means one interpolation per sample: 478k iterations
of a `for` loop on the CPU, a dozen stages deep, 60 times a second, which is
hopeless on one thread. A GPU runs that loop body for every `n` at once, so you
write the body and it supplies the `n`. That is `timebase.wgsl`, trimmed:

```wgsl
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x;      // sample across the line
  let row = gid.y;    // which line
  if (s >= SPL || row >= NLINES) { return; }

  let n = row * SPL + s;
  let pos = f32(n) + lineParams[row].x;
  dst[n] = catmull(src, pos);
}
```

Thousands of copies run at once in no particular order, safe because each one
writes a single `dst[n]`. Threads launch in fixed blocks of 64, so 15 blocks
cover a line's 910 samples with 50 to spare, and the `if (s >= SPL) { return; }`
in every shader drops those 50.

### The chain

A dozen compute passes in a row, each reading the array and writing it back:
encode the picture into the waveform, damage it, decode it back. The shaders
stay resident, so moving a slider writes a number the next frame reads and
nothing recompiles.

Pass list in `src/core/gpu/pipeline.ts`, shaders in `src/core/gpu/shaders/`.
[The architecture](ARCHITECTURE.md) has the full pass order and buffer layouts,
and [the optimizations](OPTIMIZATIONS.md) covers what keeps a dozen passes
inside a 60 Hz budget.

## What does it need to run?

The signal path runs in WebGPU compute shaders with no fallback renderer, so a
browser without WebGPU gets the "this browser cannot run it" screen.

- **Desktop** — Chrome, Edge, or Firefox with WebGPU enabled, on any OS with
  working hardware acceleration.
- **Android** — Chrome 121 and up on Android 12 and up, where WebGPU is on by
  default.
- **iPhone and iPad** — iOS/iPadOS 18.2 and up, where Safari shipped WebGPU on
  by default. A home-screen install runs on the same WebKit engine, so it gets
  WebGPU on the same versions Safari does.

A phone GPU has much less headroom. The most expensive effects (feedback, the
wide comb) run, at a lower resolution and frame rate than a laptop holds.

## Can I install it on a phone or a desktop?

Yes. A manifest, an icon set and a service worker ship with the build, so the
browser can put it on a home screen or dock and open it with no chrome around
the picture. Chrome and Edge offer the install from the address bar, and Safari
on iOS from Share → _Add to Home Screen_, the only install of this kind iOS has.
Firefox on Android and Safari on macOS have no install.

An installed copy starts offline, since the shell and bundle are cached; the
sample clips and anything saved to the cloud still need a network. It also gets
its own storage, so a clip shelf built up in the browser tab is not in the
installed copy — saved looks arrive once you sign in there, but the clip library
is per-device.

## What does signing in give me?

A library, and a way back into it. Saved profiles live on the account, so a look
named on a laptop is there on a phone. The app also autosaves the session you
are running, so videoskillet.com opens on a home page with a card that resumes
it and a still of each look you saved.

Everything else works signed out and offline: presets, scenes, pinned sliders,
the rundown, recording, and the URL that carries the whole look. The clip
library, the rundown and the pinned sliders stay on the machine that made them.
[ADR 0010](adr/0010-the-account-holds-the-session.md) has the reasoning.

## Will there be a plugin for After Effects, Premiere or Resolve?

Not yet, and it is a bigger job than moving the shaders across. The shaders are
about a third of the simulator; the rest is per-frame CPU state in
`src/core/signal/` and the pass graph and stateful buffers in `src/core/gpu/`.
No plugin API renders through WebGPU today — OFX and Adobe's SDK render through
CUDA, OpenCL or Metal — so every frame would cross into a WebGPU island and
back. Feedback then makes each frame depend on every frame before it, while a
host expects to scrub, play from the middle and preview before the clip has been
rendered from the top.

[ntsc-rs](https://github.com/ntsc-rs/ntsc-rs) covers much of the need today:
same premise, multithreaded Rust on the CPU, with After Effects, Premiere and
OpenFX builds.

## Then how do I get a result into an edit?

Render a file. Open the **strip** tray at the bottom and press **⎙ render**. The
take plays on a virtual clock instead of wall time, and you get a
constant-framerate H.264 MP4 that Resolve and Premiere import directly. **●**
records every move against the frame it happened on, and **⎙** replays it into
the render at a steady framerate.

Run the project locally when the colour matters. `pnpm render` takes a link and
a file and writes ProRes 4444, where a browser's 4:2:0 encode loses most of the
chroma artifacts. [CLI](CLI.md) covers it.

## Can I feed it a real composite signal off a yellow RCA cable?

Through a USB capture dongle, yes. The cable carries a baseband composite
waveform at about 1 Vpp, something has to sample that voltage, and nothing in a
browser can. Plug the cable into an RCA/composite grabber and the OS presents it
as a camera: pick **Webcam / USB device** on a source deck, choose the grabber,
and it lands in a slot like any other source, with the whole signal, sync and
deflection chain over it. Each deck takes a separate device, so a camera in A
and a grabber in B is a rig the app expects.

The grabber demodulates in hardware and hands over decoded 720×480 frames, so
what a consumer dongle does — luma cut to around 2.4 MHz, colour-under chroma,
chroma a few samples late — has already happened and cannot be undone. The
`capture card` preset models that decode, so a captured feed carries one pass of
it for real and whatever you dial in on top.

A dongle delivers 480/60i, so the app turns bob deinterlace on per deck when a
device connects. PAL grabbers (720×576/50i) are not handled yet; the pipeline is
NTSC-shaped at 525/60.

## Can I patch it into Max/MSP, Jitter, TouchDesigner or VJ software?

Most of this already works, with no code on either side:

- **Control in** — MIDI CC and MIDI clock over a virtual port (IAC bus,
  loopMIDI). Every slider can learn a CC; see
  [Using a MIDI controller](MIDI.md).
- **Audio in** — pick **System audio** under **♪** and share the tab or app your
  patch plays out of, or pick a loopback device (BlackHole, or the equivalent on
  your OS) as the microphone. Either feeds the audio-driven bend, load and level
  controls.
- **Video in** — a Jitter or TouchDesigner render can come in as a webcam source
  through a Syphon → virtual-camera bridge.
- **Video out** — point an OBS browser source at the page.

OSC is not built. Browsers cannot speak UDP, so it needs a small local bridge in
the middle. NDI or WebRTC output is on the same list. Running the app inside a
patch, through Max's `jweb` for instance, depends on that web view getting
WebGPU.

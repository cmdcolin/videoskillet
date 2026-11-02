# FAQ

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
  working hardware acceleration. On Linux, use Firefox Nightly, or Chrome with
  WebGPU enabled.
- **Android** — Chrome 121 and up on Android 12 and up, where WebGPU is on by
  default.
- **iPhone and iPad** — iOS/iPadOS 18.2 and up, where Safari shipped WebGPU on
  by default. A home-screen install runs on the same WebKit engine, so it gets
  WebGPU on the same versions Safari does.

A phone GPU has much less headroom. The most expensive effects (feedback, the
wide comb) run, at a lower resolution and frame rate than a laptop holds.

## Can I install it on a phone or a desktop?

Yes. A manifest, an icon set and a service worker ship with the build, so the
browser can put it on a home screen or dock and open it with no browser toolbar
around the picture. Chrome and Edge offer the install from the address bar, and
Safari on iOS from Share → _Add to Home Screen_, the only install of this kind
iOS has. Firefox on Android and Safari on macOS have no install.

An installed copy starts offline, since the shell and bundle are cached; the
sample clips and anything saved to the cloud still need a network. An installed
copy also has separate storage, so a clip shelf built up in the browser tab is
not in the installed copy. Saved looks appear once you sign in on the installed
copy, but the clip library stays on each device.

## What does signing in give me?

Saved profiles are stored on the account, so a look named on a laptop is there
on a phone. The app also autosaves the session you are running, so
videoskillet.com opens on a home page with a card that resumes it and a still of
each look you saved.

Everything else works signed out and offline: presets, scenes, pinned sliders,
the rundown, recording, and [sharing a link](GETTING-STARTED.md#sharing-a-look).
The clip library, the rundown and the pinned sliders stay on the machine that
made them. [ADR 0010](adr/0010-the-account-holds-the-session.md) has the
reasoning.

## Is there a resolume plugin?

Yes! after I posted this on Reddit xhzrdx ported it to resolume!
https://hzrdarchive.com/pages/skillet#skillet-ui

## Will there be a plugin for After Effects, Premiere or Resolve?

Not yet. The shaders are about a third of the simulator; the rest is per-frame
CPU state in `src/core/signal/` and the pass graph and stateful buffers in
`src/core/gpu/`. OFX and Adobe's SDK render through CUDA, OpenCL or Metal, so
every frame would be copied into WebGPU and back. Feedback also makes each frame
depend on every frame before it, while a host expects to scrub and play from the
middle.

[ntsc-rs](COMPARISON.md#ntsc-rs) has After Effects, Premiere and OpenFX builds
today.

## Then how do I get a result into an edit?

Render a file: **⎙ render** in the strip tray writes a constant-framerate MP4
that Resolve and Premiere import directly. When the colour matters,
`pnpm render` writes ProRes 4444; [CLI](CLI.md) covers it.

## Can I feed it a real composite signal off a yellow RCA cable?

Through a USB capture dongle, yes. The cable has a baseband composite waveform
at about 1 Vpp, and a browser has no way to sample that voltage. An
RCA/composite grabber does, and the OS presents it as a camera: pick **Webcam /
USB device** on a source deck and choose the grabber, and the whole signal, sync
and deflection chain runs over it. Each deck takes a separate device, so a
camera in A and a grabber in B work at the same time.

The grabber demodulates in hardware and hands over decoded 720×480 frames, so
what a consumer dongle does — luma cut to around 2.4 MHz, colour-under chroma,
chroma a few samples late — has already happened and cannot be undone. The
`capture card` preset models that decode, so a captured feed has already been
through one real pass of it before anything you dial in.

A dongle delivers 480/60i, so the app turns bob deinterlace on per deck when a
device connects. PAL grabbers (720×576/50i) are not handled, because the
pipeline is fixed to NTSC at 525/60.

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

OSC, NDI and WebRTC output are not built; browsers cannot send UDP, so OSC would
need a small local bridge. Running the app inside a patch, through Max's `jweb`
for instance, depends on that web view having WebGPU.

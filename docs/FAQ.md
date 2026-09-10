# FAQ

How it works, what it takes to run, where it can be installed, and how a take
gets into an edit. [Where it sits](COMPARISON.md) has the longer comparison with
other tools; this page is the short version.

## How does it actually work?

The whole program is one array of numbers and a chain of small GPU programs that
rewrite it.

### The array

A frame of NTSC is 525 lines of 910 samples: 477,750 floats, one voltage each.
It is allocated once in GPU memory and never comes back to the CPU. Sample `s`
of line `row` is at index `row * 910 + s`.

### A compute shader is the body of a for loop

Shifting every line sideways would be this on the CPU:

```js
for (let n = 0; n < signal.length; n++) {
  out[n] = interpolate(signal, n + offsetForLine[Math.floor(n / 910)])
}
```

That is 478k iterations, a dozen stages deep, 60 times a second, which is
hopeless on one thread. A GPU runs that body for every `n` at once, so you write
the body and it supplies the `n`. That is `timebase.wgsl`, trimmed:

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

Thousands of copies run at once in no particular order, safe because each writes
only its own `dst[n]`. Launching it means giving the bounds of that loop, which
come back as `gid`:

```ts
cp.dispatchWorkgroups(Math.ceil(910 / 64), 525)
```

Threads launch in fixed blocks of 64, so 15 blocks per line covers 910 samples
with 50 to spare, hence the `if (s >= SPL) { return; }` in every shader.

### The chain

A dozen passes like that in a row: encode the picture into the waveform, damage
it, decode it back. Each reads the array and writes it back. The shaders stay
resident, so moving a slider writes a number the next frame reads and nothing
recompiles.

Pass list in `src/core/gpu/pipeline.ts`, shaders in `src/core/gpu/shaders/`. The
full pass order and buffer layouts are in [the architecture](ARCHITECTURE.md);
what keeps a dozen of those passes inside a 60 Hz budget is in
[the optimizations](OPTIMIZATIONS.md).

## What does it need to run?

The signal path runs in WebGPU compute shaders with no fallback renderer, so a
browser without WebGPU gets the "this browser cannot run it" screen.

- **Desktop** — Chrome, Edge, or Firefox with WebGPU enabled, on any OS with
  working hardware acceleration.
- **Android** — Chrome 121 and up on Android 12 and up, where WebGPU is on by
  default. It first shipped for Qualcomm and ARM GPUs and has widened since.
- **iPhone and iPad** — iOS/iPadOS 18.2 and up, where Safari shipped WebGPU on
  by default. A home-screen install runs on the same WebKit engine, so it gets
  WebGPU on exactly the versions Safari does.

A phone GPU has much less headroom. The most expensive effects (feedback, the
wide comb) run, at a lower resolution and frame rate than a laptop holds.

## Can I install it on a phone or a desktop?

Yes. A manifest, an icon set and a service worker ship with the build, so the
browser can put it on a home screen or dock and open it in its own window with
no chrome around the picture. An installed copy starts offline, since the shell
and bundle are cached; the sample clips and anything saved to the cloud still
need a network.

- **Android / Chrome** — the address bar offers _Install app_, or use _Add to
  Home screen_ from the ⋮ menu.
- **iPhone / iPad / Safari** — Share → _Add to Home Screen_. Safari is the only
  browser on iOS that can do this, and the installed copy keeps its own storage,
  so saved profiles and clips stay behind in the Safari tab.
- **Desktop Chrome or Edge** — use the install icon at the right of the address
  bar, or _Install videoskillet.js_ from the menu.

Firefox on Android and Safari on macOS offer no install of this kind. The app
runs in a tab there and loses nothing but the window.

The install starts the app at `/app/`. The landing page and labelling tools are
inside its scope, so a link to one opens in the same window rather than a
browser tab.

## Will it be in an app store?

Not yet, but maybe! The home-screen install above already gets a phone the same
app, icon and full-screen window a store listing would, so it is the fastest way
to have it on a phone today. If a store build happens, Google Play is the likely
first stop, since a wrapped web app there renders through the same Chrome the
browser uses.

## Will there be a plugin for After Effects, Premiere or Resolve?

Not yet, and it is a bigger job than moving the shaders across. The reasons are
worth knowing, because they shape what a plugin could look like:

- **The shaders are about a third of the simulator.** The rest is per-frame CPU
  state in `src/core/signal/` (line, mix, tape, RF, synth, audio, a filter bank
  rebuilt on every filter change) and the pass graph, uniform packing and
  stateful buffers in `src/core/gpu/`. A port has to carry all of it.
- **No plugin API renders through WebGPU today.** OFX and Adobe's SDK render
  through CUDA, OpenCL or Metal. wgpu can compile the WGSL for a native build,
  but inside a CUDA or Metal host every frame would still cross to that island
  and back.
- **Feedback makes each frame depend on every frame before it.** Phosphor
  persistence, the mixer loop's frame store, PLL lock age, AGC and two servos
  all carry state forward, while a host expects to scrub, play from the middle,
  and preview before the clip has been rendered from the top. A plugin would
  either render sequentially or give up the loops [Where it sits](COMPARISON.md)
  names as this project's distinguishing feature.

A sequential-render OFX effect on a native wgpu build is the shape that could
work, and it stays on the list. In the meantime
[ntsc-rs](https://github.com/ntsc-rs/ntsc-rs) covers much of the need: same
premise, multithreaded Rust on the CPU, not locked to the NTSC raster, with
After Effects, Premiere and OpenFX builds. For this look on a clip inside an
edit, it is the better fit today, and the section below is how a take from here
gets in.

## Then how do I get a result into an edit?

Render a file. Open the **strip** tray at the bottom and press **⎙ render**. The
take plays on a virtual clock instead of wall time, and you get a
constant-framerate H.264 MP4 that Resolve and Premiere import directly. It is
not WebM, which Resolve will not import at all.

You can render a performance too. **●** records every move against the frame it
happened on (sliders, presets, a controller knob, a morph) and **⎙** replays it
into the render, so a take you ran live at whatever framerate the tab managed
comes back at a steady one.

Running the project locally gives a third way, and it is the one to use when the
colour matters. `pnpm render` takes a link and a file and writes ProRes 4444, so
the chroma artifacts survive; a browser encodes 4:2:0 and throws most of them
away. [Rendering](RENDERING.md) covers it.

## Can I feed it a real composite signal off a yellow RCA cable?

Through a USB capture dongle, yes. Directly off the cable, no. The cable carries
a baseband composite waveform at about 1 Vpp, something has to sample that
voltage, and nothing in a browser can. The dongle is that something: plug the
cable into an RCA/composite grabber and the OS presents it as a camera. Pick
**Webcam / USB device** on a source deck, choose the grabber, and it lands in a
slot like any other source, with the whole signal, sync and deflection chain
over it. Each deck takes its own device, so a camera in A and a grabber in B is
a rig the app expects.

The app never sees composite, and that costs something. The grabber demodulates
in hardware and hands over decoded 720×480 frames, so what a consumer dongle
does (luma cut to around 2.4 MHz, colour-under chroma, chroma a few samples
late) has already happened and cannot be undone. The `capture card` preset
models that decode, so a captured feed carries one pass of it for real and
whatever you dial in on top. That suits glitch work, and it is not a clean
analog capture.

Interlacing comes with a grabber. A dongle delivers 480/60i, so the app turns
bob deinterlace on per deck when a device connects — a progressive camera in one
and an interlaced dongle in the other want opposite answers. PAL grabbers
(720×576/50i) are not handled yet; the pipeline is NTSC-shaped at 525/60.

Raw composite samples, the waveform before any decoder touches it, need an SDR
or a fast ADC and a native program to read them. That is a different instrument,
and a web page cannot be one.

## Can I patch it into Max/MSP, Jitter, TouchDesigner or VJ software?

Most of this already works, with no code on either side:

- **Control in** — MIDI CC and MIDI clock over a virtual port (IAC bus,
  loopMIDI). Every slider can learn a CC; see
  [Using a MIDI controller](MIDI.md).
- **Audio in** — pick **System audio** under **♪** and share the tab or app your
  patch plays out of. It feeds the audio-driven bend, load and level controls,
  so your patch's output bends the signal directly. A loopback device
  (BlackHole, or your OS's equivalent) picked as the microphone does the same,
  and is the fallback on browsers that can't share tab audio.
- **Video in** — a Jitter or TouchDesigner render can come in as a webcam source
  through a Syphon → virtual-camera bridge.
- **Video out** — point an OBS browser source at the page.

Not yet built: **OSC**. OSC is how Max/MSP, TouchDesigner and most VJ software
address control values by name rather than by CC number. Browsers cannot speak
UDP, so it needs a small local bridge in the middle. It is a good fit, because
every control here is already a flat named record behind one write path: a patch
could address `/hHold`, `/scDetuneKHz` or `/bendUs` by name, with float
precision and no 128-control ceiling, and the same channel could run in reverse
to keep the patch's UI in sync. NDI or WebRTC output as an alternative to OBS is
on the same list.

Running the app inside a patch, through Max's `jweb` for instance, depends on
that web view getting WebGPU. Until then, route into the app from the patch.

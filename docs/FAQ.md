# FAQ

How it works, what it takes to run, why it is an app rather than a plugin, and
how a take gets into an edit. [Choosing a tool](COMPARISON.md) and
[the editor](EDITOR.md) carry the long arguments; this page is the short version
of each, plus what to do instead.

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

478k iterations, a dozen stages, 60 times a second is hopeless on one thread. A
GPU runs that body for every `n` at once, so you write only the body and it
supplies the `n`. That is `timebase.wgsl`, trimmed:

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

Thousands of copies run at once in no particular order, which is safe because
each writes only its own `dst[n]`. Launching it means giving the bounds of that
loop, which come back as `gid`:

```ts
cp.dispatchWorkgroups(Math.ceil(910 / 64), 525)
```

Threads launch in fixed blocks of 64, so 15 blocks per line covers 910 samples
with 50 to spare, hence the `if (s >= SPL) { return; }` in every shader.

### The chain

A dozen passes like that in a row: encode the picture into the waveform, damage
it, decode it back. Each reads the array and writes it back. The shaders stay
compiled and resident, so moving a slider writes a number the next frame reads
and nothing recompiles.

Pass list in `src/core/gpu/pipeline.ts`, shaders in `src/core/gpu/shaders/`. The
full pass order and buffer layouts are in [the architecture](ARCHITECTURE.md);
what keeps a dozen of those passes inside a 60 Hz budget is in
[the optimizations](OPTIMIZATIONS.md).

## What does it need to run?

The whole signal path runs in WebGPU compute shaders and there is no fallback
renderer, so a browser without WebGPU gets the "this browser cannot run it"
screen.

- **Desktop** — Chrome, Edge, or Firefox with WebGPU enabled, on any OS with
  working hardware acceleration.
- **Android** — Chrome 121 and up, on Android 12 and up, with a Qualcomm or ARM
  GPU. That's where WebGPU turned on by default, and support has been widening
  since.
- **iPhone and iPad** — iOS/iPadOS 18.2 and up, where Safari shipped WebGPU on
  by default. A home-screen install runs on the same WebKit engine as Safari, so
  it gets WebGPU on exactly the versions Safari does.

A phone GPU is still a phone GPU: the most expensive effects (feedback, the wide
comb) run fine, but you won't get the resolution or frame rate a laptop holds.

## Can I install it on a phone or a desktop?

Yes. A manifest, an icon set and a service worker ship with the build, so the
browser can put it on a home screen or dock and open it in its own window with
no browser chrome around the picture. An installed copy starts offline, since
the shell and bundle are cached; the sample clips and anything saved to the
cloud still need a network.

- **Android / Chrome** — the address bar offers _Install app_, or use _Add to
  Home screen_ from the ⋮ menu.
- **iPhone / iPad / Safari** — Share → _Add to Home Screen_. Safari is the only
  browser on iOS that can do this, and the installed copy keeps its own storage,
  so saved profiles and clips don't carry over from the Safari tab.
- **Desktop Chrome or Edge** — use the install icon at the right of the address
  bar, or _Install videoskillet.js_ from the menu.

Firefox on Android and Safari on macOS offer no install of this kind; the app
runs in a tab there and loses nothing but the window.

The install starts the app at `/app/`. The landing page and labelling tools are
inside its scope, so a link to one of them opens in the same window instead of
sending the reader out to a browser tab.

## Will it be in an app store?

Nothing here is packaged for a store today, and the two stores are different
propositions.

**Google Play** looks reachable. A Trusted Web Activity wraps the installed PWA
in an APK that renders through the user's own Chrome, so WebGPU behaves exactly
as it does in the browser. `bubblewrap init` (or PWABuilder) against
`https://videoskillet.com/manifest.webmanifest` generates the project. Beyond
this repo it would need a Play Developer account, an upload key, and a
`.well-known/assetlinks.json` served from the site carrying that key's SHA-256
fingerprint, which is what stops the wrapper opening with an address bar. That
file belongs in `public/.well-known/` so the build copies it to the deploy root.

**The App Store** looks harder, for two reasons outside this repo. WebGPU is not
on by default in WKWebView, so a Capacitor or hand-rolled wrapper would be a bet
on a webview flag rather than on the engine Safari ships. And App Review's
minimum-functionality rule targets apps that are a website in a frame, which
this could look like. A home-screen install off Safari already gets an iPhone
user the same app, the same icon and the same full-screen window.

## Why isn't this a plugin for After Effects, Premiere or Resolve?

Investigated and declined, at least for now; the details are in
[the editor](EDITOR.md#what-this-is-not-an-nle-plugin). Three reasons:

- **The shaders aren't the whole simulator.** WGSL is only about a third of it.
  The rest is per-frame CPU state in `src/core/signal/` (line, mix, tape, RF,
  synth, audio, a FIR bank rebuilt on every filter change) and the pass graph,
  uniform packing, and stateful buffers in `src/core/gpu/`. Porting the shaders
  alone wouldn't port anything that actually runs.
- **No plugin API supports WebGPU.** OFX and Adobe's SDK both do GPU rendering
  through CUDA, OpenCL, or Metal. wgpu/naga can compile the WGSL for a native
  port, which is useful, but inside a CUDA/Metal host you'd still be paying a
  full-frame upload and readback every frame in both directions.
- **The host's frame model doesn't fit the feedback loops.** The tape ring,
  phosphor persistence, PLL lock age, AGC and two servos all make each frame
  depend on every frame before it, while a timeline host expects scrubbing,
  playing from the middle, and a preview that means something before the clip
  has been rendered from the top. The loops [Choosing a tool](COMPARISON.md)
  names as what distinguishes this project are exactly what a plugin breaks.

[ntsc-rs](https://github.com/ntsc-rs/ntsc-rs) already covers a lot of this need:
same premise, multithreaded SIMD Rust on the CPU, not locked to the NTSC raster,
with After Effects, Premiere, and OpenFX builds. If you want this look on a clip
inside an edit, it's probably the better fit today.

## Then how do I get a result into an edit?

Render a file. Open the **strip** tray at the bottom and press **⎙ render**. The
take plays on a virtual clock instead of wall time, and you get a
constant-framerate H.264 MP4 that Resolve and Premiere import directly — no
plugin, and no WebM, which Resolve will not import at all.

You can also render a performance. **●** records every move you make against the
frame it happened on (sliders, presets, a controller knob, a morph) and **⎙**
replays that into the render, so a take you ran live at whatever framerate the
tab managed comes back at a steady one.

## Can I feed it a real composite signal off a yellow RCA cable?

Through a USB capture dongle, yes. Directly off the cable, no — a yellow RCA
cable carries a baseband composite waveform at about 1 Vpp, something has to
sample that voltage, and nothing in a browser can. The dongle is that something:
plug the cable into an RCA/composite grabber and the OS presents it as a camera.
Pick **Webcam / USB device** on a source deck, choose the grabber from the
device list, and it lands in a slot like any other source, with the whole
signal, sync and deflection chain over it. Two decks each take their own device,
so a camera in A and a grabber in B is a rig the app expects.

The app never sees composite, and it is worth knowing what that costs. The
grabber demodulates in hardware and hands over decoded 720×480 frames, so the
damage a consumer dongle does — luma cut to around 2.4 MHz, colour-under chroma,
chroma a few samples late — has already happened upstream and cannot be undone.
The `capture card` preset models exactly that decode, so a captured feed carries
one pass of it for real and then whatever you dial in on top. That stacks fine
for glitch work; it is not a clean analog capture.

Interlacing comes with the territory. A grabber delivers 480/60i, so the app
turns bob deinterlace on per deck when a device connects — a progressive camera
in one and an interlaced dongle in the other want opposite answers. PAL grabbers
(720×576/50i) are not handled yet; the pipeline is NTSC-shaped at 525/60.

Raw composite samples — the unsliced waveform, before any decoder touches it —
need an SDR or a fast ADC and a native program to read it. That is a different
instrument, and one a web page cannot be.

## Can I patch it into Max/MSP, Jitter, TouchDesigner or VJ software?

Most of this already works, with no code on either side:

- **Control in** — MIDI CC and MIDI clock over a virtual port (IAC bus,
  loopMIDI). Every slider can learn a CC; see
  [Using a MIDI controller](MIDI.md).
- **Audio in** — pick **System audio** under **♪** and share the tab or app your
  patch plays out of. This feeds the audio-driven bend, load, and level
  controls, so your patch's output bends the signal directly. A loopback device
  (BlackHole, or your OS's equivalent) picked as the microphone works the same
  way, and is the fallback on browsers that can't share tab audio.
- **Video in** — a Jitter or TouchDesigner render can come in as a webcam source
  through a Syphon → virtual-camera bridge.
- **Video out** — point an OBS browser source at the page.

Not yet built: **OSC over a small local WebSocket bridge**. OSC is how Max/MSP,
TouchDesigner and most VJ software address control values by name rather than by
CC number, and browsers cannot speak its usual transport, UDP, so bridging it in
needs a small node process in the middle. Worth building because every control
here is already a flat named record behind one write path: a patch could address
`/hHold`, `/scDetuneKHz` or `/bendUs` by name, with float precision and no
128-control CC ceiling, and the same channel could run in reverse to keep the
patch's UI in sync. See _Patching into other apps_ in [the backlog](IDEAS.md)
for both directions, plus NDI or WebRTC output as an alternative to OBS.

Hosting the app inside a patch is not being pursued. Max's `jweb` embeds a web
view but is unlikely to support WebGPU, and this app is meant to be routed into.

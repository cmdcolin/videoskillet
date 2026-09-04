# FAQ

How the thing works, what it takes to run, why it is an app rather than a
plugin, and how a take gets out of it and into an edit.
[Choosing a tool](COMPARISON.md) and [the editor](EDITOR.md) carry the longer
arguments; this page is the short version of each, plus what to do instead.

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

478k iterations, a dozen stages, 60 times a second — hopeless on one thread. A
GPU runs that body for every `n` at once, so you write only the body and it
hands you the `n`. That is `timebase.wgsl`, trimmed:

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
each writes only its own `dst[n]`.

Launching it is the bounds of that loop, which come back as `gid`:

```ts
cp.dispatchWorkgroups(Math.ceil(910 / 64), 525)
```

Threads launch in fixed blocks of 64, so 15 blocks per line covers 910 samples
with 50 to spare — hence the `if (s >= SPL) { return; }` in every shader.

### The chain

A dozen passes like that in a row: encode the picture into the waveform, damage
it, decode it back. Each reads the array and writes it back.

Because the shaders stay compiled and resident, moving a slider just writes a
number the next frame reads. Nothing recompiles.

Pass list in `src/core/gpu/pipeline.ts`, shaders in `src/core/gpu/shaders/`. The
full pass order and buffer layouts are in [the architecture](ARCHITECTURE.md);
what keeps a dozen of those passes inside a 60 Hz budget is in
[the optimizations](OPTIMIZATIONS.md).

## What does it need to run?

The whole signal path runs in WebGPU compute shaders, and there's no fallback
renderer, so a browser without WebGPU just gets you the "this browser cannot run
it" screen.

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

Yes — a manifest, an icon set, and a service worker ship with the build, so the
browser can put it on a home screen or dock and open it in its own window, with
no browser chrome around the picture. Once installed, it starts offline — the
shell and bundle are cached — though the sample clips and anything saved to the
cloud still need a network connection.

- **Android / Chrome** — the address bar offers _Install app_, or use _Add to
  Home screen_ from the ⋮ menu.
- **iPhone / iPad / Safari** — Share → _Add to Home Screen_. Safari is the only
  browser on iOS that can do this, and the installed copy keeps its own storage,
  so saved profiles and clips don't carry over from the Safari tab.
- **Desktop Chrome or Edge** — use the install icon at the right of the address
  bar, or _Install videoskillet.js_ from the menu.

Firefox on Android and Safari on macOS don't offer this kind of install; the app
just runs in a tab there, losing nothing but the window.

The install starts the app at `/app/`, the instrument. The landing page and
labelling tools are inside its scope, so a link to one of them opens in the same
window instead of sending the reader out to a browser tab.

## Will it be in an app store?

Nothing here is packaged for a store today, and the two stores are pretty
different propositions.

**Google Play** looks reachable. A Trusted Web Activity wraps the installed PWA
in an APK that renders through the user's own Chrome — the same engine, so
WebGPU behaves exactly as it does in the browser. `bubblewrap init` (or
PWABuilder) against `https://videoskillet.com/manifest.webmanifest` generates
the project. Beyond this repo, it would need a Play Developer account, an upload
key, and a `.well-known/assetlinks.json` served from the site carrying that
key's SHA-256 fingerprint (that's what stops the wrapper from opening with an
address bar). The file belongs in `public/.well-known/` so the build copies it
to the deploy root.

**The App Store** looks harder, for two reasons outside this repo. WKWebView
isn't Safari — WebGPU isn't on by default there, so a Capacitor or hand-rolled
wrapper would be a bet on a webview flag rather than on the engine Safari ships.
And App Review's minimum-functionality rule targets apps that are just a website
in a frame, which this could look like. A home-screen install off Safari already
gets an iPhone user the same app, same icon, and same full-screen window,
without any of that risk.

## Why isn't this a plugin for After Effects, Premiere or Resolve?

We looked into it and decided against it, at least for now. Full details are in
[the editor](EDITOR.md#what-this-is-not-an-nle-plugin). The reasons:

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
  phosphor persistence, PLL lock age, AGC, and two servos all make each frame
  depend on every frame before it. A timeline host expects scrubbing and playing
  from the middle to work, and a preview to mean something before it's rendered
  from the top — which doesn't fit the loops this app relies on.
  [Choosing a tool](COMPARISON.md) covers why these loops matter, and they're
  exactly what a plugin breaks.

[ntsc-rs](https://github.com/ntsc-rs/ntsc-rs) already covers a lot of this need:
same premise, multithreaded SIMD Rust on the CPU, not locked to the NTSC raster,
with After Effects, Premiere, and OpenFX builds. If you want this look on a clip
inside an edit, it's probably the better fit today.

## Then how do I get a result into an edit?

Render a file — the app does this today. Open the **strip** tray at the bottom
and press **⎙ render**. The take plays on a virtual clock instead of wall time,
and you get a constant-framerate H.264 MP4 that Resolve and Premiere import
directly — no plugin needed, and no WebM (which Resolve won't import at all).

You can also render a performance. **●** records every move you make against the
frame it happened on — sliders, presets, a controller knob, a morph — and **⎙**
replays that into the render. So a take you ran live, at whatever framerate the
tab managed, comes back as a file with a steady, non-drifting framerate.

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

Not yet built: **OSC over a small local WebSocket bridge**. OSC (Open Sound
Control) is the network protocol Max/MSP, TouchDesigner, and most VJ and audio
software use to send control messages between apps — the modern successor to
MIDI for this kind of thing, addressing values by name instead of by CC number.
Browsers can't speak OSC's usual transport, UDP, directly, so bridging it in
needs a small node process in the middle. It's worth building because every
control is already a flat named record behind one write path — a patch could
address `/hHold`, `/scDetuneKHz`, or `/bendUs` by name, with float precision and
no 128-control CC ceiling. The same channel could run in reverse, keeping a
patch's UI in sync with the app. See _Patching into other apps_ in
[the backlog](IDEAS.md) for both directions, plus NDI or WebRTC output as an
alternative to OBS.

Hosting the app inside a patch isn't something we're pursuing right now. Max's
`jweb` embeds a web view but is unlikely to support WebGPU, and the app is
currently meant to be routed into, not embedded.

# Install it on a phone or desktop

videoskillet.js is a web app, and it is also an installable one: a manifest, an
icon set and a service worker ship with the build, so the browser will put it on
a home screen or a dock and open it in its own window with no browser chrome
around the picture. Installed, it starts offline — the shell and the bundle are
cached — though the sample clips and anything saved to the cloud still want a
network.

The install starts the app at `/app/`, the instrument. The landing page and the
labelling tools are inside its scope, so a link to one of them opens in the same
window rather than kicking the reader out to a browser tab.

## What the hardware has to have

The whole signal path runs in WebGPU compute shaders and there is no fallback
renderer, so an install on a device without WebGPU is an install of the "this
browser cannot run it" screen.

- **Android** — Chrome 121 and up, on Android 12 and up with a Qualcomm or ARM
  GPU. That is where WebGPU turned on by default, and it has been widening
  since.
- **iPhone and iPad** — iOS/iPadOS 18.2 and up, where Safari shipped WebGPU on
  by default. A home-screen install runs on the same WebKit as Safari, so it
  gets WebGPU on exactly the versions Safari does.
- **Desktop** — Chrome, Edge, or Firefox with WebGPU enabled, on any OS with
  working hardware acceleration.

A phone GPU is a phone GPU: the effects that cost the most (feedback, the wide
comb) run, but the resolution and frame rate a laptop holds are not what a
handset will.

## Installing

- **Android / Chrome** — the address bar offers _Install app_, or _Add to Home
  screen_ from the ⋮ menu.
- **iPhone / iPad / Safari** — Share → _Add to Home Screen_. Safari is the only
  browser on iOS that can do this, and the installed copy keeps its own storage,
  so saved profiles and clips do not carry over from the Safari tab.
- **Desktop Chrome or Edge** — the install icon at the right of the address bar,
  or _Install videoskillet.js_ from the menu.

Firefox on Android and Safari on macOS have no install of this kind; the app
runs in a tab there and loses nothing but the window.

## Shipping it to a store

Nothing here is packaged for a store today, and the two stores are not the same
proposition.

**Google Play** is reachable. A Trusted Web Activity wraps the installed PWA in
an APK that renders through the user's own Chrome — the same engine, so WebGPU
behaves exactly as it does in the browser. `bubblewrap init` (or PWABuilder)
against `https://videoskillet.com/manifest.webmanifest` generates the project;
what it needs beyond this repo is a Play Developer account, an upload key, and a
`.well-known/assetlinks.json` served from the site carrying that key's SHA-256
fingerprint, which is what stops the wrapper opening with an address bar. The
file belongs in `public/.well-known/` so the build copies it to the deploy root.

**The App Store** is the harder one, for two reasons that are both outside this
repo. WKWebView is not Safari: WebGPU is not on by default there, so a Capacitor
or hand-rolled wrapper is a bet on a webview flag rather than on the engine
Safari ships. And App Review's minimum-functionality rule is aimed squarely at
apps that are a website in a frame. A home-screen install off Safari gets an
iPhone user the same app, the same icon and the same full-screen window, with
none of that in the way.

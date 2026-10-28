// Where this box keeps the browsers the harnesses drive.
//
// Every harness here used to spell `/usr/bin/firefox-nightly` itself, which is
// the path on the Linux dev box and nowhere else — so on macOS the whole fleet
// failed at launch, and measuring anything meant patching a copy of the script
// first. `cpuprof.mjs` already resolved Chrome per platform; this is that idiom
// for both browsers, in one place.
//
// FIREFOX= and CHROME= override, for a build installed somewhere else or for
// pinning a specific one while bisecting a browser regression.

import puppeteer from 'puppeteer-core'

import { existsSync } from 'node:fs'
import { env, platform } from 'node:process'

const found = (paths, override) =>
  override ?? paths.find(p => existsSync(p)) ?? paths[0]

// Nightly first on both: WebGPU is where this app lives, and on Linux Nightly
// is the only Firefox that has it (CLAUDE.md § Testing WebGPU).
export const FIREFOX = found(
  platform === 'darwin'
    ? [
        '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
        '/Applications/Firefox.app/Contents/MacOS/firefox',
      ]
    : ['/usr/bin/firefox-nightly', '/usr/bin/firefox'],
  env.FIREFOX,
)

export const CHROME = found(
  platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
      ],
  env.CHROME,
)

// Firefox with WebGPU on, which every harness here needs. `media` lets a page
// open a fake camera and microphone without asking, `autoplay` lets a video
// play with sound, `prefs` adds or overrides any other pref, and the rest goes
// to `puppeteer.launch` as is.
export const launchFirefox = ({
  media = false,
  autoplay = false,
  headless = false,
  prefs = {},
  ...options
} = {}) =>
  puppeteer.launch({
    browser: 'firefox',
    executablePath: FIREFOX,
    headless,
    ...options,
    extraPrefsFirefox: {
      'dom.webgpu.enabled': true,
      'gfx.webgpu.ignore-blocklist': true,
      ...(media && {
        'media.navigator.permission.disabled': true,
        'media.navigator.streams.fake': true,
      }),
      ...(autoplay && {
        'media.autoplay.default': 0,
        'media.autoplay.blocking_policy': 0,
      }),
      ...prefs,
    },
  })

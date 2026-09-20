import { experimental_AstroContainer } from 'astro/container'
import { beforeAll, expect, test } from 'vitest'

import {
  FREE_WITHOUT,
  PITCH,
  SHOT,
  SHOT_ALT,
  SHOT_CAPTION,
  SHOT_H,
  SHOT_W,
} from '../../src/ui/whySignIn'
import Landing from '../pages/index.astro'
import Privacy from '../pages/privacy.astro'

import { existsSync, readFileSync } from 'node:fs'

const file = `public/${SHOT}`

// The landing page answers "why sign in?" out of the same strings the app's own
// card renders, and it answers in the HTML rather than from script: a reader
// with JavaScript off still gets it, and the two cards cannot drift apart.

const privacyHref = 'href="/privacy/"'

// CROSS_REPO_SYNC(landing-page-test)
let landing = ''
let privacy = ''

beforeAll(async () => {
  const container = await experimental_AstroContainer.create()
  landing = await container.renderToString(Landing)
  privacy = await container.renderToString(Privacy)
})

test('the card carries the answer, in the page', () => {
  expect(landing).toContain(PITCH)
  expect(landing).toContain(FREE_WITHOUT)
})

test('the question is asked where the ask is, and the card can be opened', () => {
  expect(landing.match(/Why sign in\?/g)?.length).toBe(2)
  expect(landing).toContain('id="whyCard"')
  expect(landing).toContain('id="whySignIn"')
})

test('the card sends anyone who wants the rest to the privacy page', () => {
  expect(landing).toContain(privacyHref)
  expect(privacy).toContain('Google Analytics')
  expect(privacy).toContain('Firebase')
})

test('the privacy page leaves out the account controls it cannot work', () => {
  // SiteBar's sign-in half needs site/scripts/home.ts, which this page does not
  // load, and a button that answers nothing is worse than no button.
  expect(privacy).not.toContain('id="signIn"')
  expect(privacy).toContain('Open the app')
})

test('no page loads Google Analytics before the visitor says yes', () => {
  for (const page of [landing, privacy])
    expect(page).not.toContain('googletagmanager.com')
})
// CROSS_REPO_SYNC_END(landing-page-test)

// Outside the region: each app's card shows a picture of its own home.
test('the card shows the home an account gets', () => {
  expect(landing).toContain(SHOT_ALT)
  expect(landing).toContain(SHOT_CAPTION)
  expect(landing).toContain(`src="/${SHOT}"`)
  expect(existsSync(file)).toBe(true)
})

// A lossy webp says its size in the four bytes after the sync code: two 14-bit
// fields, little-endian. Read here rather than shelled out to ImageMagick,
// which `pnpm test` has no business needing.
const webpSize = () => {
  const bytes = readFileSync(file)
  return {
    width: bytes.readUInt16LE(26) & 0x3fff,
    height: bytes.readUInt16LE(28) & 0x3fff,
  }
}

test('both cards reserve the shape the picture actually has', () => {
  expect(webpSize()).toEqual({ width: SHOT_W, height: SHOT_H })
  expect(landing).toContain(`width="${SHOT_W}"`)
  expect(landing).toContain(`height="${SHOT_H}"`)
})

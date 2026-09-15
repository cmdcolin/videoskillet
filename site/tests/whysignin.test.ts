import { experimental_AstroContainer } from 'astro/container'
import { beforeAll, expect, test } from 'vitest'

import { GA_ID } from '../../src/analytics'
import { FREE_WITHOUT, PITCH } from '../../src/ui/whySignIn'
import Landing from '../pages/index.astro'
import Privacy from '../pages/privacy.astro'

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
  expect(landing.match(/Why sign in\?/g)?.length).toBe(3)
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

test('every page the site serves counts its visit', () => {
  for (const page of [landing, privacy])
    expect(page).toContain(`gtag/js?id=${GA_ID}`)
})
// CROSS_REPO_SYNC_END(landing-page-test)

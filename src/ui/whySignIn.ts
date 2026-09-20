// The prose behind both of the site's "why sign in?" cards, the app's and the
// landing page's. WhySignInDialog.tsx renders these strings in the browser, and
// site/pages/index.astro renders them into the landing page at build time, so a
// reader with no JavaScript still gets the answer. Keep the file free of React
// and of the DOM so both callers can use it.
//
// Two sentences and a picture of the home an account gets, and the card is
// over. Anyone who wants the long answer is already looking at the privacy
// page's link.

/** The answer. */
export const PITCH =
  'Autosaves the stuff you were doing, and you can keep track of it across multiple computers.'

/**
 * What the picture of the signed-in home shows, for a reader who cannot see
 * it. `scripts/homeshot.mjs` draws the picture itself into
 * `public/home-signed-in.webp`.
 */
export const SHOT_ALT =
  'The signed-in home: a card that resumes the last session, and a grid of saved looks with a still of each one.'

/**
 * The shape of that picture, which both cards give their <img> so the rows
 * under it hold still while it loads. `whysignin.test.ts` reads the file's own
 * header back against this, since a re-shot home changes it.
 */
export const SHOT_SIZE = { width: 1280, height: 941 }

/** What it costs, which is nothing. */
export const FREE_WITHOUT =
  'You don’t have to sign in — it just lets you save your work and pick it up on another machine.'

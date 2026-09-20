// The prose behind both of the site's "why sign in?" cards, the app's and the
// landing page's. WhySignInDialog.tsx renders these strings in the browser, and
// site/components/WhySignInCard.astro renders them into the landing page at
// build time, so a reader with no JavaScript still gets the answer. Keep the
// file free of React and of the DOM so both callers can use it.
//
// Two sentences and a picture of the home an account gets, and the card is
// over. Anyone who wants the long answer is already looking at the privacy
// page's link. bender's card is built the same way, from its own copy of this
// file and a picture of its own home.

/** The answer. */
export const PITCH =
  'Autosaves the stuff you were doing, and you can keep track of it across multiple computers.'

/** The screenshot in both cards: the home with a session and some looks on it.
    `scripts/homeshot.mjs` draws it. Its size is written into both <img> tags so
    the card does not reflow around it, and `whysignin.test.ts` reads the file's
    own header back against these, since a re-shot home changes them. */
export const SHOT = 'home-signed-in.webp'
export const SHOT_W = 1280
export const SHOT_H = 941

export const SHOT_ALT =
  'The home signed in: a card that resumes the last session, and a grid of saved looks with a still of each one'

export const SHOT_CAPTION = 'Your home, once you’re signed in.'

/** What it costs, which is nothing. */
export const FREE_WITHOUT =
  'You don’t have to sign in — it just lets you save your work and pick it up on another machine.'

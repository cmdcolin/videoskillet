// The prose behind both of the site's "why sign in?" cards, the app's and the
// landing page's. WhySignInDialog.tsx renders these strings in the browser, and
// site/pages/index.astro renders them into the landing page at build time, so a
// reader with no JavaScript still gets the answer. Keep the file free of React
// and of the DOM so both callers can use it.
//
// Two sentences, and the card is over. Anyone who wants the long answer is
// already looking at the privacy page's link.

/** The answer. */
export const PITCH =
  'Autosaves the stuff you were doing, and you can keep track of it across multiple computers.'

/** What it costs, which is nothing. */
export const FREE_WITHOUT =
  'You don’t have to sign in — it just lets you save your work and pick it up on another machine.'

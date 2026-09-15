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
  'Sign in and you can save the look you are building under a name, then come back to it later — on this machine or any other.'

/** What it costs, which is nothing. */
export const FREE_WITHOUT =
  'Nothing else here needs an account: every source, every control, recording, MIDI and every shared link work signed out.'

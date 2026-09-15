// The prose behind both of the site's "why sign in?" cards, the app's and the
// landing page's. WhySignInDialog.tsx renders these strings in the browser, and
// site/pages/index.astro renders them into the landing page at build time, so a
// reader with no JavaScript still gets the answer. Keep the file free of React
// and of the DOM so both callers can use it.

/** One thing an account buys, as a heading and the sentence under it. */
export interface Reason {
  head: string
  says: string
}

export const REASONS: Reason[] = [
  {
    head: 'Keep a look under a name',
    says: 'A saved look holds every control you moved, with a still of what it made. Press its name to bring the whole board back.',
  },
  {
    head: 'Find it on your other machine',
    says: 'The library lives on your Google account, so a look named on the desktop is there on the laptop, and clearing site data leaves it alone.',
  },
  {
    head: 'Pick up where you left off',
    says: 'The app mirrors the session you have open onto your account, and the home page offers it back under Continue where you left off.',
  },
  {
    head: 'Rate and tag looks',
    says: 'Ratings are filed under your account, which is what keeps one person from voting on the same look twice.',
  },
]

/** What works with no account, which is everything else. */
export const FREE_WITHOUT =
  'Nothing else here needs an account: every source, every control, recording, MIDI, the presets and every shared link all work signed out.'

/** What the account document holds. */
export const WHAT_IT_HOLDS =
  'An account holds the looks you save — the controls, and a small still of the output beside each one — plus the name and picture Google gives us.'

/** How to keep a look without an account. */
export const LINKS_INSTEAD =
  'Every look is already a link, so copying one and bookmarking it keeps that look. An account adds the library: every look you keep, under a name, on every machine you sign in on.'

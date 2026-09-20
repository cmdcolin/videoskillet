// Where the site is served from, for the canonical link every page carries.
export const ORIGIN = 'https://videoskillet.com/'

// What the shared site components say about this product: its name, where its
// pages are, and the links the bar and the footer carry.
export const SITE = {
  name: 'videoskillet',
  home: '/',
  icon: '/favicon.svg',
  app: '/app/',
  nav: [
    ['/#gallery', 'Gallery'],
    ['/guide/', 'User guide'],
  ],
  footer: [
    ['/app/', 'Open the app ↗'],
    ['/guide/', 'Guide'],
    ['https://github.com/cmdcolin/videoskillet', 'GitHub ↗'],
    ['/privacy/', 'Privacy'],
    ['https://cmdcolin.github.io/bender/', "videoskillet's sibling: bender ↗"],
  ],
} as const

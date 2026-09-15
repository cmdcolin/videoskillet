// What the shared site components say about this product: its name, where its
// pages are, and the links the bar and the footer carry.
export const SITE = {
  name: 'videoskillet.js',
  home: '/',
  icon: '/favicon.svg',
  app: '/app/',
  nav: [
    ['/#gallery', 'Gallery'],
    ['/guide/', 'User guide'],
    ['https://github.com/cmdcolin/videoskillet', 'Source'],
  ],
  footer: [
    ['/app/', 'Open the app ↗'],
    ['/guide/', 'Guide'],
    ['https://github.com/cmdcolin/videoskillet', 'GitHub ↗'],
    ['/privacy/', 'Privacy'],
  ],
} as const

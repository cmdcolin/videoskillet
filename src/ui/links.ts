// Where the app points people when it sends them out of itself.
//
// The published site rather than a relative path: the guide is rendered into
// `dist/guide/` by scripts/build-guide.mjs at build time, so `./guide/` is a
// 404 under `pnpm dev` — which is where these links get clicked while anyone is
// working on them.
const SITE = 'https://cmdcolin.github.io/videoskillet/'

export const GUIDE_URL = `${SITE}guide/`
export const REPO_URL = 'https://github.com/cmdcolin/videoskillet.js'

export const openGuide = () => {
  window.open(GUIDE_URL, '_blank', 'noopener,noreferrer')
}

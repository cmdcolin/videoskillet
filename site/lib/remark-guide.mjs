import { visit } from 'unist-util-visit'

import { LINKS } from './pages.mjs'

import { posix, relative } from 'node:path'

const REPO = 'https://github.com/cmdcolin/videoskillet/blob/main/'
// A directory has no blob to point at, and the two the docs link to are the two
// that have an index page here anyway.
const REPO_DIR = 'https://github.com/cmdcolin/videoskillet/tree/main/'
const IMG = 'docs/img/'

// Every relative href is resolved from the source file's own directory first, so
// `EDITOR.md` in docs/FAQ.md and `../EDITOR.md` in an ADR arrive at the same key
// — and so `../scripts/x.mjs`, which has no page here, lands in the repo. The
// figures are copied flat beside the pages, so a path into docs/img becomes
// `img/…` whichever directory asked for it.
const rewriteLink = (href, dir) => {
  const [path, hash] = href.split('#')
  const anchor = hash === undefined ? '' : `#${hash}`
  const target = posix.normalize(posix.join(dir, path))
  const isDir = target.endsWith('/')
  const file = isDir ? target.slice(0, -1) : target
  const page = LINKS.get(file)
  return /^[a-z]+:/.test(href) || href.startsWith('#')
    ? href
    : file.startsWith(IMG)
      ? `img/${file.slice(IMG.length)}${anchor}`
      : page !== undefined
        ? page + anchor
        : (isDir ? REPO_DIR : REPO) + file + anchor
}

// Astro optimizes markdown images into hashed assets under `_astro/`. The
// figures have to stay at `img/<name>`: the landing page loads one of them
// directly, and `shots.json` joins the live-session links on the bare filename.
// Handing them over as raw HTML is what keeps them out of that pipeline.
const attr = s => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;')

export const remarkGuide = () => (tree, file) => {
  const dir = relative(process.cwd(), file.path).replace(/\/[^/]+$/, '')
  visit(tree, 'link', node => {
    node.url = rewriteLink(node.url, dir)
  })
  visit(tree, 'image', (node, i, parent) => {
    const alt = node.alt === null || node.alt === undefined ? '' : node.alt
    parent.children[i] = {
      type: 'html',
      value: `<img src="${attr(node.url)}" alt="${attr(alt)}">`,
    }
  })
}

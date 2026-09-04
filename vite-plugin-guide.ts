import type { Plugin } from 'vite'

import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

// Dev-only: serve the docs site at /guide, which in production is a separate
// static build (scripts/build-guide.mjs -> dist/guide) that GitHub Pages hosts
// beside the app.
//
// The dev server knew nothing about it, and that failed in the worst available
// way. A miss under /guide fell through to vite's HTML fallback, so every link
// and figure the landing page points into the guide came back as index.html
// with a **200** — the "Guide" button opened the landing page again, and
// `/guide/img/signal-path-callout.jpg` arrived as an <img> holding a document,
// which paints as an empty box with nothing in the network log to explain it.
// A 404 would have said so on the first look.
//
// Figures come from `docs/img`, which is what build-guide.mjs copies into
// `dist/guide/img` verbatim, so a figure is correct here without a guide build
// having been run at all. The pages themselves have no such source — they are
// rendered from markdown — so those come from `dist/guide` when it is there and
// 404 with the command to make it when it is not.
const TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const BUILT = 'dist/guide'
const FIGURES = 'docs/img'

// `normalize` collapses the `..` a request can carry before it is joined to a
// root, so a path that climbs out of the two directories below cannot be asked
// for. Both roots are read-only material anyway; this is what keeps them the
// only material.
const resolve = (path: string): string | undefined => {
  const clean = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '')
  const under = clean === '/' ? '/index.html' : clean
  const file = under.startsWith('/img/')
    ? join(FIGURES, under.slice('/img/'.length))
    : join(BUILT, under)
  return existsSync(file) && statSync(file).isFile() ? file : undefined
}

export function guide(): Plugin {
  return {
    name: 'videoskillet.js-guide',
    apply: 'serve',
    configureServer(server) {
      // Connect strips the '/guide' mount, so req.url is '/install.html' or
      // '/img/chain.jpg' here, and '/' for the guide's own index.
      server.middlewares.use('/guide', (req, res) => {
        const asked = new URL(req.url ?? '/', 'http://localhost')
        const file = resolve(asked.pathname)
        if (file === undefined) {
          res.statusCode = 404
          res.end(
            `no ${asked.pathname} under ${BUILT} — the guide is a separate build: run \`pnpm guide\``,
          )
        } else if (req.method === 'HEAD') {
          res.writeHead(200, { 'content-type': TYPES[extname(file)] })
          res.end()
        } else {
          res.writeHead(200, {
            'content-type': TYPES[extname(file)],
            'cache-control': 'no-store',
          })
          res.end(readFileSync(file))
        }
      })
    },
  }
}
